import test from 'node:test';
import assert from 'node:assert/strict';
import { AgentSubscriptionManager } from '../src/lib/agent-subscription-manager.js';

test('renewal records the current verified plan price in both price and lifetime totals', () => {
  const realNow = Date.now;
  let now = 1_000_000;
  Date.now = () => now;
  try {
    const verified: bigint[] = [];
    const manager = new AgentSubscriptionManager((_tx, payment) => { verified.push(payment.amountAtomic); return true; });
    manager.registerPlan('p', 'Plan', 10n, 'DAILY', 2);
    const sub = manager.subscribe('a', 'b', 'p', 'fixture-first');
    manager.registerPlan('p', 'Plan revised', 25n, 'WEEKLY', 4);
    now = sub.currentPeriodEnd;
    const renewed = manager.renew(sub.subscriptionId, 'fixture-next');
    assert.deepEqual(verified, [10n, 25n]);
    assert.equal(renewed.priceAtomic, 25n);
    assert.equal(renewed.totalSettledAmountAtomic, 35n);
    assert.equal(manager.getSubscription(sub.subscriptionId)?.priceAtomic, 25n);
    assert.equal(renewed.currentPeriodEnd - renewed.currentPeriodStart, 7 * 86400_000);
  } finally { Date.now = realNow; }
});

test('old-period access ends exactly when renewal becomes due, without consuming another call', () => {
  const realNow = Date.now;
  let now = 1_000_000;
  Date.now = () => now;
  try {
    const manager = new AgentSubscriptionManager(() => true);
    manager.registerPlan('p', 'Plan', 10n, 'DAILY', 2);
    const sub = manager.subscribe('a', 'b', 'p', 'fixture-first');
    now = sub.currentPeriodEnd - 1;
    assert.equal(manager.recordCall(sub.subscriptionId).allowed, true);
    now++;
    assert.equal(manager.recordCall(sub.subscriptionId).allowed, false);
    assert.equal(manager.getSubscription(sub.subscriptionId)?.callsConsumedThisPeriod, 1);
    manager.renew(sub.subscriptionId, 'fixture-next');
    assert.equal(manager.recordCall(sub.subscriptionId).allowed, true);
  } finally { Date.now = realNow; }
});
