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
