import test from 'node:test';
import assert from 'node:assert/strict';
import { createSubscription, recordSubscriptionUsage, calculateProratedRefund, getSubscriptionSummary,
  processSubscriptionRenewal, type SubscriptionPlan } from '../src/lib/micro-subscription-manager.js';

const plan: SubscriptionPlan = { planId: 'paid-plan', provider: '0x1111111111111111111111111111111111111111',
  cadence: 'custom', periodDurationMs: 1000, baseCostWei: 10n, includedUnits: 0,
  overageUnitPriceWei: 2n, maxSpendCapWei: 20n, title: 'Local plan', createdAt: 1000 };
function subscription() {
  return createSubscription(plan, '0x2222222222222222222222222222222222222222', {
    startTimestamp: 1000, verifyInitialPayment: () => true,
  });
}

test('usage, refund and summary cannot substitute another plan or provider', () => {
  for (const wrong of [{ ...plan, planId: 'other', overageUnitPriceWei: 0n },
    { ...plan, provider: '0x3333333333333333333333333333333333333333' as const }]) {
    const sub = subscription();
    const before = { ...sub };
    assert.throws(() => recordSubscriptionUsage(sub, wrong, 1, 1500), /plan mismatch/i);
    assert.throws(() => calculateProratedRefund(sub, wrong, 1500), /plan mismatch/i);
    assert.throws(() => getSubscriptionSummary(sub, wrong, 1500), /plan mismatch/i);
    assert.deepEqual(sub, before);
  }
});

test('matching identity keeps usage math, refunds, summaries and renewal working', () => {
  const sub = subscription();
  assert.equal(recordSubscriptionUsage(sub, plan, 2, 1500).chargeWei, 4n);
  assert.equal(calculateProratedRefund(sub, plan, 1500), 5n);
  assert.equal(getSubscriptionSummary(sub, plan, 1500).remainingSpendCapWei, 6n);
  const result = processSubscriptionRenewal(sub, plan, { paymentSuccess: true, currentTimestamp: 2000, verifyPayment: () => true });
  assert.equal(result.invoice.totalAmountWei, 14n);
});
