import test from 'node:test';
import assert from 'node:assert/strict';
const A = '0x1111111111111111111111111111111111111111' as const;
const B = '0x2222222222222222222222222222222222222222' as const;
const C = '0x3333333333333333333333333333333333333333' as const;
import { createMarketOracle } from '../src/lib/dynamic-fee-market-oracle.js';

function oracle() { const value = createMarketOracle(undefined, 'local-key'); value.registerProvider(A, 100, 2000n, 1000); return value; }

test('quote verification rejects non-finite clocks and the exact expiry deadline', () => {
  const value = oracle();
  const quote = value.generateQuote({ providerAddress: A, clientAddress: B, priorityTier: 'standard' }, 1000);
  for (const now of [NaN, Infinity, -1, quote.expiresAtTimestamp]) assert.equal(value.verifyQuote(quote, now).valid, false);
  assert.equal(value.verifyQuote(quote, quote.expiresAtTimestamp - 1).valid, true);
});

test('invalid update and quote clocks do not alter installed market state or quote counters', () => {
  const value = oracle();
  const before = value.getMarketState(A);
  assert.throws(() => value.updateUtilization(A, 50, NaN), /time|clock/i);
  assert.deepEqual(value.getMarketState(A), before);
  assert.throws(() => value.generateQuote({ providerAddress: A, clientAddress: B, priorityTier: 'standard' }, NaN), /time|clock/i);
  assert.deepEqual(value.getMarketState(A), before);
});

test('an unrepresentable quote deadline is rejected before publishing a quote', () => {
  const value = oracle();
  assert.throws(() => value.generateQuote({ providerAddress: A, clientAddress: B, priorityTier: 'standard' }, Number.MAX_SAFE_INTEGER), /time|clock|expiry|deadline/i);
  assert.equal(value.getMarketState(A)?.totalQuotesIssued, 0);
});
