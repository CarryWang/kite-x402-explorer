import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createMarketOracle,
  computeQuoteDigest,
  DEFAULT_MARKET_CONFIG,
  type PriorityTier,
} from '../src/lib/dynamic-fee-market-oracle.ts';

const providerA = '0x1111111111111111111111111111111111111111' as const;
const providerB = '0x2222222222222222222222222222222222222222' as const;
const clientA = '0x3333333333333333333333333333333333333333' as const;
const clientB = '0x4444444444444444444444444444444444444444' as const;

test('provider registration initializes state with default boundaries', () => {
  const oracle = createMarketOracle(undefined, 'test-secret');
  const state = oracle.registerProvider(providerA, 100, 2000n, 1000);

  assert.equal(state.providerAddress, providerA);
  assert.equal(state.capacityLimit, 100);
  assert.equal(state.currentBaseFeeUnits, 2000n);
  assert.equal(state.activeRequests, 0);
  assert.equal(state.utilizationRatio, 0);
  assert.equal(state.lastUpdatedTimestamp, 1000);
});

test('provider registration rejects malformed address or nonpositive capacity', () => {
  const oracle = createMarketOracle(undefined, 'test-secret');

  assert.throws(
    () => oracle.registerProvider('invalid-address' as any, 100),
    /invalid evm address/i
  );

  assert.throws(
    () => oracle.registerProvider(providerA, 0),
    /capacitylimit must be a positive integer/i
  );

  assert.throws(
    () => oracle.registerProvider(providerA, -5),
    /capacitylimit must be a positive integer/i
  );

  assert.throws(
    () => oracle.registerProvider(providerA, 100, 100n), // below min 1000n
    /initialbasefeeunits out of bounds/i
  );
});

test('updateUtilization increases base fee when utilization exceeds target (80%)', () => {
  const oracle = createMarketOracle({
    targetUtilizationRatio: 0.8,
    maxAdjustmentBps: 1250, // 12.5% max
    minBaseFeeUnits: 1000n,
    maxBaseFeeUnits: 50000n,
  }, 'test-secret');

  oracle.registerProvider(providerA, 100, 10000n, 1000);

  // 100 active requests / 100 capacity = 1.0 (100% utilization, above 80% target)
  // diff = (1.0 - 0.8) / 0.8 = 0.25 -> 25% of 1250 bps = 313 bps -> ~3.13% increase
  const updated = oracle.updateUtilization(providerA, 100, 1010);

  assert.equal(updated.activeRequests, 100);
  assert.equal(updated.utilizationRatio, 1.0);
  assert.ok(updated.currentBaseFeeUnits > 10000n, 'Base fee should increase during congestion');
  assert.equal(updated.lastUpdatedTimestamp, 1010);
});

test('updateUtilization decreases base fee when utilization drops below target', () => {
  const oracle = createMarketOracle({
    targetUtilizationRatio: 0.8,
    maxAdjustmentBps: 1250,
    minBaseFeeUnits: 1000n,
    maxBaseFeeUnits: 50000n,
  }, 'test-secret');

  oracle.registerProvider(providerA, 100, 10000n, 1000);

  // 20 active requests / 100 capacity = 0.2 (20% utilization, well below 80% target)
  const updated = oracle.updateUtilization(providerA, 20, 1010);

  assert.equal(updated.activeRequests, 20);
  assert.equal(updated.utilizationRatio, 0.2);
  assert.ok(updated.currentBaseFeeUnits < 10000n, 'Base fee should decrease during low load');
});

test('base fee is strictly clamped between minBaseFeeUnits and maxBaseFeeUnits', () => {
  const oracle = createMarketOracle({
    minBaseFeeUnits: 1000n,
    maxBaseFeeUnits: 5000n,
  }, 'test-secret');

  oracle.registerProvider(providerA, 10, 4800n, 1000);

  // Repeated max load cannot exceed ceiling
  for (let i = 1; i <= 10; i++) {
    oracle.updateUtilization(providerA, 20, 1000 + i * 10);
  }
  const stateHigh = oracle.getMarketState(providerA);
  assert.equal(stateHigh?.currentBaseFeeUnits, 5000n);

  // Repeated zero load cannot drop below floor
  for (let i = 1; i <= 20; i++) {
    oracle.updateUtilization(providerA, 0, 1200 + i * 10);
  }
  const stateLow = oracle.getMarketState(providerA);
  assert.equal(stateLow?.currentBaseFeeUnits, 1000n);
});

test('calculatePriorityTip computes expected tip for each PriorityTier', () => {
  const oracle = createMarketOracle(undefined, 'test-secret');
  const baseFee = 10000n;

  // economy = 0%
  assert.equal(oracle.calculatePriorityTip(baseFee, 'economy'), 0n);
  // standard = 0.5% (50 bps) -> 10000 * 50 / 10000 = 50n
  assert.equal(oracle.calculatePriorityTip(baseFee, 'standard'), 50n);
  // expedited = 2.0% (200 bps) -> 10000 * 200 / 10000 = 200n
  assert.equal(oracle.calculatePriorityTip(baseFee, 'expedited'), 200n);
  // flash = 5.0% (500 bps) -> 10000 * 500 / 10000 = 500n
  assert.equal(oracle.calculatePriorityTip(baseFee, 'flash'), 500n);
});

test('generateQuote produces valid quote with cryptographic digest and correct TTL', () => {
  const oracle = createMarketOracle({ quoteTtlSeconds: 120 }, 'test-secret');
  oracle.registerProvider(providerA, 100, 10000n, 1000);

  const quote = oracle.generateQuote(
    {
      providerAddress: providerA,
      clientAddress: clientA,
      priorityTier: 'expedited',
    },
    1000
  );

  assert.equal(quote.providerAddress, providerA);
  assert.equal(quote.clientAddress, clientA);
  assert.equal(quote.priorityTier, 'expedited');
  assert.equal(quote.baseFeeUnits, 10000n);
  assert.equal(quote.priorityTipUnits, 200n);
  assert.equal(quote.totalFeeUnits, 10200n);
  assert.equal(quote.issuedAtTimestamp, 1000);
  assert.equal(quote.expiresAtTimestamp, 1120);
  assert.match(quote.quoteDigest, /^0x[0-9a-f]{64}$/);
});

test('verifyQuote validates authentic quotes and catches tampering or expiration', () => {
  const oracle = createMarketOracle({ quoteTtlSeconds: 60 }, 'test-secret');
  oracle.registerProvider(providerA, 100, 10000n, 1000);

  const quote = oracle.generateQuote(
    {
      providerAddress: providerA,
      clientAddress: clientA,
      priorityTier: 'standard',
    },
    1000
  );

  // Valid verification at t=1030
  const validRes = oracle.verifyQuote(quote, 1030);
  assert.equal(validRes.valid, true);
  assert.equal(validRes.effectiveFeeUnits, quote.totalFeeUnits);

  // Expired verification at t=1070 (> 1060 expiry)
  const expiredRes = oracle.verifyQuote(quote, 1070);
  assert.equal(expiredRes.valid, false);
  assert.equal(expiredRes.reason, 'EXPIRED');

  // Tampered quote (altered total fee)
  const tamperedQuote = {
    ...quote,
    totalFeeUnits: 5000n, // reduced fee fraudulently
  };
  const tamperedRes = oracle.verifyQuote(tamperedQuote, 1030);
  assert.equal(tamperedRes.valid, false);
  assert.equal(tamperedRes.reason, 'TAMPERED_DIGEST');

  // Tampered quote (altered client address)
  const stolenQuote = {
    ...quote,
    clientAddress: clientB,
  };
  const stolenRes = oracle.verifyQuote(stolenQuote, 1030);
  assert.equal(stolenRes.valid, false);
  assert.equal(stolenRes.reason, 'TAMPERED_DIGEST');
});

test('HMAC signing secret enforces trusted issuer verification', () => {
  const oracle = createMarketOracle(undefined, 'super-secret-provider-key-99');
  oracle.registerProvider(providerA, 100, 10000n, 1000);

  const quote = oracle.generateQuote(
    {
      providerAddress: providerA,
      clientAddress: clientA,
      priorityTier: 'flash',
    },
    1000
  );

  // Verification with matching secret succeeds
  const matchRes = oracle.verifyQuote(quote, 1020);
  assert.equal(matchRes.valid, true);

  // Verification with wrong secret fails tamper check
  const wrongOracle = createMarketOracle(undefined, 'wrong-secret');
  const wrongRes = wrongOracle.verifyQuote(quote, 1020);
  assert.equal(wrongRes.valid, false);
  assert.equal(wrongRes.reason, 'TAMPERED_DIGEST');
});
