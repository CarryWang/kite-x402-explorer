import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateInsurancePremium } from '../src/lib/agent-collateral-insurance.js';

test('every valid integer reputation score uses exact rational premium arithmetic', () => {
  for (const score of [1, 499, 501, 999]) {
    const amount = 10n ** 24n + 999n;
    const expected = amount * 200n * BigInt(10000 + (500 - score) * 10) / 100_000_000n;
    assert.equal(calculateInsurancePremium({ insuredAmountWei: amount, providerReputationScore: score }), expected);
  }
});

test('invalid score numbers are rejected deliberately and legacy clamping/defaults are retained', () => {
  for (const score of [NaN, Infinity, 0.5]) {
    assert.throws(() => calculateInsurancePremium({ insuredAmountWei: 10000n, providerReputationScore: score }), /reputation|score/i);
  }
  for (const [score, expected] of [[0, 300n], [500, 200n], [1000, 100n], [-1, 300n], [1001, 100n]] as const) {
    assert.equal(calculateInsurancePremium({ insuredAmountWei: 10000n, providerReputationScore: score }), expected);
  }
  assert.equal(calculateInsurancePremium({ insuredAmountWei: 10000n }), 200n);
});
