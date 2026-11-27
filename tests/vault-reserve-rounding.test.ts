import test from 'node:test';
import assert from 'node:assert/strict';
import { createVaultPool, authorizeAgentCreditLine, drawLiquidityForPayment, calculateVaultHealthMetrics } from '../src/lib/agent-liquidity-vault.js';

function setup(deposit: bigint, reserveRatioBps = 1000) {
  const pool = createVaultPool({ name: 'local-prototype', settlementAsset: '0x1111111111111111111111111111111111111111',
    initialDepositWei: deposit, reserveRatioBps }, () => true);
  const credit = authorizeAgentCreditLine({ pool, agentAddress: '0x2222222222222222222222222222222222222222',
    creditLimitWei: deposit, velocityLimitWei: deposit });
  return { pool, credit };
}

test('an indivisible reserve fraction rounds upward so the minimum percentage is never breached', () => {
  for (const deposit of [1n, 11n, 101n, 1001n]) {
    const { pool, credit } = setup(deposit);
    const ceiling = (deposit * 1000n + 9999n) / 10000n;
    assert.throws(() => drawLiquidityForPayment(pool, credit, deposit - ceiling + 1n, 1000), /reserve|liquidity/i);
    assert.equal(pool.availableLiquidityWei, deposit);
    if (deposit > ceiling) {
      const result = drawLiquidityForPayment(pool, credit, deposit - ceiling, 1000);
      assert.ok(result.pool.availableLiquidityWei * 10000n >= deposit * 1000n);
      assert.ok(calculateVaultHealthMetrics(result.pool).reserveRatioAchievedBps >= 1000);
    }
  }
});

test('exactly divisible floors and full reserves retain their prior behavior', () => {
  const { pool, credit } = setup(100n, 2000);
  assert.equal(drawLiquidityForPayment(pool, credit, 80n, 1000).pool.availableLiquidityWei, 20n);
  const full = setup(100n, 10000);
  assert.throws(() => drawLiquidityForPayment(full.pool, full.credit, 1n, 1000), /reserve|liquidity/i);
});
