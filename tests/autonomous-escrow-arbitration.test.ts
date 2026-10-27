import { describe, expect, it } from 'vitest';
import {
  createEscrowContract,
  openEscrowDispute,
  castArbitrationVote,
} from '../src/lib/autonomous-escrow-arbitration';

describe('autonomous-escrow-arbitration', () => {
  const buyer = '0x1111111111111111111111111111111111111111' as const;
  const provider = '0x2222222222222222222222222222222222222222' as const;
  const arbiter1 = '0x3333333333333333333333333333333333333333' as const;
  const arbiter2 = '0x4444444444444444444444444444444444444444' as const;
  const arbiter3 = '0x5555555555555555555555555555555555555555' as const;
  const taskSpec = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' as const;

  it('creates an arbitrated escrow with quorum threshold', () => {
    const escrow = createEscrowContract({
      buyer,
      provider,
      arbiters: [arbiter1, arbiter2, arbiter3],
      thresholdVotes: 2,
      escrowAmountWei: 1_000_000_000n,
      taskSpecHash: taskSpec,
      timestamp: 1000,
    });

    expect(escrow.escrowId).toMatch(/^escrow-[a-f0-9]{12}$/);
    expect(escrow.status).toBe('funded');
    expect(escrow.thresholdVotes).toBe(2);
    expect(escrow.timeoutDeadline).toBe(1000 + 86400 * 3 * 1000);
  });

  it('opens dispute and gathers arbiter votes to achieve consensus resolution', () => {
    const escrow = createEscrowContract({
      buyer,
      provider,
      arbiters: [arbiter1, arbiter2, arbiter3],
      thresholdVotes: 2,
      escrowAmountWei: 500_000_000n,
      taskSpecHash: taskSpec,
      timestamp: 1000,
    });

    const { escrow: disputedEscrow, dispute } = openEscrowDispute(escrow, {
      initiator: buyer,
      disputeReason: 'Model output hallucinated critical financial metrics',
      evidenceHash: '0x9999999999999999999999999999999999999999999999999999999999999999',
      timestamp: 2000,
    });

    expect(disputedEscrow.status).toBe('disputed');
    expect(dispute.disputeId).toMatch(/^disp-[a-f0-9]{12}$/);

    // 1st vote: arbiter1 votes refund_to_buyer
    const vote1 = castArbitrationVote(disputedEscrow, dispute, arbiter1, 'refund_to_buyer');
    expect(vote1.resolution).toBeUndefined();

    // 2nd vote: arbiter2 votes refund_to_buyer -> reaches threshold of 2!
    const vote2 = castArbitrationVote(disputedEscrow, dispute, arbiter2, 'refund_to_buyer');
    expect(vote2.resolution).toBe('refund_to_buyer');
    expect(vote2.dispute.resolvedVerdict).toBe('refund_to_buyer');
  });

  it('rejects unauthorized arbiter votes', () => {
    const escrow = createEscrowContract({
      buyer,
      provider,
      arbiters: [arbiter1, arbiter2],
      escrowAmountWei: 100_000_000n,
      taskSpecHash: taskSpec,
    });

    const { escrow: disputedEscrow, dispute } = openEscrowDispute(escrow, {
      initiator: provider,
      disputeReason: 'Buyer refusing to sign release receipt',
      evidenceHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
    });

    const rogue = '0x9999999999999999999999999999999999999999' as const;
    expect(() =>
      castArbitrationVote(disputedEscrow, dispute, rogue, 'release_to_provider'),
    ).toThrow(/not an authorized arbiter/);
  });
});
