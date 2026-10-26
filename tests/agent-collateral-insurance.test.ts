import { describe, expect, it } from 'vitest';
import {
  createInsurancePolicy,
  calculateInsurancePremium,
  submitInsuranceClaim,
  disburseInsuranceClaim,
} from '../src/lib/agent-collateral-insurance';

describe('agent-collateral-insurance', () => {
  const buyer = '0x1111111111111111111111111111111111111111' as const;
  const provider = '0x2222222222222222222222222222222222222222' as const;
  const url = 'https://agent-api.kite.ai/v1/infer';

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

    expect(policy.policyId).toMatch(/^policy-[a-f0-9]{12}$/);
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

    const disbursed = disburseInsuranceClaim(claim, claimedPolicy, 2500);
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
