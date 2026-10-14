/**
 * Optimistic Dispute Arbiter & Escrow Slashing Protocol for Kite x402 Services.
 *
 * Provides cryptographic challenge window verification, fraud proof evaluation,
 * and penalty slashing payouts for multi-agent autonomous transactions on Kite Chain.
 */

export type DisputeReason =
  | 'invalid_output_hash'
  | 'response_timeout'
  | 'service_unavailable'
  | 'malformed_signature'
  | 'upstream_sla_violation';

export type DisputeStatus = 'opened' | 'in_challenge_window' | 'slashed' | 'dismissed' | 'resolved';

export interface OptimisticDisputeClaim {
  disputeId: string;
  txHash: `0x${string}`;
  payer: `0x${string}`;
  payee: `0x${string}`;
  paymentValueWei: bigint;
  challengerBondWei: bigint;
  reason: DisputeReason;
  createdAtTimestamp: number;
  challengeWindowSeconds: number;
  status: DisputeStatus;
  evidenceUri?: string;
}

export interface SlashingDistribution {
  payerRefundWei: bigint;
  challengerBountyWei: bigint;
  arbiterFeeWei: bigint;
  totalSlashedWei: bigint;
}

/** Default challenge window: 1 hour (3600 seconds) */
export const DEFAULT_CHALLENGE_WINDOW_SECONDS = 3600;

/**
 * Validates whether a dispute claim is currently inside its active challenge window.
 */
export function isWithinChallengeWindow(
  claim: OptimisticDisputeClaim,
  currentTimestamp: number = Math.floor(Date.now() / 1000)
): boolean {
  const windowEnd = claim.createdAtTimestamp + claim.challengeWindowSeconds;
  return currentTimestamp >= claim.createdAtTimestamp && currentTimestamp <= windowEnd;
}

/**
 * Calculates slashing penalties and refund distributions when a dispute is ruled valid.
 * Slashing Model:
 * - 80% of escrow/penalty is refunded to the aggrieved payer
 * - 15% is rewarded to the challenger for fraud-proof generation
 * - 5% is allocated as protocol arbiter coordination fee
 */
export function calculateSlashingPayout(escrowWei: bigint): SlashingDistribution {
  if (escrowWei <= 0n) {
    return {
      payerRefundWei: 0n,
      challengerBountyWei: 0n,
      arbiterFeeWei: 0n,
      totalSlashedWei: 0n,
    };
  }

  const payerRefundWei = (escrowWei * 8000n) / 10000n; // 80%
  const challengerBountyWei = (escrowWei * 1500n) / 10000n; // 15%
  const arbiterFeeWei = escrowWei - payerRefundWei - challengerBountyWei; // Remaining dust to arbiter

  return {
    payerRefundWei,
    challengerBountyWei,
    arbiterFeeWei,
    totalSlashedWei: escrowWei,
  };
}

/**
 * Formats a deterministic dispute digest for on-chain or off-chain agent consensus.
 */
export function formatDisputeDigest(claim: OptimisticDisputeClaim): {
  disputeId: string;
  windowRemainingSec: number;
  isEligibleForSlashing: boolean;
} {
  const now = Math.floor(Date.now() / 1000);
  const remaining = Math.max(0, claim.createdAtTimestamp + claim.challengeWindowSeconds - now);

  return {
    disputeId: claim.disputeId,
    windowRemainingSec: remaining,
    isEligibleForSlashing: isWithinChallengeWindow(claim, now) &&
      (claim.status === 'opened' || claim.status === 'in_challenge_window'),
  };
}
