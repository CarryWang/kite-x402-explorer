import test from 'node:test';
import assert from 'node:assert/strict';
const A = '0x1111111111111111111111111111111111111111' as const;
const B = '0x2222222222222222222222222222222222222222' as const;
const C = '0x3333333333333333333333333333333333333333' as const;
import { SemanticCacheOracle } from '../src/lib/semantic-cache-oracle.js';

function oracle() {
  const instance = new SemanticCacheOracle('local-only-fixture-key');
  instance.register({ prompt: 'task', responsePayload: 'result', provider: A, basePriceUsd: 1, ttlSeconds: 100 });
  return instance;
}

test('non-finite and negative proof clocks cannot authenticate an expired discount entitlement', () => {
  const instance = oracle();
  const proof = instance.lookup('task', A).proof!;
  for (const now of [NaN, Infinity, -1]) assert.equal(instance.verifyIssuedProof(proof, now), false);
});

test('invalid lookup clocks fail before changing cache telemetry', () => {
  const instance = oracle();
  const before = instance.getMetrics();
  assert.throws(() => instance.lookup('task', A, NaN), /time|clock/i);
  assert.deepEqual(instance.getMetrics(), before);
});

test('unrepresentable lifetimes are rejected before a cache entry is installed', () => {
  const instance = new SemanticCacheOracle();
  assert.throws(() => instance.register({ prompt: 'task', responsePayload: 'result', provider: A,
    basePriceUsd: 1, ttlSeconds: Number.MAX_SAFE_INTEGER }), /time|TTL|expiry|lifetime/i);
  assert.equal(instance.getMetrics().activeEntries, 0);
});

test('valid issued proofs remain usable before and rejected at their deadline', () => {
  const instance = oracle();
  const result = instance.lookup('task', A);
  assert.equal(instance.verifyIssuedProof(result.proof!, result.entry!.cachedAt), true);
  assert.equal(instance.verifyIssuedProof(result.proof!, result.entry!.expiresAt), false);
});
