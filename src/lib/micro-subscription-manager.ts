import { keccak256, toHex, type Hex } from 'viem';

/**
 * Recurring Micropayment Subscriptions & Streaming AI Quota Manager for Kite Chain.
 *
 * Enables autonomous agents to subscribe to recurring data feeds, inference endpoints,
 * and high-frequency tool capabilities using x402-metered micropayment allowances.
 */

export type SubscriptionCadence = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'custom';
export type SubscriptionStatus = 'active' | 'paused' | 'delinquent' | 'cancelled' | 'expired';

export interface SubscriptionPlan {
  planId: string;
  provider: `0x${string}`;
  cadence: SubscriptionCadence;
  periodDurationMs: number;
  baseCostWei: bigint;
  includedUnits: number;
  overageUnitPriceWei: bigint;
  maxSpendCapWei: bigint;
  title: string;
  createdAt: number;
}

export interface SubscriptionRecord {
  subscriptionId: string;
  planId: string;
  subscriber: `0x${string}`;
  provider: `0x${string}`;
  status: SubscriptionStatus;
  currentPeriodStart: number;
  currentPeriodEnd: number;
  periodUnitsConsumed: number;
  periodSpendWei: bigint;
  lifetimeSettledWei: bigint;
  consecutiveFailedRenewals: number;
  maxRetryAttempts: number;
  autoRenew: boolean;
  delegatedAuthSignature?: Hex;
}

export interface UsageRecord {
  usageId: string;
  subscriptionId: string;
  unitsRequested: number;
  chargeWei: bigint;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface RenewalInvoice {
  invoiceId: string;
  subscriptionId: string;
  periodStart: number;
  periodEnd: number;
  totalAmountWei: bigint;
  unitsUsed: number;
  settlementDigest: Hex;
  status: 'paid' | 'failed' | 'disputed';
  generatedAt: number;
  disputedReason?: string;
}

export interface SubscriptionSummary {
  subscriptionId: string;
  planTitle: string;
  status: SubscriptionStatus;
  remainingSpendCapWei: bigint;
  remainingIncludedUnits: number;
  effectiveUsageRate: number;
  nextRenewalTime: number;
  isRenewalDue: boolean;
}

/**
 * Validates standard 20-byte EVM address format.
 */
export function isValidAddress(address: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(address) && !/^0x0{40}$/i.test(address);
}

/**
 * Computes standard duration in milliseconds for each cadence type.
 */
export function computePeriodDurationMs(cadence: SubscriptionCadence, customDurationMs?: number): number {
  switch (cadence) {
    case 'hourly':
      return 3600 * 1000;
    case 'daily':
      return 86400 * 1000;
    case 'weekly':
      return 7 * 86400 * 1000;
    case 'monthly':
      return 30 * 86400 * 1000;
    case 'custom':
      if (!customDurationMs || customDurationMs <= 0) {
        throw new Error('Custom cadence requires a strictly positive customDurationMs');
      }
      return customDurationMs;
    default:
      throw new Error(`Unsupported subscription cadence: ${cadence}`);
  }
}

/**
 * Validates plan parameters to ensure solvency and invariant guarantees.
 */
export function validateSubscriptionPlan(plan: SubscriptionPlan): void {
  if (!plan.planId || plan.planId.trim() === '') {
    throw new Error('Subscription planId must not be empty');
  }
  if (!isValidAddress(plan.provider)) {
    throw new Error(`Invalid provider address: ${plan.provider}`);
  }
  if (plan.periodDurationMs <= 0) {
    throw new Error('Period duration must be strictly positive');
  }
  if (plan.baseCostWei < 0n) {
    throw new Error('Base plan cost cannot be negative');
  }
  if (plan.includedUnits < 0) {
    throw new Error('Included units cannot be negative');
  }
  if (plan.overageUnitPriceWei < 0n) {
    throw new Error('Overage unit price cannot be negative');
  }
  if (plan.maxSpendCapWei <= 0n) {
    throw new Error('Maximum spend cap must be strictly positive');
  }
  if (plan.baseCostWei > plan.maxSpendCapWei) {
    throw new Error('Base cost cannot exceed maximum period spend cap');
  }
}

/**
 * Initializes a new subscription for a subscriber under the specified plan.
 */
export function createSubscription(
  plan: SubscriptionPlan,
  subscriber: `0x${string}`,
  options?: {
    autoRenew?: boolean;
    maxRetryAttempts?: number;
    delegatedAuthSignature?: Hex;
    startTimestamp?: number;
  }
): SubscriptionRecord {
  validateSubscriptionPlan(plan);

  if (!isValidAddress(subscriber)) {
    throw new Error(`Invalid subscriber address: ${subscriber}`);
  }
  if (subscriber.toLowerCase() === plan.provider.toLowerCase()) {
    throw new Error('Subscriber cannot be identical to provider');
  }

  const now = options?.startTimestamp ?? Date.now();
  const duration = plan.periodDurationMs;

  return {
    subscriptionId: `sub_${plan.planId}_${subscriber.slice(2, 10)}_${now}`,
    planId: plan.planId,
    subscriber,
    provider: plan.provider,
    status: 'active',
    currentPeriodStart: now,
    currentPeriodEnd: now + duration,
    periodUnitsConsumed: 0,
    periodSpendWei: plan.baseCostWei,
    lifetimeSettledWei: 0n,
    consecutiveFailedRenewals: 0,
    maxRetryAttempts: options?.maxRetryAttempts ?? 3,
    autoRenew: options?.autoRenew ?? true,
    delegatedAuthSignature: options?.delegatedAuthSignature,
  };
}
