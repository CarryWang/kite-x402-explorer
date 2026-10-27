import { describe, expect, it } from './vitest-compat.js';
import assert from 'node:assert/strict';
import {
  createInsurancePolicy as createInsurancePolicyVerified,
  calculateInsurancePremium,
  submitInsuranceClaim as submitInsuranceClaimVerified,
  disburseInsuranceClaim,
} from '../src/lib/agent-collateral-insurance';

const createInsurancePolicy = (params: Parameters<typeof createInsurancePolicyVerified>[0]) => createInsurancePolicyVerified(params, () => true);
const submitInsuranceClaim = (policy: Parameters<typeof submitInsuranceClaimVerified>[0], params: Parameters<typeof submitInsuranceClaimVerified>[1]) => submitInsuranceClaimVerified(policy, params, () => true);

describe('agent-collateral-insurance', () => {
  const buyer = '0x1111111111111111111111111111111111111111' as const;
  const provider = '0x2222222222222222222222222222222222222222' as const;
  const url = 'https://agent-api.kite.ai/v1/infer';

  it('rejects claim disbursement against a different policy', () => {
    const one = createInsurancePolicy({ buyerAgent: buyer, providerAgent: provider, targetServiceUrl: url, insuredAmountWei: 100n, timestamp: 1000 });
    const two = createInsurancePolicy({ buyerAgent: buyer, providerAgent: provider, targetServiceUrl: url, insuredAmountWei: 200n, timestamp: 1001 });
    const { claim } = submitInsuranceClaim(one, { claimant: buyer, evidenceHash: '0x1234', failureStatusCode: 500, timestamp: 2000 });
    expect(() => disburseInsuranceClaim(claim, two, 2500)).toThrow(/policy|match/i);
  });

  it('separates policies with different coverage terms at the same timestamp', () => {
    const base = { buyerAgent: buyer, providerAgent: provider, targetServiceUrl: url, insuredAmountWei: 100n, timestamp: 1000, purchaseNonce: 7n };
    const amountChanged = createInsurancePolicy({ ...base, insuredAmountWei: 200n });
    const serviceChanged = createInsurancePolicy({ ...base, targetServiceUrl: `${url}/other` });
    const original = createInsurancePolicy(base);
    assert.notEqual(original.policyId, amountChanged.policyId);
    assert.notEqual(original.policyId, serviceChanged.policyId);
  });

  it('uses a unique purchase identity and rejects invalid supplied nonces', () => {
    const params = { buyerAgent: buyer, providerAgent: provider, targetServiceUrl: url, insuredAmountWei: 100n, timestamp: 1000 };
    const first = createInsurancePolicy(params);
    const second = createInsurancePolicy(params);
    assert.notEqual(first.policyId, second.policyId);
    expect(createInsurancePolicy({ ...params, purchaseNonce: 42n }).policyId).toBe(createInsurancePolicy({ ...params, purchaseNonce: 42n }).policyId);
    expect(() => createInsurancePolicy({ ...params, purchaseNonce: -1n })).toThrow(/nonce/i);
  });

  it('requires verified adjudication and payout', () => {
    const policy = createInsurancePolicy({ buyerAgent: buyer, providerAgent: provider, targetServiceUrl: url, insuredAmountWei: 100n, timestamp: 1000 });
    const { claim, policy: claimed } = submitInsuranceClaim(policy, { claimant: buyer, evidenceHash: '0x1234', failureStatusCode: 500, timestamp: 2000 });
    expect(() => disburseInsuranceClaim(claim, claimed, 2500)).toThrow(/Verified/i);
  });

  it('does not activate a policy without verified premium payment', () => {
    expect(() => createInsurancePolicyVerified({ buyerAgent: buyer, providerAgent: provider, targetServiceUrl: url, insuredAmountWei: 100n })).toThrow(/premium|verif/i);
  });

  it('rejects a claimant whose identity was not verified', () => {
    const policy = createInsurancePolicy({ buyerAgent: buyer, providerAgent: provider, targetServiceUrl: url, insuredAmountWei: 100n, timestamp: 1000 });
    expect(() => submitInsuranceClaimVerified(policy, { claimant: buyer, evidenceHash: '0x1234', failureStatusCode: 500, timestamp: 2000 })).toThrow(/claimant|verif/i);
  });

  it('calculates premium accurately with reputation adjustment', () => {
    // Neutral reputation (500) -> base premium = 2.0%
    const base = calculateInsurancePremium({
      insuredAmountWei: 1_000_000_000n, // 1000 USDC
      providerReputationScore: 500,
    });
    expect(base).toBe(20_000_000n); // 20 USDC

    // High reputation (1000) -> 50% discount = 1.0%
    const discounted = calculateInsurancePremium({
      insuredAmountWei: 1_000_000_000n,
      providerReputationScore: 1000,
    });
    expect(discounted).toBe(10_000_000n); // 10 USDC
  });

  it('creates active policy with deterministic ID and deadline', () => {
    const policy = createInsurancePolicy({
      buyerAgent: buyer,
      providerAgent: provider,
      targetServiceUrl: url,
      insuredAmountWei: 500_000_000n,
      coverageDurationSeconds: 3600,
      timestamp: 1000,
    });

    expect(policy.policyId).toMatch(/^policy-[a-f0-9]{64}$/);
    expect(policy.status).toBe('active');
    expect(policy.coverageDeadline).toBe(1000 + 3600 * 1000);
    expect(policy.premiumPaidWei).toBeGreaterThan(0n);
  });

  it('submits and disburses valid failure claim', () => {
    const policy = createInsurancePolicy({
      buyerAgent: buyer,
      providerAgent: provider,
      targetServiceUrl: url,
      insuredAmountWei: 200_000_000n,
      timestamp: 1000,
    });

    const { policy: claimedPolicy, claim } = submitInsuranceClaim(policy, {
      claimant: buyer,
      evidenceHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      failureStatusCode: 504,
      timestamp: 2000,
    });

    expect(claimedPolicy.status).toBe('claimed');
    expect(claim.status).toBe('pending');
    expect(claim.failureStatusCode).toBe(504);

    const disbursed = disburseInsuranceClaim(claim, claimedPolicy, 2500, () => true);
    expect(disbursed.status).toBe('disbursed');
    expect(disbursed.disbursedAmountWei).toBe(200_000_000n);
    expect(disbursed.adjudicatedAt).toBe(2500);
  });

  it('rejects claim past deadline', () => {
    const policy = createInsurancePolicy({
      buyerAgent: buyer,
      providerAgent: provider,
      targetServiceUrl: url,
      insuredAmountWei: 100_000_000n,
      coverageDurationSeconds: 60,
      timestamp: 1000,
    });

    expect(() =>
      submitInsuranceClaim(policy, {
        claimant: buyer,
        evidenceHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        failureStatusCode: 500,
        timestamp: 1000 + 70 * 1000, // 70s later (expired)
      }),
    ).toThrow(/Policy coverage has expired/);
  });
});
