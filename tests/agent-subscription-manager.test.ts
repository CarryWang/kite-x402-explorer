import { describe, it, expect } from 'vitest';
import { AgentSubscriptionManager } from '../src/lib/agent-subscription-manager';

describe('AgentSubscriptionManager', () => {
  it('registers plan and activates agent subscription', () => {
    const manager = new AgentSubscriptionManager();
    const plan = manager.registerPlan('plan-basic', 'Basic Inference', 10_000_000n, 'DAILY', 100);
    expect(plan.planId).toBe('plan-basic');

    const sub = manager.subscribe('0xAgentA', '0xProviderB', 'plan-basic', '0xtx1');
    expect(sub.status).toBe('ACTIVE');
    expect(sub.totalSettledAmountAtomic).toBe(10_000_000n);
    expect(sub.callsConsumedThisPeriod).toBe(0);
  });

  it('enforces call quotas within period', () => {
    const manager = new AgentSubscriptionManager();
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
    const manager = new AgentSubscriptionManager();
    manager.registerPlan('plan-micro', 'Micro Plan', 1_000_000n, 'DAILY', 5);
    const sub = manager.subscribe('0xAgentA', '0xProviderB', 'plan-micro', '0xtx1');

    manager.recordCall(sub.subscriptionId);
    manager.renew(sub.subscriptionId, '0xtx2');

    const updated = manager.getSubscription(sub.subscriptionId);
    expect(updated?.callsConsumedThisPeriod).toBe(0);
    expect(updated?.totalSettledAmountAtomic).toBe(2_000_000n);
  });
});
