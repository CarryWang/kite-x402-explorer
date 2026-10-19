import { isAddress, keccak256, stringToHex } from 'viem';

export type BondStatus = 'active' | 'unbonding' | 'slashed' | 'withdrawn';

export type SlashReason = 'sla_breach' | 'invalid_attestation' | 'byzantine_disagreement';

export interface AgentBondRecord {
  bondId: string;
  agentAddress: `0x${string}`;
  stakedAmountWei: bigint;
  activeLockedWei: bigint;
  unbondingAmountWei: bigint;
  unbondingCooldownDeadline: number | null;
  status: BondStatus;
  reputationScore: number; // Scale: 0 to 1000 (default 500)
  registeredAt: number;
  lastActivityAt: number;
}

export interface SlashEvent {
  slashId: string;
  bondId: string;
  slashedWei: bigint;
  beneficiary: `0x${string}`;
  reason: SlashReason;
  evidenceHash: `0x${string}`;
  timestamp: number;
}

export interface BondTierInfo {
  tierName: 'unverified' | 'bronze' | 'silver' | 'gold' | 'sovereign';
  maxConcurrentTasks: number;
  maxTaskAllocationWei: bigint;
  creditMultiplier: number;
}

export const MIN_BOND_AMOUNT_WEI = 10_000_000n; // 10 units at 6 decimals (e.g., 10 USDC)
export const DEFAULT_UNBONDING_COOLDOWN_SECONDS = 7 * 86400; // 7 days

/**
 * Derives a deterministic bond identifier from agent address and nonce timestamp.
 */
export function deriveBondId(agentAddress: `0x${string}`, timestamp: number): string {
  const digest = keccak256(stringToHex(`bond:${agentAddress.toLowerCase()}:${timestamp}`));
  return `bond-${digest.slice(2, 14)}`;
}

/**
 * Initializes a new staked bond record for an autonomous agent.
 */
export function createAgentBond(params: {
  agentAddress: `0x${string}`;
  depositWei: bigint;
  timestamp?: number;
}): AgentBondRecord {
  const { agentAddress, depositWei } = params;
  const now = params.timestamp ?? Date.now();

  if (!isAddress(agentAddress, { strict: false })) {
    throw new Error(`Invalid agent address: ${agentAddress}`);
  }
  if (depositWei < MIN_BOND_AMOUNT_WEI) {
    throw new Error(
      `Deposit amount ${depositWei.toString()} wei is below minimum requirement of ${MIN_BOND_AMOUNT_WEI.toString()} wei`
    );
  }

  const bondId = deriveBondId(agentAddress, now);

  return {
    bondId,
    agentAddress,
    stakedAmountWei: depositWei,
    activeLockedWei: 0n,
    unbondingAmountWei: 0n,
    unbondingCooldownDeadline: null,
    status: 'active',
    reputationScore: 500,
    registeredAt: now,
    lastActivityAt: now,
  };
}

/**
 * Computes agent tier and capacity limits based on active stake and reputation.
 */
export function calculateBondTier(bond: AgentBondRecord): BondTierInfo {
  if (bond.status !== 'active') {
    return {
      tierName: 'unverified',
      maxConcurrentTasks: 0,
      maxTaskAllocationWei: 0n,
      creditMultiplier: 0,
    };
  }

  const effectiveScore = bond.reputationScore;
  const stake = bond.stakedAmountWei;

  if (stake >= 1_000_000_000n && effectiveScore >= 900) {
    return {
      tierName: 'sovereign',
      maxConcurrentTasks: 100,
      maxTaskAllocationWei: stake * 2n,
      creditMultiplier: 2.0,
    };
  }
  if (stake >= 250_000_000n && effectiveScore >= 750) {
    return {
      tierName: 'gold',
      maxConcurrentTasks: 30,
      maxTaskAllocationWei: (stake * 15n) / 10n,
      creditMultiplier: 1.5,
    };
  }
  if (stake >= 50_000_000n && effectiveScore >= 600) {
    return {
      tierName: 'silver',
      maxConcurrentTasks: 10,
      maxTaskAllocationWei: stake,
      creditMultiplier: 1.0,
    };
  }
  if (stake >= MIN_BOND_AMOUNT_WEI && effectiveScore >= 400) {
    return {
      tierName: 'bronze',
      maxConcurrentTasks: 3,
      maxTaskAllocationWei: stake / 2n,
      creditMultiplier: 0.8,
    };
  }

  return {
    tierName: 'unverified',
    maxConcurrentTasks: 1,
    maxTaskAllocationWei: MIN_BOND_AMOUNT_WEI / 4n,
    creditMultiplier: 0.5,
  };
}

/**
 * Locks a portion of the agent's available stake against an in-progress compute task.
 */
export function lockTaskCapacity(
  bond: AgentBondRecord,
  requiredWei: bigint,
  now = Date.now()
): AgentBondRecord {
  if (bond.status !== 'active') {
    throw new Error(`Cannot lock capacity on agent bond with status '${bond.status}'`);
  }
  if (requiredWei <= 0n) {
    throw new Error('Task allocation requirement must be strictly positive');
  }

  const available = bond.stakedAmountWei - bond.activeLockedWei;
  if (available < requiredWei) {
    throw new Error(
      `Insufficient available stake: required ${requiredWei.toString()} wei, but only ${available.toString()} wei available`
    );
  }

  return {
    ...bond,
    activeLockedWei: bond.activeLockedWei + requiredWei,
    lastActivityAt: now,
  };
}

/**
 * Releases locked task capacity and updates reputation score based on task outcome.
 */
export function releaseTaskCapacity(
  bond: AgentBondRecord,
  releasedWei: bigint,
  success: boolean,
  now = Date.now()
): AgentBondRecord {
  if (releasedWei <= 0n) {
    throw new Error('Released allocation amount must be strictly positive');
  }
  if (releasedWei > bond.activeLockedWei) {
    throw new Error(
      `Cannot release ${releasedWei.toString()} wei exceeding active locked amount ${bond.activeLockedWei.toString()} wei`
    );
  }

  let newReputation = bond.reputationScore;
  if (success) {
    newReputation = Math.min(1000, newReputation + 5);
  } else {
    newReputation = Math.max(0, newReputation - 25);
  }

  return {
    ...bond,
    activeLockedWei: bond.activeLockedWei - releasedWei,
    reputationScore: newReputation,
    lastActivityAt: now,
  };
}

/**
 * Executes a punitive bond slash following an adjudicated protocol violation.
 */
export function slashBond(
  bond: AgentBondRecord,
  slashBps: number,
  beneficiary: `0x${string}`,
  reason: SlashReason,
  evidenceHash: `0x${string}`,
  now = Date.now()
): { updatedBond: AgentBondRecord; slashEvent: SlashEvent } {
  if (bond.status !== 'active' && bond.status !== 'unbonding') {
    throw new Error(`Cannot slash bond with terminal status '${bond.status}'`);
  }
  if (!isAddress(beneficiary, { strict: false })) {
    throw new Error(`Invalid beneficiary address: ${beneficiary}`);
  }
  if (slashBps <= 0 || slashBps > 10000) {
    throw new Error(`Slash basis points must be between 1 and 10000, received ${slashBps}`);
  }
  if (!evidenceHash.startsWith('0x') || evidenceHash.length !== 66) {
    throw new Error(`Invalid 32-byte cryptographic evidence hash: ${evidenceHash}`);
  }

  const slashFraction = (bond.stakedAmountWei * BigInt(slashBps)) / 10000n;
  const slashedWei = slashFraction > 0n ? slashFraction : 1n;
  const remainingStake = bond.stakedAmountWei > slashedWei ? bond.stakedAmountWei - slashedWei : 0n;

  const slashEvent: SlashEvent = {
    slashId: `slash-${keccak256(stringToHex(`${bond.bondId}:${evidenceHash}:${now}`)).slice(2, 14)}`,
    bondId: bond.bondId,
    slashedWei,
    beneficiary,
    reason,
    evidenceHash,
    timestamp: now,
  };

  const newStatus: BondStatus =
    remainingStake < MIN_BOND_AMOUNT_WEI ? 'slashed' : bond.status;

  const updatedBond: AgentBondRecord = {
    ...bond,
    stakedAmountWei: remainingStake,
    activeLockedWei: 0n, // Cancel any active allocations on catastrophic slash
    reputationScore: Math.max(0, bond.reputationScore - Math.floor(slashBps / 20)),
    status: newStatus,
    lastActivityAt: now,
  };

  return { updatedBond, slashEvent };
}

/**
 * Initiates an unbonding cooldown window to withdraw staked bond capital.
 */
export function initiateUnbonding(
  bond: AgentBondRecord,
  unbondWei: bigint,
  cooldownSeconds = DEFAULT_UNBONDING_COOLDOWN_SECONDS,
  now = Date.now()
): AgentBondRecord {
  if (bond.status !== 'active') {
    throw new Error(`Cannot initiate unbonding from status '${bond.status}'`);
  }
  if (bond.activeLockedWei > 0n) {
    throw new Error(
      `Cannot initiate unbonding while ${bond.activeLockedWei.toString()} wei is actively locked in compute tasks`
    );
  }
  if (unbondWei <= 0n) {
    throw new Error('Unbonding amount must be strictly positive');
  }
  if (unbondWei > bond.stakedAmountWei) {
    throw new Error(
      `Cannot unbond ${unbondWei.toString()} wei exceeding current stake ${bond.stakedAmountWei.toString()} wei`
    );
  }

  const remainingStake = bond.stakedAmountWei - unbondWei;
  const cooldownDeadline = now + cooldownSeconds * 1000;

  return {
    ...bond,
    stakedAmountWei: remainingStake,
    unbondingAmountWei: bond.unbondingAmountWei + unbondWei,
    unbondingCooldownDeadline: cooldownDeadline,
    status: 'unbonding',
    lastActivityAt: now,
  };
}

/**
 * Finalizes unbonding withdrawal once the required time-lock cooldown period expires.
 */
export function finalizeWithdrawal(
  bond: AgentBondRecord,
  now = Date.now()
): { updatedBond: AgentBondRecord; withdrawnWei: bigint } {
  if (bond.status !== 'unbonding') {
    throw new Error(`Cannot finalize withdrawal on bond with status '${bond.status}'`);
  }
  if (bond.unbondingCooldownDeadline === null || now < bond.unbondingCooldownDeadline) {
    const remainingSeconds =
      bond.unbondingCooldownDeadline !== null
        ? Math.ceil((bond.unbondingCooldownDeadline - now) / 1000)
        : 0;
    throw new Error(
      `Unbonding cooldown period has not elapsed yet. ${remainingSeconds} seconds remaining.`
    );
  }

  const withdrawnWei = bond.unbondingAmountWei;
  const newStatus: BondStatus = bond.stakedAmountWei === 0n ? 'withdrawn' : 'active';

  const updatedBond: AgentBondRecord = {
    ...bond,
    unbondingAmountWei: 0n,
    unbondingCooldownDeadline: null,
    status: newStatus,
    lastActivityAt: now,
  };

  return { updatedBond, withdrawnWei };
}


