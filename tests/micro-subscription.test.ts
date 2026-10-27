import assert from 'node:assert/strict';
import test from 'node:test';
import {
  type SubscriptionPlan,
  type SubscriptionRecord,
  validateSubscriptionPlan,
  computePeriodDurationMs,
  createSubscription as createSubscriptionVerified,
  recordSubscriptionUsage,
  pauseSubscription,
  resumeSubscription,
  cancelSubscription,
  calculateProratedRefund,
  getSubscriptionSummary,
  processSubscriptionRenewal,
  disputeRenewalInvoice,
  generateRenewalDigest,
} from '../src/lib/micro-subscription-manager.ts';

const provider = '0x1111111111111111111111111111111111111111' as const;
const subscriber = '0x2222222222222222222222222222222222222222' as const;
const createSubscription = (plan: Parameters<typeof createSubscriptionVerified>[0], subscriberAddress: Parameters<typeof createSubscriptionVerified>[1], options?: Parameters<typeof createSubscriptionVerified>[2]) => createSubscriptionVerified(plan, subscriberAddress, { ...options, verifyInitialPayment: () => true });

function createSamplePlan(overrides?: Partial<SubscriptionPlan>): SubscriptionPlan {
  return {
    planId: 'plan_daily_inference',
    provider,
    cadence: 'daily',
    periodDurationMs: 86400 * 1000,
    baseCostWei: 10_000_000_000_000_000n, // 0.01 token
    includedUnits: 100,
    overageUnitPriceWei: 200_000_000_000_000n, // 0.0002 token per unit
    maxSpendCapWei: 50_000_000_000_000_000n, // 0.05 token cap
    title: 'Daily Inference Plan',
    createdAt: 1_700_000_000_000,
    ...overrides,
  };
}

test('validates subscription plan constraints correctly', () => {
  const validPlan = createSamplePlan();
  assert.doesNotThrow(() => validateSubscriptionPlan(validPlan));

  assert.throws(
    () => validateSubscriptionPlan(createSamplePlan({ planId: '' })),
    /planId must not be empty/i
  );
  assert.throws(
    () => validateSubscriptionPlan(createSamplePlan({ provider: '0xinvalid' as any })),
    /invalid provider address/i
  );
  assert.throws(
    () => validateSubscriptionPlan(createSamplePlan({ periodDurationMs: 0 })),
    /period duration must be strictly positive/i
  );
  assert.throws(
    () => validateSubscriptionPlan(createSamplePlan({ baseCostWei: -1n })),
    /base plan cost cannot be negative/i
  );
  assert.throws(
    () => validateSubscriptionPlan(createSamplePlan({ baseCostWei: 100n, maxSpendCapWei: 50n })),
    /base cost cannot exceed maximum period spend cap/i
  );
});

test('computes period duration milliseconds for all cadence types', () => {
  assert.equal(computePeriodDurationMs('hourly'), 3600 * 1000);
  assert.equal(computePeriodDurationMs('daily'), 86400 * 1000);
  assert.equal(computePeriodDurationMs('weekly'), 7 * 86400 * 1000);
  assert.equal(computePeriodDurationMs('monthly'), 30 * 86400 * 1000);
  assert.equal(computePeriodDurationMs('custom', 15000), 15000);
  assert.throws(() => computePeriodDurationMs('custom', 0), /strictly positive/i);
});

test('creates subscription and enforces subscriber-provider segregation', () => {
  const plan = createSamplePlan();
  const startTime = 1_700_000_000_000;
  const sub = createSubscription(plan, subscriber, { startTimestamp: startTime });

  assert.equal(sub.planId, plan.planId);
  assert.equal(sub.subscriber, subscriber);
  assert.equal(sub.provider, provider);
  assert.equal(sub.status, 'active');
  assert.equal(sub.currentPeriodStart, startTime);
  assert.equal(sub.currentPeriodEnd, startTime + 86400 * 1000);
  assert.equal(sub.periodSpendWei, plan.baseCostWei);
  assert.equal(sub.periodUnitsConsumed, 0);

  // Subscriber cannot be identical to provider
  assert.throws(
    () => createSubscription(plan, provider),
    /subscriber cannot be identical to provider/i
  );
});

test('records usage within included quota without incurring overage fees', () => {
  const plan = createSamplePlan();
  const startTime = 1_700_000_000_000;
  const sub = createSubscription(plan, subscriber, { startTimestamp: startTime });

  const result = recordSubscriptionUsage(sub, plan, 50, startTime + 1000);
  assert.equal(result.approved, true);
  assert.equal(result.chargeWei, 0n);
  assert.equal(sub.periodUnitsConsumed, 50);
  assert.equal(sub.periodSpendWei, plan.baseCostWei);
});

test('records usage with overage fee when included quota is exhausted', () => {
  const plan = createSamplePlan();
  const startTime = 1_700_000_000_000;
  const sub = createSubscription(plan, subscriber, { startTimestamp: startTime });

  // Consume 100 included units
  recordSubscriptionUsage(sub, plan, 100, startTime + 1000);

  // Consume 10 additional units -> 10 * 200_000_000_000_000 = 2_000_000_000_000_000
  const overageResult = recordSubscriptionUsage(sub, plan, 10, startTime + 2000);
  assert.equal(overageResult.approved, true);
  assert.equal(overageResult.chargeWei, 2_000_000_000_000_000n);
  assert.equal(sub.periodUnitsConsumed, 110);
  assert.equal(sub.periodSpendWei, plan.baseCostWei + 2_000_000_000_000_000n);
});

test('rejects usage request that exceeds max period spend cap', () => {
  const plan = createSamplePlan();
  const startTime = 1_700_000_000_000;
  const sub = createSubscription(plan, subscriber, { startTimestamp: startTime });

  // Trying to consume 10,000 units would far exceed 0.05 token cap
  const result = recordSubscriptionUsage(sub, plan, 10000, startTime + 1000);
  assert.equal(result.approved, false);
  assert.match(result.rejectionReason!, /maximum spend cap/i);
});

test('rejects usage when subscription is paused or outside period window', () => {
  const plan = createSamplePlan();
  const startTime = 1_700_000_000_000;
  const sub = createSubscription(plan, subscriber, { startTimestamp: startTime });

  // Out of period window
  const outOfWindow = recordSubscriptionUsage(sub, plan, 10, startTime + 90000 * 1000);
  assert.equal(outOfWindow.approved, false);
  assert.match(outOfWindow.rejectionReason!, /outside current subscription billing window/i);

  // Paused status
  const paused = pauseSubscription(sub);
  const pausedUsage = recordSubscriptionUsage(paused, plan, 10, startTime + 1000);
  assert.equal(pausedUsage.approved, false);
  assert.match(pausedUsage.rejectionReason!, /not active/i);
});

test('handles subscription lifecycle state transitions', () => {
  const plan = createSamplePlan();
  const startTime = 1_700_000_000_000;
  const sub = createSubscription(plan, subscriber, { startTimestamp: startTime });

  const paused = pauseSubscription(sub);
  assert.equal(paused.status, 'paused');

  const resumed = resumeSubscription(paused, startTime + 1000);
  assert.equal(resumed.status, 'active');

  const cancelled = cancelSubscription(resumed);
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(cancelled.autoRenew, false);

  assert.throws(() => cancelSubscription(cancelled), /already cancelled/i);
});

test('processes successful subscription period renewal and generates settlement invoice', () => {
  const plan = createSamplePlan();
  const startTime = 1_700_000_000_000;
  const sub = createSubscription(plan, subscriber, { startTimestamp: startTime });

  // Consume some units
  recordSubscriptionUsage(sub, plan, 120, startTime + 5000);
  const totalSpend = sub.periodSpendWei;

  const renewalTime = sub.currentPeriodEnd;
  const { updatedSubscription, invoice } = processSubscriptionRenewal(sub, plan, {
    paymentSuccess: true,
    currentTimestamp: renewalTime,
    verifyPayment: () => true,
  });

  assert.equal(invoice.status, 'paid');
  assert.equal(invoice.totalAmountWei, totalSpend);
  assert.equal(invoice.unitsUsed, 120);
  assert.ok(invoice.settlementDigest.startsWith('0x'));

  assert.equal(updatedSubscription.status, 'active');
  assert.equal(updatedSubscription.currentPeriodStart, renewalTime);
  assert.equal(updatedSubscription.currentPeriodEnd, renewalTime + plan.periodDurationMs);
  assert.equal(updatedSubscription.periodUnitsConsumed, 0);
  assert.equal(updatedSubscription.periodSpendWei, plan.baseCostWei);
  assert.equal(updatedSubscription.lifetimeSettledWei, totalSpend);
});

test('transitions subscription to delinquent upon repeated renewal failures', () => {
  const plan = createSamplePlan();
  const startTime = 1_700_000_000_000;
  const sub = createSubscription(plan, subscriber, {
    startTimestamp: startTime,
    maxRetryAttempts: 2,
  });

  // First failed renewal
  const res1 = processSubscriptionRenewal(sub, plan, {
    paymentSuccess: false,
    currentTimestamp: sub.currentPeriodEnd,
  });
  assert.equal(res1.invoice.status, 'failed');
  assert.equal(res1.updatedSubscription.status, 'active');
  assert.equal(res1.updatedSubscription.consecutiveFailedRenewals, 1);

  // Second failed renewal -> reaches maxRetryAttempts (2)
  const res2 = processSubscriptionRenewal(res1.updatedSubscription, plan, {
    paymentSuccess: false,
    currentTimestamp: sub.currentPeriodEnd,
  });
  assert.equal(res2.invoice.status, 'failed');
  assert.equal(res2.updatedSubscription.status, 'delinquent');
  assert.equal(res2.updatedSubscription.consecutiveFailedRenewals, 2);
});

test('handles invoice dispute and pauses active subscription', () => {
  const plan = createSamplePlan();
  const startTime = 1_700_000_000_000;
  const sub = createSubscription(plan, subscriber, { startTimestamp: startTime });

  const { updatedSubscription, invoice } = processSubscriptionRenewal(sub, plan, {
    paymentSuccess: true,
    currentTimestamp: sub.currentPeriodEnd,
    verifyPayment: () => true,
  });

  const { updatedInvoice, updatedSubscription: disputedSub } = disputeRenewalInvoice(
    invoice,
    updatedSubscription,
    'Billing calculation mismatch on unmetered batch'
  );

  assert.equal(updatedInvoice.status, 'disputed');
  assert.equal(updatedInvoice.disputedReason, 'Billing calculation mismatch on unmetered batch');
  assert.equal(disputedSub.status, 'paused');
});

test('calculates accurate pro-rated refunds and telemetry summary', () => {
  const plan = createSamplePlan();
  const startTime = 1_700_000_000_000;
  const sub = createSubscription(plan, subscriber, { startTimestamp: startTime });

  // At beginning of period: 100% of base cost
  const fullRefund = calculateProratedRefund(sub, plan, startTime);
  assert.equal(fullRefund, plan.baseCostWei);

  // Mid-way through period (50% elapsed)
  const midTime = startTime + plan.periodDurationMs / 2;
  const midRefund = calculateProratedRefund(sub, plan, midTime);
  assert.equal(midRefund, plan.baseCostWei / 2n);

  // Telemetry summary
  recordSubscriptionUsage(sub, plan, 40, startTime + 1000);
  const summary = getSubscriptionSummary(sub, plan, startTime + 1000);
  assert.equal(summary.remainingIncludedUnits, 60);
  assert.equal(summary.effectiveUsageRate, 0.4);
  assert.equal(summary.isRenewalDue, false);
});

test('renewal rejects canceled and premature subscriptions', () => {
  const plan = createSamplePlan();
  const sub = createSubscription(plan, subscriber, { startTimestamp: 1000 });
  assert.throws(() => processSubscriptionRenewal(cancelSubscription(sub), plan, { paymentSuccess: true, currentTimestamp: sub.currentPeriodEnd }), /active|renew/i);
  assert.throws(() => processSubscriptionRenewal(sub, plan, { paymentSuccess: true, currentTimestamp: 1001 }), /due|period/i);
});

test('refund retains wei precision for large balances', () => {
  const plan = createSamplePlan({ baseCostWei: 100_000_000_000_000_000_003n, maxSpendCapWei: 100_000_000_000_000_000_003n });
  const sub = createSubscription(plan, subscriber, { startTimestamp: 0 });
  const now = plan.periodDurationMs / 4;
  assert.equal(calculateProratedRefund(sub, plan, now), plan.baseCostWei * 3n / 4n);
});

test('paid renewal requires a trusted payment verifier', () => {
  const plan = createSamplePlan();
  const sub = createSubscription(plan, subscriber, { startTimestamp: 1000 });
  assert.throws(() => processSubscriptionRenewal(sub, plan, { paymentSuccess: true, currentTimestamp: sub.currentPeriodEnd }), /verification/i);
});

test('positive-cost subscription does not activate without verified initial payment', () => {
  const plan = createSamplePlan();
  assert.throws(() => createSubscriptionVerified(plan, subscriber, { startTimestamp: 1000 }), /initial payment|verif/i);
});
