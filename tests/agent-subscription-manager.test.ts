import { describe, it, expect } from './vitest-compat.js';
import { AgentSubscriptionManager } from '../src/lib/agent-subscription-manager';

describe('AgentSubscriptionManager', () => {
  it('registers plan and activates agent subscription', () => {
    const manager = new AgentSubscriptionManager(() => true);
    const plan = manager.registerPlan('plan-basic', 'Basic Inference', 10_000_000n, 'DAILY', 100);
    expect(plan.planId).toBe('plan-basic');

    const sub = manager.subscribe('0xAgentA', '0xProviderB', 'plan-basic', '0xtx1');
    expect(sub.status).toBe('ACTIVE');
    expect(sub.totalSettledAmountAtomic).toBe(10_000_000n);
    expect(sub.callsConsumedThisPeriod).toBe(0);
  });

  it('enforces call quotas within period', () => {
    const manager = new AgentSubscriptionManager(() => true);
    manager.registerPlan('plan-micro', 'Micro Plan', 1_000_000n, 'DAILY', 2);
    const sub = manager.subscribe('0xAgentA', '0xProviderB', 'plan-micro', '0xtx1');

    const call1 = manager.recordCall(sub.subscriptionId);
    expect(call1.allowed).toBe(true);
    expect(call1.remainingCalls).toBe(1);

    const call2 = manager.recordCall(sub.subscriptionId);
    expect(call2.allowed).toBe(true);
    expect(call2.remainingCalls).toBe(0);

    const call3 = manager.recordCall(sub.subscriptionId);
    expect(call3.allowed).toBe(false);
    expect(call3.reason).toContain('quota exceeded');
  });

  it('renews subscription and resets period quotas', () => {
    const manager = new AgentSubscriptionManager(() => true);
    manager.registerPlan('plan-micro', 'Micro Plan', 1_000_000n, 'DAILY', 5);
    const sub = manager.subscribe('0xAgentA', '0xProviderB', 'plan-micro', '0xtx1');

    manager.recordCall(sub.subscriptionId);
    const originalNow = Date.now;
    Date.now = () => sub.currentPeriodEnd + 1;
    try {
      manager.renew(sub.subscriptionId, '0xtx2');
    } finally {
      Date.now = originalNow;
    }

    const updated = manager.getSubscription(sub.subscriptionId);
    expect(updated?.callsConsumedThisPeriod).toBe(0);
    expect(updated?.totalSettledAmountAtomic).toBe(2_000_000n);
  });

  it('requires verified unique payment and rejects early renewal', () => {
    const manager = new AgentSubscriptionManager(() => true);
    manager.registerPlan('p', 'Plan', 10n, 'DAILY', 1);
    const sub = manager.subscribe('a', 'b', 'p', 'tx1');
    expect(() => manager.renew(sub.subscriptionId, 'tx2')).toThrow(/period/);
    const originalNow = Date.now;
    Date.now = () => sub.currentPeriodEnd + 1;
    try {
      expect(() => manager.renew(sub.subscriptionId, 'tx1')).toThrow(/already used/);
      manager.renew(sub.subscriptionId, 'tx2');
    } finally {
      Date.now = originalNow;
    }
    expect(() => manager.renew(sub.subscriptionId, 'tx3')).toThrow(/period/);
    const unverified = new AgentSubscriptionManager();
    unverified.registerPlan('p', 'Plan', 10n, 'DAILY');
    expect(() => unverified.subscribe('a', 'b', 'p', 'tx4')).toThrow(/verification/);
  });

  it('does not expose mutable plans or subscriptions', () => {
    const manager = new AgentSubscriptionManager(() => true);
    const plan = manager.registerPlan('immutable', 'Plan', 10n, 'DAILY', 1);
    plan.maxCallsPerInterval = 100;
    plan.priceAtomic = 0n;
    const sub = manager.subscribe('a', 'b', 'immutable', 'tx-immutable');
    expect(sub.priceAtomic).toBe(10n);
    sub.status = 'CANCELLED';
    sub.callsConsumedThisPeriod = -100;
    sub.currentPeriodEnd = 0;
    expect(manager.recordCall(sub.subscriptionId).allowed).toBe(true);
    expect(manager.recordCall(sub.subscriptionId).allowed).toBe(false);
    const fetched = manager.getSubscription(sub.subscriptionId)!;
    fetched.status = 'ACTIVE';
    fetched.callsConsumedThisPeriod = 0;
    expect(manager.recordCall(sub.subscriptionId).allowed).toBe(false);
  });
});
