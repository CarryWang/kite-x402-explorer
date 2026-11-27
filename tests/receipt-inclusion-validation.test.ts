import test from 'node:test';
import assert from 'node:assert/strict';
import { createSettlementBundle, generateReceiptProof, verifyReceiptInclusionProof, type ReceiptInclusionProof } from '../src/lib/batch-settlement-bundler.js';

function proof() {
  const receipt = { receiptId: 'local-receipt', payer: '0x1111111111111111111111111111111111111111' as const,
    recipient: '0x2222222222222222222222222222222222222222' as const,
    tokenAddress: '0x3333333333333333333333333333333333333333' as const, amount: 10n,
    nonce: '0x01' as const, signature: '0xfixture' as const, timestamp: 1 };
  const bundle = createSettlementBundle({ bundleId: 'local-bundle', tokenAddress: receipt.tokenAddress,
    receipts: [receipt], verifyReceiptAuthorization: () => true });
  return generateReceiptProof(receipt.receiptId, bundle);
}

test('malformed imported inclusion proofs return false without throwing', () => {
  const valid = proof();
  for (const invalid of [null, {}, { ...valid, merkleRoot: null }, { ...valid, receiptHash: null },
    { ...valid, auditPath: null }, { ...valid, auditPath: {} }, { ...valid, auditPath: [null] }]) {
    let result: boolean | undefined;
    assert.doesNotThrow(() => { result = verifyReceiptInclusionProof(invalid as ReceiptInclusionProof, valid.merkleRoot); });
    assert.equal(result, false);
  }
});

test('a genuine generated proof remains valid and a changed receipt is rejected', () => {
  const valid = proof();
  assert.equal(verifyReceiptInclusionProof(valid, valid.merkleRoot), true);
  assert.equal(verifyReceiptInclusionProof({ ...valid, receipt: { ...valid.receipt, amount: 11n } }, valid.merkleRoot), false);
  assert.equal(verifyReceiptInclusionProof({ ...valid, auditPath: ['0x12'] }, valid.merkleRoot), false);
});
