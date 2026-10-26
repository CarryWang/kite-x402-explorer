import { isAddress, keccak256, stringToHex } from 'viem';

export type PolicyStatus = 'active' | 'claimed' | 'expired' | 'canceled';
export type ClaimStatus = 'pending' | 'approved' | 'rejected' | 'disbursed';

export interface InsurancePolicy {
  policyId: string;
  buyerAgent: `0x${string}`;
  targetServiceUrl: string;
  providerAgent: `0x${string}`;
  insuredAmountWei: bigint;
  premiumPaidWei: bigint;
  coverageDeadline: number;
  status: PolicyStatus;
  createdAt: number;
}

export interface InsuranceClaim {
  claimId: string;
  policyId: string;
  claimant: `0x${string}`;
  evidenceHash: `0x${string}`;
  failureStatusCode: number;
  status: ClaimStatus;
  disbursedAmountWei?: bigint;
  adjudicatedAt?: number;
  createdAt: number;
}

export interface InsurancePoolMetrics {
  totalUnderwrittenWei: bigint;
  totalPremiumsCollectedWei: bigint;
  totalClaimsPaidWei: bigint;
  activePoliciesCount: number;
  lossRatioBps: number; // Claims paid / Premiums collected (in bps)
}

export const BASE_PREMIUM_BPS = 200; // 2.0% base premium rate
export const BPS_DENOMINATOR = 10_000;

/**
 * Derives a deterministic policy identifier.
 */
export function derivePolicyId(buyer: `0x${string}`, provider: `0x${string}`, timestamp: number): string {
  const hash = keccak256(stringToHex(`policy:${buyer.toLowerCase()}:${provider.toLowerCase()}:${timestamp}`));
  return `policy-${hash.slice(2, 14)}`;
}

/**
 * Derives a deterministic claim identifier.
 */
export function deriveClaimId(policyId: string, timestamp: number): string {
  const hash = keccak256(stringToHex(`claim:${policyId}:${timestamp}`));
  return `claim-${hash.slice(2, 14)}`;
}

/**
 * Calculates the required insurance premium for an x402 payment task.
 */
export function calculateInsurancePremium(params: {
  insuredAmountWei: bigint;
  providerReputationScore?: number; // 0 to 1000 (default 500)
}): bigint {
  if (params.insuredAmountWei <= 0n) {
    throw new Error('Insured amount must be positive');
  }

  const score = Math.max(0, Math.min(1000, params.providerReputationScore ?? 500));
  // High reputation discount: up to 50% discount; low reputation surcharge: up to 100% surcharge
  const multiplierBps = 10_000 + (500 - score) * 10;
  const effectiveBps = (BASE_PREMIUM_BPS * multiplierBps) / 10_000;

  return (params.insuredAmountWei * BigInt(effectiveBps)) / BigInt(BPS_DENOMINATOR);
}

/**
 * Purchases and activates an insurance policy for a pending x402 payment authorization.
 */
export function createInsurancePolicy(params: {
  buyerAgent: `0x${string}`;
  providerAgent: `0x${string}`;
  targetServiceUrl: string;
  insuredAmountWei: bigint;
  providerReputationScore?: number;
  coverageDurationSeconds?: number;
  timestamp?: number;
}): InsurancePolicy {
  if (!isAddress(params.buyerAgent)) {
    throw new Error(`Invalid buyer agent address: ${params.buyerAgent}`);
  }
  if (!isAddress(params.providerAgent)) {
    throw new Error(`Invalid provider agent address: ${params.providerAgent}`);
  }
  if (!params.targetServiceUrl) {
    throw new Error('Target service URL cannot be empty');
  }

  const createdAt = params.timestamp ?? Date.now();
  const duration = params.coverageDurationSeconds ?? 3600; // 1 hour coverage default
  const coverageDeadline = createdAt + duration * 1000;

  const premiumPaidWei = calculateInsurancePremium({
    insuredAmountWei: params.insuredAmountWei,
    providerReputationScore: params.providerReputationScore,
  });

  const policyId = derivePolicyId(params.buyerAgent, params.providerAgent, createdAt);

  return {
    policyId,
    buyerAgent: params.buyerAgent,
    providerAgent: params.providerAgent,
    targetServiceUrl: params.targetServiceUrl,
    insuredAmountWei: params.insuredAmountWei,
    premiumPaidWei,
    coverageDeadline,
    status: 'active',
    createdAt,
  };
}

/**
 * Submits a failure claim against an active insurance policy.
 */
export function submitInsuranceClaim(
  policy: InsurancePolicy,
  params: {
    claimant: `0x${string}`;
    evidenceHash: `0x${string}`;
    failureStatusCode: number;
    timestamp?: number;
  },
): { policy: InsurancePolicy; claim: InsuranceClaim } {
  if (policy.status !== 'active') {
    throw new Error(`Cannot submit claim on policy in status: ${policy.status}`);
  }
  if (policy.buyerAgent.toLowerCase() !== params.claimant.toLowerCase()) {
    throw new Error('Only the policyholder buyer can submit a claim');
  }

  const now = params.timestamp ?? Date.now();
  if (now > policy.coverageDeadline) {
    throw new Error('Policy coverage has expired');
  }

  const claimId = deriveClaimId(policy.policyId, now);

  const claim: InsuranceClaim = {
    claimId,
    policyId: policy.policyId,
    claimant: params.claimant,
    evidenceHash: params.evidenceHash,
    failureStatusCode: params.failureStatusCode,
    status: 'pending',
    createdAt: now,
  };

  const updatedPolicy: InsurancePolicy = {
    ...policy,
    status: 'claimed',
  };

  return { policy: updatedPolicy, claim };
}

/**
 * Adjudicates and disburses an approved claim.
 */
export function disburseInsuranceClaim(
  claim: InsuranceClaim,
  policy: InsurancePolicy,
  timestamp: number = Date.now(),
): InsuranceClaim {
  if (claim.status !== 'pending') {
    throw new Error(`Cannot disburse claim in status: ${claim.status}`);
  }

  return {
    ...claim,
    status: 'disbursed',
    disbursedAmountWei: policy.insuredAmountWei,
    adjudicatedAt: timestamp,
  };
}
