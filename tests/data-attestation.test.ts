import assert from 'node:assert/strict';
import test from 'node:test';
import type { Hex } from 'viem';
import {
  evaluateDataAttestation,
  verifyMerkleInclusion,
  hashPair,
  type DataAttestationRecord,
} from '../src/lib/data-attestation-anchor.ts';

const mockProvider = '0x1234567890123456789012345678901234567890' as const;
const mockRoot = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as const;
const mockNonce = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as const;

test('valid attestation evaluation with sovereign tier discount (>= 95%)', () => {
  const record: DataAttestationRecord = {
    datasetId: 'ds_crypto_alpha',
    provider: mockProvider,
    contentMerkleRoot: mockRoot,
    recordCount: 5000,
    qualityScoreBps: 9750,
    schemaVersion: '1.0.0',
    timestamp: Date.now(),
    attestationNonce: mockNonce,
  };

  const result = evaluateDataAttestation(record);
  assert.equal(result.isValid, true);
  assert.equal(result.qualityTier, 'sovereign');
  assert.equal(result.isEligibleForDispute, false);
  // Base fee = 500_000_000_000_000n. 30% discount = 350_000_000_000_000n
  assert.equal(result.computedFeeUnits, 350_000_000_000_000n);
});

test('valid attestation evaluation with gold tier discount (>= 80%)', () => {
  const record: DataAttestationRecord = {
    datasetId: 'ds_crypto_beta',
    provider: mockProvider,
    contentMerkleRoot: mockRoot,
    recordCount: 2000,
    qualityScoreBps: 8500,
    schemaVersion: '1.0.0',
    timestamp: Date.now(),
    attestationNonce: mockNonce,
  };

  const result = evaluateDataAttestation(record);
  assert.equal(result.isValid, true);
  assert.equal(result.qualityTier, 'gold');
  assert.equal(result.isEligibleForDispute, true);
  // Base fee = 500_000_000_000_000n. 20% discount = 400_000_000_000_000n
  assert.equal(result.computedFeeUnits, 400_000_000_000_000n);
});

test('attestation rejection on empty datasetId', () => {
  const record: DataAttestationRecord = {
    datasetId: '   ',
    provider: mockProvider,
    contentMerkleRoot: mockRoot,
    recordCount: 100,
    qualityScoreBps: 8000,
    schemaVersion: '1.0.0',
    timestamp: Date.now(),
    attestationNonce: mockNonce,
  };
  const result = evaluateDataAttestation(record);
  assert.equal(result.isValid, false);
  assert.match(result.rejectionReason ?? '', /dataset identifier/i);
});

test('attestation rejection on zero or invalid provider address', () => {
  for (const invalidProvider of [
    '0x0000000000000000000000000000000000000000' as Hex,
    '0xinvalid' as Hex,
  ]) {
    const record: DataAttestationRecord = {
      datasetId: 'ds_test',
      provider: invalidProvider,
      contentMerkleRoot: mockRoot,
      recordCount: 100,
      qualityScoreBps: 8000,
      schemaVersion: '1.0.0',
      timestamp: Date.now(),
      attestationNonce: mockNonce,
    };
    const result = evaluateDataAttestation(record);
    assert.equal(result.isValid, false);
    assert.match(result.rejectionReason ?? '', /provider/i);
  }
});

test('attestation rejection on invalid Merkle root hash', () => {
  const record: DataAttestationRecord = {
    datasetId: 'ds_test',
    provider: mockProvider,
    contentMerkleRoot: '0x123' as Hex,
    recordCount: 100,
    qualityScoreBps: 8000,
    schemaVersion: '1.0.0',
    timestamp: Date.now(),
    attestationNonce: mockNonce,
  };
  const result = evaluateDataAttestation(record);
  assert.equal(result.isValid, false);
  assert.match(result.rejectionReason ?? '', /merkle root/i);
});

test('attestation rejection on invalid record count or quality score', () => {
  const baseRecord: DataAttestationRecord = {
    datasetId: 'ds_test',
    provider: mockProvider,
    contentMerkleRoot: mockRoot,
    recordCount: 0,
    qualityScoreBps: 8000,
    schemaVersion: '1.0.0',
    timestamp: Date.now(),
    attestationNonce: mockNonce,
  };
  assert.equal(evaluateDataAttestation(baseRecord).isValid, false);

  const outOfRangeScore: DataAttestationRecord = {
    ...baseRecord,
    recordCount: 500,
    qualityScoreBps: 10001,
  };
  assert.equal(evaluateDataAttestation(outOfRangeScore).isValid, false);
});

test('Merkle inclusion proof verification succeeds with valid path', () => {
  const leaf1 = '0x1111111111111111111111111111111111111111111111111111111111111111' as Hex;
  const leaf2 = '0x2222222222222222222222222222222222222222222222222222222222222222' as Hex;
  const root = hashPair(leaf1, leaf2);

  // leaf1 is at index 0, sibling is leaf2
  const verified1 = verifyMerkleInclusion(leaf1, [leaf2], root, 0);
  assert.equal(verified1, true);

  // leaf2 is at index 1, sibling is leaf1
  const verified2 = verifyMerkleInclusion(leaf2, [leaf1], root, 1);
  assert.equal(verified2, true);

  // Tampered leaf fails
  const tamperedLeaf = '0x9999999999999999999999999999999999999999999999999999999999999999' as Hex;
  const verifiedTampered = verifyMerkleInclusion(tamperedLeaf, [leaf2], root, 0);
  assert.equal(verifiedTampered, false);
});
