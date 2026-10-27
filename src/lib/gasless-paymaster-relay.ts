/**
 * Gasless Paymaster Relay & Sponsored Micropayments
 *
 * Implements ERC-4337 / EIP-712 paymaster mechanics for x402 micropayments.
 * Allows autonomous agents holding ERC-20 utility tokens (like USD stablecoins on Kite Chain)
 * to execute micropayment transactions without needing native gas currency,
 * supported by underwritten sponsorship pools.
 */

export interface PaymasterPolicy {
  maxGasLimitPerTx: bigint;
  allowedTokens: string[];
  dailyAgentGasCapWei: bigint;
  whitelistedAgents?: string[];
  blacklistedAgents?: string[];
}

export interface SponsorshipPool {
  poolId: string;
  sponsor: string;
  balanceWei: bigint;
  spentWei: bigint;
  policy: PaymasterPolicy;
  agentDailySpend: Map<string, { date: string; spentWei: bigint }>;
  createdAt: number;
}

export interface RelayRequest {
  agent: string;
  token: string;
  amount: bigint;
  estimatedGas: bigint;
  nonce: string;
  signature: string;
  timestamp?: number;
}

export interface SponsoredReceipt {
  relayTxId: string;
  poolId: string;
  agent: string;
  sponsoredGasWei: bigint;
  gasPriceWei: bigint;
  totalCostWei: bigint;
  remainingPoolBalanceWei: bigint;
  timestamp: number;
  status: 'sponsored' | 'rejected';
}

export interface PaymasterMetrics {
  totalPools: number;
  totalBalanceWei: bigint;
  totalSpentWei: bigint;
  activeSponsors: number;
}

/**
 * Creates a new Paymaster sponsorship pool with the given initial deposit and policy.
 */
export function createPaymasterPool(params: {
  poolId: string;
  sponsor: string;
  initialDepositWei: bigint;
  policy: PaymasterPolicy;
}): SponsorshipPool {
  if (!params.poolId || params.poolId.trim() === '') {
    throw new Error('poolId must not be empty');
  }
  if (!params.sponsor.startsWith('0x') || params.sponsor.length !== 42) {
    throw new Error('sponsor must be a valid 20-byte hex address');
  }
  if (params.initialDepositWei <= 0n) {
    throw new Error('initialDepositWei must be strictly positive');
  }
  if (params.policy.maxGasLimitPerTx <= 0n) {
    throw new Error('maxGasLimitPerTx must be positive');
  }

  return {
    poolId: params.poolId,
    sponsor: params.sponsor.toLowerCase(),
    balanceWei: params.initialDepositWei,
    spentWei: 0n,
    policy: {
      ...params.policy,
      allowedTokens: params.policy.allowedTokens.map((t) => t.toLowerCase()),
      whitelistedAgents: params.policy.whitelistedAgents?.map((a) => a.toLowerCase()),
      blacklistedAgents: params.policy.blacklistedAgents?.map((a) => a.toLowerCase()),
    },
    agentDailySpend: new Map(),
    createdAt: Date.now(),
  };
}

/**
 * Deposits additional gas funds into an existing sponsorship pool.
 */
export function depositGasToPool(pool: SponsorshipPool, amountWei: bigint): SponsorshipPool {
  if (amountWei <= 0n) {
    throw new Error('deposit amount must be positive');
  }
  return {
    ...pool,
    balanceWei: pool.balanceWei + amountWei,
  };
}

/**
 * Validates whether an incoming agent relay request is eligible for gas sponsorship.
 */
export function validateSponsorshipEligibility(
  pool: SponsorshipPool,
  request: RelayRequest,
  gasPriceWei: bigint
): { eligible: boolean; reason?: string } {
  const agentLower = request.agent.toLowerCase();
  const tokenLower = request.token.toLowerCase();

  if (pool.policy.blacklistedAgents?.includes(agentLower)) {
    return { eligible: false, reason: 'agent is blacklisted from gas sponsorship' };
  }

  if (
    pool.policy.whitelistedAgents &&
    pool.policy.whitelistedAgents.length > 0 &&
    !pool.policy.whitelistedAgents.includes(agentLower)
  ) {
    return { eligible: false, reason: 'agent is not in sponsor whitelist' };
  }

  if (!pool.policy.allowedTokens.includes(tokenLower)) {
    return { eligible: false, reason: `token ${request.token} not supported by paymaster policy` };
  }

  if (request.estimatedGas > pool.policy.maxGasLimitPerTx) {
    return { eligible: false, reason: `estimated gas ${request.estimatedGas} exceeds max limit ${pool.policy.maxGasLimitPerTx}` };
  }

  const estimatedCost = request.estimatedGas * gasPriceWei;
  if (estimatedCost > pool.balanceWei) {
    return { eligible: false, reason: 'insufficient pool gas funds for sponsorship' };
  }

  // Check daily limit
  const today = new Date().toISOString().slice(0, 10);
  const currentDaily = pool.agentDailySpend.get(agentLower);
  const currentSpent = currentDaily && currentDaily.date === today ? currentDaily.spentWei : 0n;

  if (currentSpent + estimatedCost > pool.policy.dailyAgentGasCapWei) {
    return { eligible: false, reason: 'agent daily gas sponsorship cap exceeded' };
  }

  return { eligible: true };
}

/**
 * Executes a sponsored relay transaction, updating the pool balance and recording daily usage.
 */
export function executeSponsoredRelay(
  pool: SponsorshipPool,
  request: RelayRequest,
  gasPriceWei: bigint
): { receipt: SponsoredReceipt; updatedPool: SponsorshipPool } {
  const check = validateSponsorshipEligibility(pool, request, gasPriceWei);
  if (!check.eligible) {
    throw new Error(`Sponsorship rejected: ${check.reason}`);
  }

  const totalCostWei = request.estimatedGas * gasPriceWei;
  const newBalance = pool.balanceWei - totalCostWei;
  const newSpent = pool.spentWei + totalCostWei;

  const agentLower = request.agent.toLowerCase();
  const today = new Date().toISOString().slice(0, 10);
  const currentDaily = pool.agentDailySpend.get(agentLower);
  const priorSpent = currentDaily && currentDaily.date === today ? currentDaily.spentWei : 0n;

  const updatedDaily = new Map(pool.agentDailySpend);
  updatedDaily.set(agentLower, {
    date: today,
    spentWei: priorSpent + totalCostWei,
  });

  const updatedPool: SponsorshipPool = {
    ...pool,
    balanceWei: newBalance,
    spentWei: newSpent,
    agentDailySpend: updatedDaily,
  };

  const receipt: SponsoredReceipt = {
    relayTxId: `relay_${Date.now()}_${request.nonce.slice(0, 8)}`,
    poolId: pool.poolId,
    agent: agentLower,
    sponsoredGasWei: request.estimatedGas,
    gasPriceWei,
    totalCostWei,
    remainingPoolBalanceWei: newBalance,
    timestamp: Date.now(),
    status: 'sponsored',
  };

  return { receipt, updatedPool };
}

/**
 * Calculates aggregate telemetry across multiple sponsorship pools.
 */
export function getPaymasterMetrics(pools: SponsorshipPool[]): PaymasterMetrics {
  const sponsors = new Set<string>();
  let totalBalance = 0n;
  let totalSpent = 0n;

  for (const pool of pools) {
    sponsors.add(pool.sponsor);
    totalBalance += pool.balanceWei;
    totalSpent += pool.spentWei;
  }

  return {
    totalPools: pools.length,
    totalBalanceWei: totalBalance,
    totalSpentWei: totalSpent,
    activeSponsors: sponsors.size,
  };
}
