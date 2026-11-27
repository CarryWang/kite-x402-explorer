import test from 'node:test';
import assert from 'node:assert/strict';
import { buildVerifiableReceipt, parseAndValidateReceipt } from '../src/lib/receipt-exporter.js';
import { isProofRecord } from '../src/lib/proof-schema.js';
import { getStoredProofs, importProofs } from '../src/services/proof-logger.js';
import type { PaymentProofRecord } from '../src/types/proof.js';

const address = '0x' + '11'.repeat(20);
const proof: PaymentProofRecord = {
  id: 'signature-fixture', timestamp: '2026-11-01T00:00:00Z', serviceName: 'weather', serviceDisplayName: 'Weather',
  endpointPath: '/', httpMethod: 'GET', network: 'eip155:2368', tokenSymbol: 'pieUSD', tokenAddress: address,
  amountFormatted: '1 pieUSD', amountRaw: '1000', payerAddress: address, payToAddress: address,
  status: 'simulated', responseStatus: 200,
  eip3009Details: { from: address, to: address, value: '1000', nonce: '0x' + '22'.repeat(32), validAfter: 0, validBefore: 60 },
};

test('raw and exported records reject malformed optional signature components', () => {
  for (const fields of [{ r: {} }, { r: '0x12' }, { s: '0x' + 'zz'.repeat(32) }, { s: 42 },
    { v: '27' }, { v: -1 }, { v: 256 }, { v: 27.5 }, { v: NaN }, { v: null }]) {
    const candidate = { ...proof, eip3009Details: { ...proof.eip3009Details!, ...fields } } as unknown as PaymentProofRecord;
    assert.equal(isProofRecord(candidate), false, JSON.stringify(fields));
    assert.equal(parseAndValidateReceipt(candidate).valid, false);
    assert.equal(parseAndValidateReceipt(buildVerifiableReceipt(candidate)).valid, false);
  }
});

test('absent, partial and structurally valid uint8/bytes32 fields remain supported', () => {
  for (const fields of [{}, { v: 0 }, { v: 1 }, { v: 27 }, { v: 28 }, { v: 255 },
    { r: '0x' + 'aB'.repeat(32) }, { r: '0x' + '11'.repeat(32), s: '0x' + '22'.repeat(32), v: 27 }]) {
    const candidate = { ...proof, eip3009Details: { ...proof.eip3009Details!, ...fields } };
    assert.equal(isProofRecord(candidate), true);
    const exported = buildVerifiableReceipt(candidate);
    assert.equal(parseAndValidateReceipt(exported).valid, true);
    assert.equal(exported.verification.clientVerified, false);
  }
});

test('storage reads and imports exclude malformed components through the same gate', () => {
  const invalid = { ...proof, id: 'bad', eip3009Details: { ...proof.eip3009Details!, r: '0x12' } };
  let raw = JSON.stringify([proof, invalid]);
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: () => raw, setItem: (_key: string, value: string) => { raw = value; },
  } });
  assert.deepEqual(getStoredProofs(), [proof]);
  assert.deepEqual(importProofs([{ ...invalid, id: 'incoming' }]), { added: 0, total: 1 });
});
