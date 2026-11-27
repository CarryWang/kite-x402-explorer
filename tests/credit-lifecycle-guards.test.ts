import test from 'node:test';
import assert from 'node:assert/strict';
import { consumeCredit, settleCreditDebt, type CreditLineProfile } from '../src/lib/zk-reputation-credit.js';

function profile(): CreditLineProfile {
  return { agentAddress: '0x1111111111111111111111111111111111111111', tier: 'gold', maxCreditLimitWei: 100n,
    utilizedCreditWei: 20n, availableCreditWei: 80n, isEligibleForPostSettlement: true, expiresAtTimestamp: 1000 };
}

test('credit approved earlier cannot be drawn after its attestation lifetime ends', () => {
  const realNow = Date.now;
  Date.now = () => 1_001_000;
  try { assert.throws(() => consumeCredit(profile(), 10n), /expired/i); }
  finally { Date.now = realNow; }
});

test('a disabled credit profile cannot draw despite a positive cached balance', () => {
  const realNow = Date.now;
  Date.now = () => 900_000;
  try { assert.throws(() => consumeCredit({ ...profile(), isEligibleForPostSettlement: false }, 10n), /eligible|disabled/i); }
  finally { Date.now = realNow; }
});

test('negative debt settlement cannot increase utilized credit beyond the limit', () => {
  const original = profile();
  assert.throws(() => settleCreditDebt(original, -100n), /negative|non-negative/i);
  assert.deepEqual(original, profile());
});

test('active draws, zero no-ops and paying expired debt preserve balance conservation', () => {
  const realNow = Date.now;
  Date.now = () => 900_000;
  try {
    const drawn = consumeCredit(profile(), 30n);
    assert.equal(drawn.availableCreditWei + drawn.utilizedCreditWei, drawn.maxCreditLimitWei);
    assert.deepEqual(consumeCredit(drawn, 0n), drawn);
    Date.now = () => 1_001_000;
    const settled = settleCreditDebt(drawn, 999n);
    assert.equal(settled.utilizedCreditWei, 0n);
    assert.equal(settled.availableCreditWei, 100n);
  } finally { Date.now = realNow; }
});
