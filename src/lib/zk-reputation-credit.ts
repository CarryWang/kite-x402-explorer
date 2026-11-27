/**
 * Zero-Knowledge AI Agent Reputation Attestation & Credit-Based x402 Micropayments.
 *
 * Calculates a credit profile only after a caller-supplied trusted verifier
 * validates the attestation. This module does not implement ZK verification.
 */

export type ReputationTier = 'unverified' | 'bronze' | 'silver' | 'gold' | 'platinum';

export interface ZKReputationProof {
  agentAddress: `0x${string}`;
  reputationScore: number; // 0 to 1000 scale
  nullifierHash: `0x${string}`;
  attestationDigest: `0x${string}`;
  issuedAtTimestamp: number;
  expiresAtTimestamp: number;
}

export interface CreditLineProfile {
  agentAddress: `0x${string}`;
  tier: ReputationTier;
  maxCreditLimitWei: bigint;
  utilizedCreditWei: bigint;
  availableCreditWei: bigint;
  isEligibleForPostSettlement: boolean;
  expiresAtTimestamp: number;
}

export interface CreditEvaluationOptions {
  /** Must validate the complete proof against a trusted issuer and reject replayed nullifiers. */
  verifyAttestation?: (proof: ZKReputationProof) => boolean;
  currentTimestamp?: number;
}

/**
 * Evaluates an agent's ZK reputation proof and computes their dynamic credit line.
 */
export function evaluateAgentCreditLine(
  proof: ZKReputationProof,
  options: CreditEvaluationOptions = {}
): CreditLineProfile {
  const currentTimestamp = options.currentTimestamp ?? Math.floor(Date.now() / 1000);
  const validScore = Number.isInteger(proof.reputationScore) && proof.reputationScore >= 0 && proof.reputationScore <= 1000;
  const validWindow = Number.isSafeInteger(proof.issuedAtTimestamp) && Number.isSafeInteger(proof.expiresAtTimestamp)
    && proof.issuedAtTimestamp <= proof.expiresAtTimestamp
    && currentTimestamp >= proof.issuedAtTimestamp && currentTimestamp <= proof.expiresAtTimestamp;
  if (!validScore || !validWindow || !options.verifyAttestation?.(proof)) {
    return {
      agentAddress: proof.agentAddress,
      tier: 'unverified',
      maxCreditLimitWei: 0n,
      utilizedCreditWei: 0n,
      availableCreditWei: 0n,
      isEligibleForPostSettlement: false,
      expiresAtTimestamp: proof.expiresAtTimestamp,
    };
  }

  let tier: ReputationTier = 'unverified';
  let maxCreditLimitWei = 0n;

  if (proof.reputationScore >= 900) {
    tier = 'platinum';
    maxCreditLimitWei = 5000000000000000000n; // 5.0 tokens
  } else if (proof.reputationScore >= 800) {
    tier = 'gold';
    maxCreditLimitWei = 1000000000000000000n; // 1.0 token
  } else if (proof.reputationScore >= 600) {
    tier = 'silver';
    maxCreditLimitWei = 200000000000000000n; // 0.2 token
  } else if (proof.reputationScore >= 300) {
    tier = 'bronze';
    maxCreditLimitWei = 50000000000000000n; // 0.05 token
  }

  return {
    agentAddress: proof.agentAddress,
    tier,
    maxCreditLimitWei,
    utilizedCreditWei: 0n,
    availableCreditWei: maxCreditLimitWei,
    isEligibleForPostSettlement: maxCreditLimitWei > 0n,
    expiresAtTimestamp: proof.expiresAtTimestamp,
  };
}

/**
 * Draws down available credit for an x402 post-payment invoice.
 */
export function consumeCredit(
  profile: CreditLineProfile,
  invoiceAmountWei: bigint
): CreditLineProfile {
  if (invoiceAmountWei < 0n) throw new Error('Credit amount must be non-negative');
  if (invoiceAmountWei === 0n) return profile;
  // 评估时有效的证明可能已过期；每次正额提款都须重新检查本地额度的有效状态。
  if (!profile.isEligibleForPostSettlement) throw new Error('Credit profile is not eligible');
  if (!Number.isSafeInteger(profile.expiresAtTimestamp) || Math.floor(Date.now() / 1000) > profile.expiresAtTimestamp) {
    throw new Error('Credit profile has expired');
  }

  if (invoiceAmountWei > profile.availableCreditWei) {
    throw new Error(
      `Insufficient credit: invoice ${invoiceAmountWei.toString()} wei exceeds available credit ${profile.availableCreditWei.toString()} wei`
    );
  }

  const newUtilized = profile.utilizedCreditWei + invoiceAmountWei;
  const newAvailable = profile.maxCreditLimitWei - newUtilized;

  return {
    ...profile,
    utilizedCreditWei: newUtilized,
    availableCreditWei: newAvailable,
  };
}

/**
 * Resets utilized credit upon confirmation of an on-chain debt settlement transaction.
 */
export function settleCreditDebt(
  profile: CreditLineProfile,
  settledAmountWei: bigint
): CreditLineProfile {
  // 负数还款会反向增加债务；过期后的正额还款仍允许清偿原有余额。
  if (settledAmountWei < 0n) throw new Error('Debt settlement amount must be non-negative');
  const actualSettled = settledAmountWei > profile.utilizedCreditWei ? profile.utilizedCreditWei : settledAmountWei;
  const newUtilized = profile.utilizedCreditWei - actualSettled;
  const newAvailable = profile.maxCreditLimitWei - newUtilized;

  return {
    ...profile,
    utilizedCreditWei: newUtilized,
    availableCreditWei: newAvailable,
  };
}
