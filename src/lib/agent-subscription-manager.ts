/**
 * Autonomous AI Agent Recurring Subscription & Allowance Manager for x402 services.
 * Allows agents to establish periodic billing agreements, track allowance budgets,
 * and renew service capabilities without manual human intervention.
 */

export type SubscriptionInterval = 'DAILY' | 'WEEKLY' | 'MONTHLY';
export type SubscriptionStatus = 'ACTIVE' | 'PAUSED' | 'CANCELLED' | 'EXPIRED';

export interface SubscriptionPlan {
  planId: string;
  name: string;
  priceAtomic: bigint;
  interval: SubscriptionInterval;
  intervalMs: number;
  maxCallsPerInterval: number;
}

export interface AgentSubscription {
  subscriptionId: string;
  subscriberAgent: string;
  providerAgent: string;
  planId: string;
  priceAtomic: bigint;
  status: SubscriptionStatus;
  startedAt: number;
  currentPeriodStart: number;
  currentPeriodEnd: number;
  callsConsumedThisPeriod: number;
  totalSettledAmountAtomic: bigint;
  lastRenewalTxHash?: string;
}

const INTERVAL_MS: Record<SubscriptionInterval, number> = {
  DAILY: 24 * 60 * 60 * 1000,
  WEEKLY: 7 * 24 * 60 * 60 * 1000,
  MONTHLY: 30 * 24 * 60 * 60 * 1000,
};

export class AgentSubscriptionManager {
  private plans: Map<string, SubscriptionPlan> = new Map();
  private subscriptions: Map<string, AgentSubscription> = new Map();
  private usedPaymentTxHashes: Set<string> = new Set();

  constructor(private readonly verifyPayment?: (
    txHash: string,
    payment: Readonly<{ subscriberAgent: string; providerAgent: string; planId: string; amountAtomic: bigint }>
  ) => boolean) {}

  /**
   * Registers a subscription plan.
   */
  public registerPlan(
    planId: string,
    name: string,
    priceAtomic: bigint,
    interval: SubscriptionInterval,
    maxCallsPerInterval: number = 1000
  ): SubscriptionPlan {
    if (priceAtomic <= 0n || !Number.isSafeInteger(maxCallsPerInterval) || maxCallsPerInterval <= 0 || !INTERVAL_MS[interval]) {
      throw new Error('Invalid subscription plan');
    }
    const plan: SubscriptionPlan = {
      planId,
      name,
      priceAtomic,
      interval,
      intervalMs: INTERVAL_MS[interval],
      maxCallsPerInterval,
    };
    this.plans.set(planId, plan);
    return { ...plan };
  }

  /**
   * Subscribes an agent to a plan.
   */
  public subscribe(
    subscriberAgent: string,
    providerAgent: string,
    planId: string,
    initialPaymentTxHash: string
  ): AgentSubscription {
    const plan = this.plans.get(planId);
    if (!plan) {
      throw new Error(`Plan ${planId} not found`);
    }
    this.assertVerifiedPayment(initialPaymentTxHash, {
      subscriberAgent: subscriberAgent.toLowerCase(), providerAgent: providerAgent.toLowerCase(),
      planId, amountAtomic: plan.priceAtomic,
    });

    const now = Date.now();
    const subscriptionId = `sub_${now}_${Math.random().toString(36).substring(2, 8)}`;

    const sub: AgentSubscription = {
      subscriptionId,
      subscriberAgent: subscriberAgent.toLowerCase(),
      providerAgent: providerAgent.toLowerCase(),
      planId,
      priceAtomic: plan.priceAtomic,
      status: 'ACTIVE',
      startedAt: now,
      currentPeriodStart: now,
      currentPeriodEnd: now + plan.intervalMs,
      callsConsumedThisPeriod: 0,
      totalSettledAmountAtomic: plan.priceAtomic,
      lastRenewalTxHash: initialPaymentTxHash,
    };

    this.subscriptions.set(subscriptionId, sub);
    this.usedPaymentTxHashes.add(initialPaymentTxHash.toLowerCase());
    return { ...sub };
  }

  /**
   * Checks if an agent has active access and records usage.
   */
  public recordCall(subscriptionId: string): { allowed: boolean; remainingCalls: number; reason?: string } {
    const sub = this.subscriptions.get(subscriptionId);
    if (!sub) {
      return { allowed: false, remainingCalls: 0, reason: 'Subscription not found' };
    }

    const now = Date.now();
    if (sub.status !== 'ACTIVE') {
      return { allowed: false, remainingCalls: 0, reason: `Subscription is ${sub.status}` };
    }

    if (now > sub.currentPeriodEnd) {
      sub.status = 'EXPIRED';
      return { allowed: false, remainingCalls: 0, reason: 'Subscription period expired; renewal required' };
    }

    const plan = this.plans.get(sub.planId)!;
    if (sub.callsConsumedThisPeriod >= plan.maxCallsPerInterval) {
      return { allowed: false, remainingCalls: 0, reason: 'Usage allowance quota exceeded for current period' };
    }

    sub.callsConsumedThisPeriod += 1;
    return {
      allowed: true,
      remainingCalls: plan.maxCallsPerInterval - sub.callsConsumedThisPeriod,
    };
  }

  /**
   * Renews subscription for next period with settlement tx hash.
   */
  public renew(subscriptionId: string, renewalTxHash: string): AgentSubscription {
    const sub = this.subscriptions.get(subscriptionId);
    if (!sub) {
      throw new Error('Subscription not found');
    }
    if (sub.status === 'CANCELLED') throw new Error('Cancelled subscription cannot be renewed');
    const plan = this.plans.get(sub.planId)!;

    const now = Date.now();
    if (now < sub.currentPeriodEnd) throw new Error('Current subscription period has not ended');
    this.assertVerifiedPayment(renewalTxHash, {
      subscriberAgent: sub.subscriberAgent, providerAgent: sub.providerAgent,
      planId: sub.planId, amountAtomic: plan.priceAtomic,
    });
    const periodBase = Math.max(now, sub.currentPeriodEnd);

    sub.status = 'ACTIVE';
    sub.currentPeriodStart = periodBase;
    sub.currentPeriodEnd = periodBase + plan.intervalMs;
    sub.callsConsumedThisPeriod = 0;
    sub.totalSettledAmountAtomic += plan.priceAtomic;
    sub.lastRenewalTxHash = renewalTxHash;
    this.usedPaymentTxHashes.add(renewalTxHash.toLowerCase());

    return { ...sub };
  }

  public getSubscription(subscriptionId: string): AgentSubscription | undefined {
    const sub = this.subscriptions.get(subscriptionId);
    return sub && { ...sub };
  }

  private assertVerifiedPayment(
    txHash: string,
    payment: Readonly<{ subscriberAgent: string; providerAgent: string; planId: string; amountAtomic: bigint }>
  ): void {
    if (!txHash || this.usedPaymentTxHashes.has(txHash.toLowerCase())) {
      throw new Error('Payment transaction already used or missing');
    }
    if (!this.verifyPayment || !this.verifyPayment(txHash, payment)) {
      throw new Error('Subscription payment verification failed');
    }
  }
}
