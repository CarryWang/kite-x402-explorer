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
    verifyInitialPayment?: (plan: SubscriptionPlan, subscriber: `0x${string}`) => boolean;
  }
): SubscriptionRecord {
  validateSubscriptionPlan(plan);

  if (!isValidAddress(subscriber)) {
    throw new Error(`Invalid subscriber address: ${subscriber}`);
  }
  if (subscriber.toLowerCase() === plan.provider.toLowerCase()) {
    throw new Error('Subscriber cannot be identical to provider');
  }
  if (plan.baseCostWei > 0n && !options?.verifyInitialPayment?.(plan, subscriber)) {
    throw new Error('Verified initial payment required before subscription activation');
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

/**
 * Records usage consumption against an active subscription.
 *
 * Verifies period active status, checks remaining spend cap, applies overage rates
 * once included units are exhausted, and records the spend increment.
 */
export function recordSubscriptionUsage(
  subscription: SubscriptionRecord,
  plan: SubscriptionPlan,
  units: number,
  currentTimestamp?: number
): {
  approved: boolean;
  chargeWei: bigint;
  remainingSpendCapWei: bigint;
  rejectionReason?: string;
} {
  const now = currentTimestamp ?? Date.now();

  if (subscription.status !== 'active') {
    return {
      approved: false,
      chargeWei: 0n,
      remainingSpendCapWei: plan.maxSpendCapWei - subscription.periodSpendWei,
      rejectionReason: `Subscription is not active (current status: ${subscription.status})`,
    };
  }

  if (now < subscription.currentPeriodStart || now > subscription.currentPeriodEnd) {
    return {
      approved: false,
      chargeWei: 0n,
      remainingSpendCapWei: plan.maxSpendCapWei - subscription.periodSpendWei,
      rejectionReason: 'Usage timestamp is outside current subscription billing window',
    };
  }

  if (units <= 0 || !Number.isInteger(units)) {
    return {
      approved: false,
      chargeWei: 0n,
      remainingSpendCapWei: plan.maxSpendCapWei - subscription.periodSpendWei,
      rejectionReason: 'Units requested must be a strictly positive integer',
    };
  }

  // Calculate billable overage units
  const previouslyConsumed = subscription.periodUnitsConsumed;
  const newTotalUnits = previouslyConsumed + units;

  let billableOverageUnits = 0;
  if (previouslyConsumed >= plan.includedUnits) {
    billableOverageUnits = units;
  } else if (newTotalUnits > plan.includedUnits) {
    billableOverageUnits = newTotalUnits - plan.includedUnits;
  }

  const additionalCostWei = BigInt(billableOverageUnits) * plan.overageUnitPriceWei;
  const projectedSpendWei = subscription.periodSpendWei + additionalCostWei;

  if (projectedSpendWei > plan.maxSpendCapWei) {
    return {
      approved: false,
      chargeWei: 0n,
      remainingSpendCapWei: plan.maxSpendCapWei - subscription.periodSpendWei,
      rejectionReason: `Spend would exceed maximum spend cap of ${plan.maxSpendCapWei} wei (projected: ${projectedSpendWei} wei)`,
    };
  }

  // Apply state update
  subscription.periodUnitsConsumed = newTotalUnits;
  subscription.periodSpendWei = projectedSpendWei;

  return {
    approved: true,
    chargeWei: additionalCostWei,
    remainingSpendCapWei: plan.maxSpendCapWei - projectedSpendWei,
  };
}

/**
 * Transitions an active subscription to paused state.
 */
export function pauseSubscription(subscription: SubscriptionRecord): SubscriptionRecord {
  if (subscription.status !== 'active') {
    throw new Error(`Cannot pause subscription from '${subscription.status}' state`);
  }
  return {
    ...subscription,
    status: 'paused',
  };
}

/**
 * Resumes a paused subscription.
 */
export function resumeSubscription(
  subscription: SubscriptionRecord,
  currentTimestamp?: number
): SubscriptionRecord {
  if (subscription.status !== 'paused') {
    throw new Error(`Cannot resume subscription from '${subscription.status}' state`);
  }
  const now = currentTimestamp ?? Date.now();
  if (now > subscription.currentPeriodEnd) {
    return {
      ...subscription,
      status: 'expired',
    };
  }
  return {
    ...subscription,
    status: 'active',
  };
}

/**
 * Cancels a subscription immediately, stopping all auto-renewals and future spends.
 */
export function cancelSubscription(subscription: SubscriptionRecord): SubscriptionRecord {
  if (subscription.status === 'cancelled') {
    throw new Error('Subscription is already cancelled');
  }
  return {
    ...subscription,
    status: 'cancelled',
    autoRenew: false,
  };
}

/**
 * Calculates a fair pro-rated refund if a subscription is cancelled or terminated mid-period.
 */
export function calculateProratedRefund(
  subscription: SubscriptionRecord,
  plan: SubscriptionPlan,
  currentTimestamp?: number
): bigint {
  if (plan.baseCostWei === 0n) return 0n;

  const now = currentTimestamp ?? Date.now();
  if (now <= subscription.currentPeriodStart) {
    return plan.baseCostWei;
  }
  if (now >= subscription.currentPeriodEnd) {
    return 0n;
  }

  const elapsedMs = now - subscription.currentPeriodStart;
  const totalPeriodMs = subscription.currentPeriodEnd - subscription.currentPeriodStart;
  const refund = plan.baseCostWei * BigInt(totalPeriodMs - elapsedMs) / BigInt(totalPeriodMs);
  return refund > 0n ? refund : 0n;
}

/**
 * Computes real-time telemetry snapshot and summary for the subscription.
 */
export function getSubscriptionSummary(
  subscription: SubscriptionRecord,
  plan: SubscriptionPlan,
  currentTimestamp?: number
): SubscriptionSummary {
  const now = currentTimestamp ?? Date.now();
  const remainingSpendCapWei = plan.maxSpendCapWei > subscription.periodSpendWei
    ? plan.maxSpendCapWei - subscription.periodSpendWei
    : 0n;

  const remainingIncludedUnits = plan.includedUnits > subscription.periodUnitsConsumed
    ? plan.includedUnits - subscription.periodUnitsConsumed
    : 0;

  const effectiveUsageRate = plan.includedUnits > 0
    ? Math.min(1.0, subscription.periodUnitsConsumed / plan.includedUnits)
    : 1.0;

  return {
    subscriptionId: subscription.subscriptionId,
    planTitle: plan.title,
    status: subscription.status,
    remainingSpendCapWei,
    remainingIncludedUnits,
    effectiveUsageRate,
    nextRenewalTime: subscription.currentPeriodEnd,
    isRenewalDue: now >= subscription.currentPeriodEnd && subscription.status === 'active',
  };
}

/**
 * Generates cryptographic settlement digest for the renewal invoice.
 */
export function generateRenewalDigest(
  subscriptionId: string,
  periodStart: number,
  periodEnd: number,
  totalAmountWei: bigint,
  unitsUsed: number,
  secretKey?: string
): Hex {
  const payload = `${subscriptionId}:${periodStart}:${periodEnd}:${totalAmountWei.toString()}:${unitsUsed}:${secretKey ?? 'kite-x402-sub-default'}`;
  return keccak256(toHex(payload));
}

/**
 * Processes automated subscription renewal at the end of a billing period.
 */
export function processSubscriptionRenewal(
  subscription: SubscriptionRecord,
  plan: SubscriptionPlan,
  options: {
    paymentSuccess: boolean;
    currentTimestamp?: number;
    secretKey?: string;
    verifyPayment?: (subscription: SubscriptionRecord, amountWei: bigint) => boolean;
  }
): {
  updatedSubscription: SubscriptionRecord;
  invoice: RenewalInvoice;
} {
  const now = options.currentTimestamp ?? Date.now();
  if (subscription.status !== 'active' || !subscription.autoRenew) {
    throw new Error('Only active auto-renewing subscriptions can renew');
  }
  if (now < subscription.currentPeriodEnd) {
    throw new Error('Subscription renewal is not due');
  }
  if (subscription.planId !== plan.planId || subscription.provider.toLowerCase() !== plan.provider.toLowerCase()) {
    throw new Error('Subscription plan mismatch');
  }
  if (options.paymentSuccess && !options.verifyPayment?.(subscription, subscription.periodSpendWei)) {
    throw new Error('Payment verification required before renewal');
  }
  const invoiceId = `inv_${subscription.subscriptionId}_${subscription.currentPeriodEnd}`;
  const totalAmountWei = subscription.periodSpendWei;
  const unitsUsed = subscription.periodUnitsConsumed;

  const settlementDigest = generateRenewalDigest(
    subscription.subscriptionId,
    subscription.currentPeriodStart,
    subscription.currentPeriodEnd,
    totalAmountWei,
    unitsUsed,
    options.secretKey
  );

  if (options.paymentSuccess) {
    const updatedSubscription: SubscriptionRecord = {
      ...subscription,
      status: 'active',
      currentPeriodStart: subscription.currentPeriodEnd,
      currentPeriodEnd: subscription.currentPeriodEnd + plan.periodDurationMs,
      periodUnitsConsumed: 0,
      periodSpendWei: plan.baseCostWei,
      lifetimeSettledWei: subscription.lifetimeSettledWei + totalAmountWei,
      consecutiveFailedRenewals: 0,
    };

    const invoice: RenewalInvoice = {
      invoiceId,
      subscriptionId: subscription.subscriptionId,
      periodStart: subscription.currentPeriodStart,
      periodEnd: subscription.currentPeriodEnd,
      totalAmountWei,
      unitsUsed,
      settlementDigest,
      status: 'paid',
      generatedAt: now,
    };

    return { updatedSubscription, invoice };
  } else {
    const failedAttempts = subscription.consecutiveFailedRenewals + 1;
    const isNowDelinquent = failedAttempts >= subscription.maxRetryAttempts;

    const updatedSubscription: SubscriptionRecord = {
      ...subscription,
      status: isNowDelinquent ? 'delinquent' : subscription.status,
      consecutiveFailedRenewals: failedAttempts,
    };

    const invoice: RenewalInvoice = {
      invoiceId,
      subscriptionId: subscription.subscriptionId,
      periodStart: subscription.currentPeriodStart,
      periodEnd: subscription.currentPeriodEnd,
      totalAmountWei,
      unitsUsed,
      settlementDigest,
      status: 'failed',
      generatedAt: now,
    };

    return { updatedSubscription, invoice };
  }
}

/**
 * Disputes a renewal invoice within the grace period, pausing the subscription pending review.
 */
export function disputeRenewalInvoice(
  invoice: RenewalInvoice,
  subscription: SubscriptionRecord,
  reason: string
): {
  updatedInvoice: RenewalInvoice;
  updatedSubscription: SubscriptionRecord;
} {
  if (!reason || reason.trim() === '') {
    throw new Error('Dispute reason must be provided');
  }
  if (invoice.status === 'disputed') {
    throw new Error('Invoice has already been disputed');
  }

  const updatedInvoice: RenewalInvoice = {
    ...invoice,
    status: 'disputed',
    disputedReason: reason,
  };

  const updatedSubscription: SubscriptionRecord = {
    ...subscription,
    status: 'paused',
  };

  return { updatedInvoice, updatedSubscription };
}
