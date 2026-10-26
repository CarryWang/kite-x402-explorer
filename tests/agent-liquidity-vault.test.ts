import { describe, expect, it } from 'vitest';
import {
  createVaultPool,
  depositToVault,
  authorizeAgentCreditLine,
  drawLiquidityForPayment,
  repayLiquidity,
  calculateVaultHealthMetrics,
} from '../src/lib/agent-liquidity-vault';

describe('agent-liquidity-vault', () => {
  const asset = '0x1234567890123456789012345678901234567890' as const;
  const agent = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as const;

  it('creates a vault pool with valid parameters', () => {
    const pool = createVaultPool({
      name: 'Agent Swarm Liquidity',
      settlementAsset: asset,
      initialDepositWei: 1_000_000_000n, // 1000 USDC
      reserveRatioBps: 2000, // 20%
    });

    expect(pool.poolId).toMatch(/^pool-[a-f0-9]{12}$/);
    expect(pool.totalDepositedWei).toBe(1_000_000_000n);
    expect(pool.availableLiquidityWei).toBe(1_000_000_000n);
    expect(pool.status).toBe('active');
  });

  it('allows depositing additional liquidity', () => {
    let pool = createVaultPool({
      name: 'Test Pool',
      settlementAsset: asset,
      initialDepositWei: 500_000_000n,
    });

    pool = depositToVault(pool, 200_000_000n);
    expect(pool.totalDepositedWei).toBe(700_000_000n);
    expect(pool.availableLiquidityWei).toBe(700_000_000n);
  });

  it('authorizes agent credit line and executes valid drawdown', () => {
    let pool = createVaultPool({
      name: 'Swarm Pool',
      settlementAsset: asset,
      initialDepositWei: 1_000_000_000n,
      reserveRatioBps: 2000, // reserve floor = 200_000_000n
    });

    let creditLine = authorizeAgentCreditLine({
      pool,
      agentAddress: agent,
      creditLimitWei: 500_000_000n,
      velocityLimitWei: 300_000_000n,
      velocityWindowSeconds: 3600,
    });

    expect(creditLine.authorized).toBe(true);
    expect(creditLine.currentDrawnWei).toBe(0n);

    // Draw 100 USDC
    const drawRes = drawLiquidityForPayment(pool, creditLine, 100_000_000n, 1000);
    pool = drawRes.pool;
    creditLine = drawRes.creditLine;

    expect(creditLine.currentDrawnWei).toBe(100_000_000n);
    expect(pool.availableLiquidityWei).toBe(900_000_000n);
    expect(pool.allocatedLiquidityWei).toBe(100_000_000n);

    // Repay 50 USDC
    const repayRes = repayLiquidity(pool, creditLine, 50_000_000n);
    pool = repayRes.pool;
    creditLine = repayRes.creditLine;

    expect(creditLine.currentDrawnWei).toBe(50_000_000n);
    expect(pool.availableLiquidityWei).toBe(950_000_000n);
    expect(pool.allocatedLiquidityWei).toBe(50_000_000n);
  });

  it('rejects drawdowns that violate reserve ratio floor', () => {
    const pool = createVaultPool({
      name: 'Reserve Test Pool',
      settlementAsset: asset,
      initialDepositWei: 100_000_000n,
      reserveRatioBps: 5000, // 50% floor = 50_000_000n free
    });

    const creditLine = authorizeAgentCreditLine({
      pool,
      agentAddress: agent,
      creditLimitWei: 80_000_000n,
      velocityLimitWei: 80_000_000n,
    });

    // Attempting to draw 60 USDC should fail because only 50 USDC is above floor
    expect(() => drawLiquidityForPayment(pool, creditLine, 60_000_000n, 1000)).toThrow(
      /Insufficient free liquidity above reserve floor/,
    );
  });

  it('calculates health metrics correctly', () => {
    let pool = createVaultPool({
      name: 'Metrics Pool',
      settlementAsset: asset,
      initialDepositWei: 1_000_000_000n,
    });

    let creditLine = authorizeAgentCreditLine({
      pool,
      agentAddress: agent,
      creditLimitWei: 500_000_000n,
      velocityLimitWei: 500_000_000n,
    });

    const drawRes = drawLiquidityForPayment(pool, creditLine, 250_000_000n, 1000);
    pool = drawRes.pool;

    const metrics = calculateVaultHealthMetrics(pool);
    expect(metrics.utilizationRateBps).toBe(2500); // 25%
    expect(metrics.reserveRatioAchievedBps).toBe(7500); // 75%
    expect(metrics.isSolvent).toBe(true);
  });
});
