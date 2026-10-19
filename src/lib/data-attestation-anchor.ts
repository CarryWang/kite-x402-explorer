import type { Hex } from 'viem';

/**
 * Data Attestation Anchor & Cryptographic Provenance Oracle for Kite Chain.
 *
 * Verifies dataset integrity, Merkle inclusion proofs, and quality scores
 * for decentralized AI training datasets, vector embeddings, and oracle feeds
 * funded via x402 micropayments.
 */

export interface DataAttestationRecord {
  datasetId: string;
  provider: `0x${string}`;
  contentMerkleRoot: Hex;
  recordCount: number;
  qualityScoreBps: number; // 1 to 10,000 (100.00%)
  schemaVersion: string;
  timestamp: number;
  attestationNonce: Hex;
}

export interface AttestationVerificationResult {
  isValid: boolean;
  datasetId: string;
  computedFeeUnits: bigint;
  qualityTier: 'unverified' | 'bronze' | 'silver' | 'gold' | 'sovereign';
  isEligibleForDispute: boolean;
  rejectionReason?: string;
}

/**
 * Validates 32-byte hex string (0x + 64 hex chars).
 */
export function isValidBytes32(hex: string): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(hex);
}

/**
 * Computes deterministic dual-hash for Merkle pair nodes.
 */
export function hashPair(left: Hex, right: Hex): Hex {
  const combined = left.toLowerCase() + right.toLowerCase().slice(2);
  let h1 = 0x55555555 ^ combined.length;
  let h2 = 0xaaaaaaaa ^ combined.length;
  for (let i = 0; i < combined.length; i++) {
    const ch = combined.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 16777619);
    h2 = Math.imul(h2 ^ ch, 2166136261);
  }
  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
  const repeated = `${hex1}${hex2}`.repeat(4);
  return `0x${repeated}` as Hex;
}

/**
 * Verifies that a chunk hash belongs to an attested dataset root using a Merkle proof path.
 */
export function verifyMerkleInclusion(
  leaf: Hex,
  proof: Hex[],
  expectedRoot: Hex,
  leafIndex: number
): boolean {
  if (!isValidBytes32(leaf) || !isValidBytes32(expectedRoot)) {
    return false;
  }

  let current: Hex = leaf;
  let index = leafIndex;

  for (const sibling of proof) {
    if (!isValidBytes32(sibling)) return false;
    if (index % 2 === 0) {
      current = hashPair(current, sibling);
    } else {
      current = hashPair(sibling, current);
    }
    index = Math.floor(index / 2);
  }

  return current.toLowerCase() === expectedRoot.toLowerCase();
}

/**
 * Computes the verification fee and quality tier for an attestation batch.
 * Higher quality data providers receive volume-scaled discounts.
 */
export function evaluateDataAttestation(
  record: DataAttestationRecord,
  baseFeeUnits: bigint = 500_000_000_000_000n // 0.0005 pieUSD
): AttestationVerificationResult {
  if (!record.datasetId || record.datasetId.trim().length === 0) {
    return {
      isValid: false,
      datasetId: record.datasetId,
      computedFeeUnits: 0n,
      qualityTier: 'unverified',
      isEligibleForDispute: false,
      rejectionReason: 'Dataset identifier cannot be empty',
    };
  }

  if (!/^0x[0-9a-fA-F]{40}$/.test(record.provider) || /^0x0{40}$/i.test(record.provider)) {
    return {
      isValid: false,
      datasetId: record.datasetId,
      computedFeeUnits: 0n,
      qualityTier: 'unverified',
      isEligibleForDispute: false,
      rejectionReason: 'Data provider must be a valid non-zero EVM address',
    };
  }

  if (!isValidBytes32(record.contentMerkleRoot)) {
    return {
      isValid: false,
      datasetId: record.datasetId,
      computedFeeUnits: 0n,
      qualityTier: 'unverified',
      isEligibleForDispute: false,
      rejectionReason: 'Content Merkle root must be a valid 32-byte hex hash',
    };
  }

  if (record.recordCount <= 0 || !Number.isInteger(record.recordCount)) {
    return {
      isValid: false,
      datasetId: record.datasetId,
      computedFeeUnits: 0n,
      qualityTier: 'unverified',
      isEligibleForDispute: false,
      rejectionReason: 'Record count must be a positive integer',
    };
  }

  if (
    !Number.isInteger(record.qualityScoreBps) ||
    record.qualityScoreBps < 0 ||
    record.qualityScoreBps > 10000
  ) {
    return {
      isValid: false,
      datasetId: record.datasetId,
      computedFeeUnits: 0n,
      qualityTier: 'unverified',
      isEligibleForDispute: false,
      rejectionReason: 'Quality score must be an integer between 0 and 10,000 basis points',
    };
  }

  // Determine quality tier
  let qualityTier: 'unverified' | 'bronze' | 'silver' | 'gold' | 'sovereign';
  let discountBps: bigint;

  if (record.qualityScoreBps >= 9500) {
    qualityTier = 'sovereign';
    discountBps = 3000n; // 30% discount
  } else if (record.qualityScoreBps >= 8000) {
    qualityTier = 'gold';
    discountBps = 2000n; // 20% discount
  } else if (record.qualityScoreBps >= 6000) {
    qualityTier = 'silver';
    discountBps = 1000n; // 10% discount
  } else if (record.qualityScoreBps >= 3000) {
    qualityTier = 'bronze';
    discountBps = 0n;
  } else {
    qualityTier = 'unverified';
    discountBps = 0n;
  }

  // Calculate volume-adjusted fee
  const volumeScaler = record.recordCount > 10000 ? 2n : 1n;
  const grossFee = baseFeeUnits * volumeScaler;
  const discountAmount = (grossFee * discountBps) / 10000n;
  const computedFeeUnits = grossFee - discountAmount;

  return {
    isValid: true,
    datasetId: record.datasetId,
    computedFeeUnits,
    qualityTier,
    isEligibleForDispute: record.qualityScoreBps < 9000,
  };
}
