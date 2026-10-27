import { isAddress, keccak256, stringToHex } from 'viem';

export type VaultStatus = 'active' | 'paused' | 'liquidating';

export interface VaultPool {
  poolId: string;
  name: string;
  settlementAsset: `0x${string}`;
  totalDepositedWei: bigint;
  availableLiquidityWei: bigint;
  allocatedLiquidityWei: bigint;
  reserveRatioBps: number; // e.g. 2000 = 20%
  status: VaultStatus;
  createdAt: number;
}

export interface AgentCreditLine {
  poolId: string;
  agentAddress: `0x${string}`;
  creditLimitWei: bigint;
  currentDrawnWei: bigint;
  velocityLimitWei: bigint;
  velocityWindowSeconds: number;
  recentDrawnInWindowWei: bigint;
  lastDrawTimestamp: number;
  authorized: boolean;
}

export interface VaultHealthMetrics {
  poolId: string;
  utilizationRateBps: number;
  reserveRatioAchievedBps: number;
  isSolvent: boolean;
  totalLiquidityWei: bigint;
  availableLiquidityWei: bigint;
}

export const MIN_VAULT_RESERVE_BPS = 1000; // 10% minimum safety reserve
export const BPS_DENOMINATOR = 10_000;

/**
 * Derives a deterministic pool identifier.
 */
export function derivePoolId(name: string, settlementAsset: `0x${string}`, createdAt: number): string {
  const hash = keccak256(stringToHex(`vault:${name.toLowerCase()}:${settlementAsset.toLowerCase()}:${createdAt}`));
  return `pool-${hash.slice(2, 14)}`;
}

/**
 * Initializes a new agent liquidity vault pool.
 */
export function createVaultPool(params: {
  name: string;
  settlementAsset: `0x${string}`;
  initialDepositWei: bigint;
  reserveRatioBps?: number;
  timestamp?: number;
}, verifyDeposit?: (params: { settlementAsset: `0x${string}`; initialDepositWei: bigint }) => boolean): VaultPool {
  if (!isAddress(params.settlementAsset)) {
    throw new Error(`Invalid settlement asset address: ${params.settlementAsset}`);
  }
  if (params.initialDepositWei <= 0n) {
    throw new Error('Initial deposit must be strictly positive');
  }
  if (!verifyDeposit?.(params)) {
    throw new Error('Verified initial deposit required');
  }

  const reserveRatio = params.reserveRatioBps ?? 2000;
  if (reserveRatio < MIN_VAULT_RESERVE_BPS || reserveRatio > BPS_DENOMINATOR) {
    throw new Error(`Invalid reserve ratio: ${reserveRatio} bps`);
  }

  const createdAt = params.timestamp ?? Date.now();
  const poolId = derivePoolId(params.name, params.settlementAsset, createdAt);

  return {
    poolId,
    name: params.name,
    settlementAsset: params.settlementAsset,
    totalDepositedWei: params.initialDepositWei,
    availableLiquidityWei: params.initialDepositWei,
    allocatedLiquidityWei: 0n,
    reserveRatioBps: reserveRatio,
    status: 'active',
    createdAt,
  };
}

/**
 * Deposits additional stablecoin liquidity into the vault pool.
 */
export function depositToVault(pool: VaultPool, amountWei: bigint, verifyDeposit?: (pool: VaultPool, amountWei: bigint) => boolean): VaultPool {
  if (pool.status !== 'active') {
    throw new Error(`Cannot deposit to vault in state: ${pool.status}`);
  }
  if (amountWei <= 0n) {
    throw new Error('Deposit amount must be positive');
  }
  if (!verifyDeposit?.(pool, amountWei)) {
    throw new Error('Verified vault deposit required');
  }

  return {
    ...pool,
    totalDepositedWei: pool.totalDepositedWei + amountWei,
    availableLiquidityWei: pool.availableLiquidityWei + amountWei,
  };
}

/**
 * Configures an authorized credit line for an autonomous AI agent.
 */
export function authorizeAgentCreditLine(params: {
  pool: VaultPool,
  agentAddress: `0x${string}`,
  creditLimitWei: bigint,
  velocityLimitWei: bigint,
  velocityWindowSeconds?: number,
}): AgentCreditLine {
  if (!isAddress(params.agentAddress)) {
    throw new Error(`Invalid agent address: ${params.agentAddress}`);
  }
  if (params.creditLimitWei <= 0n) {
    throw new Error('Credit limit must be positive');
  }

  return {
    poolId: params.pool.poolId,
    agentAddress: params.agentAddress,
    creditLimitWei: params.creditLimitWei,
    currentDrawnWei: 0n,
    velocityLimitWei: params.velocityLimitWei,
    velocityWindowSeconds: params.velocityWindowSeconds ?? 3600, // 1 hour default
    recentDrawnInWindowWei: 0n,
    lastDrawTimestamp: 0,
    authorized: true,
  };
}

/**
 * Executes a liquidity drawdown for x402 payment authorization.
 */
export function drawLiquidityForPayment(
  pool: VaultPool,
  creditLine: AgentCreditLine,
  drawAmountWei: bigint,
  timestamp: number = Date.now(),
): { pool: VaultPool; creditLine: AgentCreditLine; drawAmountWei: bigint } {
  if (pool.status !== 'active') {
    throw new Error(`Vault is not active: ${pool.status}`);
  }
  if (!creditLine.authorized) {
    throw new Error('Agent credit line is not authorized');
  }
  if (creditLine.poolId !== pool.poolId) {
    throw new Error('Credit line pool mismatch');
  }
  if (drawAmountWei <= 0n) {
    throw new Error('Draw amount must be positive');
  }

  // Check required reserve floor
  const requiredReserve = (pool.totalDepositedWei * BigInt(pool.reserveRatioBps)) / BigInt(BPS_DENOMINATOR);
  const maxAvailableForDraw = pool.availableLiquidityWei > requiredReserve
    ? pool.availableLiquidityWei - requiredReserve
    : 0n;

  if (drawAmountWei > maxAvailableForDraw) {
    throw new Error(`Insufficient free liquidity above reserve floor (${drawAmountWei} > ${maxAvailableForDraw})`);
  }

  // Check credit limit
  if (creditLine.currentDrawnWei + drawAmountWei > creditLine.creditLimitWei) {
    throw new Error('Credit limit exceeded');
  }

  // Check velocity window
  const windowPassed = timestamp - creditLine.lastDrawTimestamp >= creditLine.velocityWindowSeconds * 1000;
  const currentWindowDrawn = windowPassed ? 0n : creditLine.recentDrawnInWindowWei;

  if (currentWindowDrawn + drawAmountWei > creditLine.velocityLimitWei) {
    throw new Error('Agent velocity drawdown limit exceeded for current time window');
  }

  const updatedPool: VaultPool = {
    ...pool,
    availableLiquidityWei: pool.availableLiquidityWei - drawAmountWei,
    allocatedLiquidityWei: pool.allocatedLiquidityWei + drawAmountWei,
  };

  const updatedCreditLine: AgentCreditLine = {
    ...creditLine,
    currentDrawnWei: creditLine.currentDrawnWei + drawAmountWei,
    recentDrawnInWindowWei: currentWindowDrawn + drawAmountWei,
    lastDrawTimestamp: timestamp,
  };

  return { pool: updatedPool, creditLine: updatedCreditLine, drawAmountWei };
}

/**
 * Repays drawn liquidity back to the vault following settlement confirmation.
 */
export function repayLiquidity(
  pool: VaultPool,
  creditLine: AgentCreditLine,
  repayAmountWei: bigint,
): { pool: VaultPool; creditLine: AgentCreditLine } {
  if (creditLine.poolId !== pool.poolId) {
    throw new Error('Credit line pool mismatch');
  }
  if (repayAmountWei <= 0n) {
    throw new Error('Repay amount must be positive');
  }
  if (repayAmountWei > creditLine.currentDrawnWei) {
    throw new Error(`Cannot repay more than currently drawn: ${repayAmountWei} > ${creditLine.currentDrawnWei}`);
  }
  if (repayAmountWei > pool.allocatedLiquidityWei) {
    throw new Error('Repayment exceeds pool allocated liquidity');
  }

  const updatedPool: VaultPool = {
    ...pool,
    availableLiquidityWei: pool.availableLiquidityWei + repayAmountWei,
    allocatedLiquidityWei: pool.allocatedLiquidityWei - repayAmountWei,
  };

  const updatedCreditLine: AgentCreditLine = {
    ...creditLine,
    currentDrawnWei: creditLine.currentDrawnWei - repayAmountWei,
  };

  return { pool: updatedPool, creditLine: updatedCreditLine };
}

/**
 * Evaluates vault solvency and health utilization ratios.
 */
export function calculateVaultHealthMetrics(pool: VaultPool): VaultHealthMetrics {
  const total = pool.totalDepositedWei;
  const utilizationRateBps = total === 0n
    ? 0
    : Number((pool.allocatedLiquidityWei * BigInt(BPS_DENOMINATOR)) / total);

  const reserveRatioAchievedBps = total === 0n
    ? 0
    : Number((pool.availableLiquidityWei * BigInt(BPS_DENOMINATOR)) / total);

  const isSolvent = pool.availableLiquidityWei + pool.allocatedLiquidityWei >= pool.totalDepositedWei;

  return {
    poolId: pool.poolId,
    utilizationRateBps,
    reserveRatioAchievedBps,
    isSolvent,
    totalLiquidityWei: total,
    availableLiquidityWei: pool.availableLiquidityWei,
  };
}
