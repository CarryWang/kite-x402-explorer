import assert from 'node:assert/strict';
import test from 'node:test';
import { SemanticCacheOracle } from '../src/lib/semantic-cache-oracle.ts';

const providerA = '0x1111111111111111111111111111111111111111';
const providerB = '0x2222222222222222222222222222222222222222';

test('hashPrompt normalizes whitespace and casing deterministically', () => {
  const hash1 = SemanticCacheOracle.hashPrompt('  What is the CURRENT weather in Tokyo?  \n');
  const hash2 = SemanticCacheOracle.hashPrompt('what is the current weather in tokyo?');
  const hash3 = SemanticCacheOracle.hashPrompt('what   is the current   weather in tokyo?');

  assert.equal(hash1, hash2);
  assert.equal(hash2, hash3);
  assert.equal(hash1.length, 64);
});

test('digestPayload computes correct SHA-256 hex string', () => {
  const digest1 = SemanticCacheOracle.digestPayload('{"temp": 22.5, "condition": "sunny"}');
  const digest2 = SemanticCacheOracle.digestPayload('{"temp": 22.5, "condition": "sunny"}');
  const digest3 = SemanticCacheOracle.digestPayload('{"temp": 25.0, "condition": "rain"}');

  assert.equal(digest1, digest2);
  assert.notEqual(digest1, digest3);
  assert.equal(digest1.length, 64);
});

test('register rejects empty prompt, nonpositive base price, or out-of-range discount bps', () => {
  const oracle = new SemanticCacheOracle();

  assert.throws(() => {
    oracle.register({
      prompt: '   ',
      responsePayload: 'data',
      provider: providerA,
      basePriceUsd: 0.001,
    });
  }, /prompt cannot be empty/i);

  assert.throws(() => {
    oracle.register({
      prompt: 'valid prompt',
      responsePayload: 'data',
      provider: providerA,
      basePriceUsd: 0,
    });
  }, /base price must be greater than zero/i);

  assert.throws(() => {
    oracle.register({
      prompt: 'valid prompt',
      responsePayload: 'data',
      provider: providerA,
      basePriceUsd: 0.001,
      discountBps: 9800, // over max 9500
    });
  }, /discount bps must be between 0 and 9500/i);

  assert.throws(() => {
    oracle.register({
      prompt: 'valid prompt',
      responsePayload: 'data',
      provider: providerA,
      basePriceUsd: 0.001,
      ttlSeconds: 0,
    });
  }, /ttl must be greater than zero/i);
});

test('lookup returns NOT_FOUND for unknown prompt or provider', () => {
  const oracle = new SemanticCacheOracle();
  oracle.register({
    prompt: 'Query Solana APR',
    responsePayload: '12.4%',
    provider: providerA,
    basePriceUsd: 0.001,
  });

  const res1 = oracle.lookup('Query Ethereum APR', providerA);
  assert.equal(res1.hit, false);
  assert.equal(res1.reason, 'NOT_FOUND');

  const res2 = oracle.lookup('Query Solana APR', providerB);
  assert.equal(res2.hit, false);
  assert.equal(res2.reason, 'NOT_FOUND');
});

test('lookup returns CACHE_HIT with 80% discount and accurate effective price', () => {
  const oracle = new SemanticCacheOracle();
  const prompt = 'Estimate gas price on Kite testnet';
  const responsePayload = JSON.stringify({ gwei: 1.5, fast: 2.0 });

  oracle.register({
    prompt,
    responsePayload,
    provider: providerA,
    basePriceUsd: 0.001,
    discountBps: 8000, // 80% discount
  });

  const res = oracle.lookup(prompt, providerA);
  assert.equal(res.hit, true);
  assert.equal(res.effectivePriceUsd, 0.0002);
  assert.equal(res.savingsUsd, 0.0008);
  assert.ok(res.proof);
  assert.equal(res.proof.effectivePriceUsd, 0.0002);
  assert.equal(res.proof.discountBps, 8000);

  // Verify cryptographic proof
  const isValid = SemanticCacheOracle.verifyProof(res.proof);
  assert.equal(isValid, true);
});

test('expired cache entry returns EXPIRED and does not grant discount', () => {
  const oracle = new SemanticCacheOracle();
  const prompt = 'Short-lived AI trade signal';

  oracle.register({
    prompt,
    responsePayload: 'BUY',
    provider: providerA,
    basePriceUsd: 0.005,
    ttlSeconds: 60,
  });

  const pastNow = Math.floor(Date.now() / 1000) + 120; // 2 minutes later
  const res = oracle.lookup(prompt, providerA, pastNow);

  assert.equal(res.hit, false);
  assert.equal(res.reason, 'EXPIRED');
});

test('verifyProof fails if expired or tampered', () => {
  const oracle = new SemanticCacheOracle();
  const prompt = 'Deterministic proof check';

  oracle.register({
    prompt,
    responsePayload: 'answer',
    provider: providerA,
    basePriceUsd: 0.002,
    discountBps: 5000,
  });

  const res = oracle.lookup(prompt, providerA);
  assert.ok(res.proof);

  // Tampered price
  const tamperedProof = { ...res.proof, effectivePriceUsd: 0.0001 };
  assert.equal(SemanticCacheOracle.verifyProof(tamperedProof), false);

  // Expired proof
  const expiredTime = res.proof.validUntil + 10;
  assert.equal(SemanticCacheOracle.verifyProof(res.proof, expiredTime), false);
});

test('invalidate and invalidateByProvider purge entries and update metrics', () => {
  const oracle = new SemanticCacheOracle();

  const e1 = oracle.register({
    prompt: 'Query A',
    responsePayload: '1',
    provider: providerA,
    basePriceUsd: 0.001,
  });
  oracle.register({
    prompt: 'Query B',
    responsePayload: '2',
    provider: providerA,
    basePriceUsd: 0.001,
  });
  oracle.register({
    prompt: 'Query C',
    responsePayload: '3',
    provider: providerB,
    basePriceUsd: 0.001,
  });

  assert.equal(oracle.getMetrics().activeEntries, 3);

  // Invalidate single
  const removed = oracle.invalidate(e1.cacheKey);
  assert.equal(removed, true);
  assert.equal(oracle.getMetrics().activeEntries, 2);

  // Invalidate by provider
  const purged = oracle.invalidateByProvider(providerA);
  assert.equal(purged, 1);
  assert.equal(oracle.getMetrics().activeEntries, 1);

  // Provider B remains
  const resB = oracle.lookup('Query C', providerB);
  assert.equal(resB.hit, true);
});

test('telemetry tracks lookups, hits, misses, hit ratio and cumulative USD saved', () => {
  const oracle = new SemanticCacheOracle();

  oracle.register({
    prompt: 'Popular prompt',
    responsePayload: 'cached output',
    provider: providerA,
    basePriceUsd: 0.001,
    discountBps: 8000,
  });

  oracle.lookup('Popular prompt', providerA); // Hit 1
  oracle.lookup('Popular prompt', providerA); // Hit 2
  oracle.lookup('Miss prompt 1', providerA);  // Miss 1
  oracle.lookup('Miss prompt 2', providerA);  // Miss 2

  const metrics = oracle.getMetrics();
  assert.equal(metrics.totalLookups, 4);
  assert.equal(metrics.totalHits, 2);
  assert.equal(metrics.totalMisses, 2);
  assert.equal(metrics.hitRatio, 0.5);
  assert.equal(metrics.totalUsdSaved, 0.0016);
});
