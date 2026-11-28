import test from 'node:test';
import assert from 'node:assert/strict';
const A = '0x1111111111111111111111111111111111111111' as const;
const B = '0x2222222222222222222222222222222222222222' as const;
const C = '0x3333333333333333333333333333333333333333' as const;
import { createMarketOracle, type MarketConfig } from '../src/lib/dynamic-fee-market-oracle.js';

test('unusable market policies are rejected at installation before later BigInt failures', () => {
  for (const policy of [{ targetUtilizationRatio: 0 }, { targetUtilizationRatio: NaN },
    { maxAdjustmentBps: 0.5 }, { minBaseFeeUnits: -1n }, { minBaseFeeUnits: 20n, maxBaseFeeUnits: 10n },
    { quoteTtlSeconds: Infinity }, { quoteTtlSeconds: 0 }] as Partial<MarketConfig>[]) {
    assert.throws(() => createMarketOracle(policy, 'local-key'), /policy|config|limit|fee|TTL|utilization/i);
  }
});

test('config inspection cannot mutate the installed fee and quote lifetime policy', () => {
  const oracle = createMarketOracle(undefined, 'local-key');
  oracle.registerProvider(A, 100, 2000n, 1000);
  const exposed = oracle.config;
  exposed.quoteTtlSeconds = 9999; exposed.maxBaseFeeUnits = 0n;
  assert.equal(oracle.generateQuote({ providerAddress: A, clientAddress: B, priorityTier: 'standard' }, 1000).expiresAtTimestamp, 1060);
  assert.ok(oracle.updateUtilization(A, 100, 1001).currentBaseFeeUnits >= 1000n);
});

test('a zero maximum adjustment leaves the installed base fee unchanged', () => {
  const oracle = createMarketOracle({ maxAdjustmentBps: 0 }, 'local-key');
  oracle.registerProvider(A, 100, 2000n, 1000);
  assert.equal(oracle.updateUtilization(A, 100, 1001).currentBaseFeeUnits, 2000n);
});

test('a zero fee floor remains a valid explicit policy', () => {
  const oracle = createMarketOracle({ minBaseFeeUnits: 0n }, 'local-key');
  assert.equal(oracle.registerProvider(A, 100, 0n, 1000).currentBaseFeeUnits, 0n);
});
