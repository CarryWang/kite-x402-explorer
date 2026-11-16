import test from 'node:test';
import assert from 'node:assert/strict';
import { buildVerifiableReceipt, parseAndValidateReceipt } from '../src/lib/receipt-exporter.js';
import { getStoredProofs, importProofs } from '../src/services/proof-logger.js';
import type { PaymentProofRecord } from '../src/types/proof.js';

const address = '0x' + '11'.repeat(20);
const proof: PaymentProofRecord = {
  id: 'proof-1', timestamp: '2026-11-01T00:00:00Z', serviceName: 'weather', serviceDisplayName: 'Weather',
  endpointPath: '/', httpMethod: 'GET', network: 'eip155:2368', tokenSymbol: 'pieUSD', tokenAddress: address,
  amountFormatted: '1 pieUSD', amountRaw: '1000', payerAddress: address, payToAddress: address,
  status: 'simulated', responseStatus: 200,
};

test('both formats reject malformed fields instead of accepting truthy objects', () => {
  for (const bad of [null, [], { id: 'a', serviceName: 'b', network: 'unknown', payerAddress: {} },
    { ...proof, payerAddress: {} }, { ...proof, serviceDisplayName: undefined },
    { ...proof, network: 'unknown' }, { ...proof, amountRaw: '-1' },
    { ...proof, amountRaw: (2n ** 256n).toString() }, { ...proof, status: 'made-up' },
    { ...proof, status: 'settled' }, { ...proof, timestamp: 'not-a-date' }]) {
    assert.equal(parseAndValidateReceipt(bad).valid, false);
  }
  const canonical = buildVerifiableReceipt(proof);
  assert.equal(parseAndValidateReceipt({ ...canonical, protocol: { ...canonical.protocol, version: 99 } }).valid, false);
  assert.equal(parseAndValidateReceipt({ ...canonical, payment: { ...canonical.payment, payer: [] } }).valid, false);
});

test('valid export/import roundtrips remain structurally valid without claiming chain verification', () => {
  assert.equal(parseAndValidateReceipt(proof).valid, true);
  const exported = buildVerifiableReceipt(proof);
  assert.equal(exported.verification.clientVerified, false);
  const result = parseAndValidateReceipt(exported);
  assert.equal(result.valid, true, result.errors.join(', '));
  assert.equal(result.proofRecord?.payerAddress, proof.payerAddress);
  assert.equal(result.proofRecord?.amountRaw, proof.amountRaw);
});

test('storage recovers from wrong shapes and excludes invalid imported records', () => {
  let raw = '{}';
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: () => raw, setItem: (_key: string, value: string) => { raw = value; },
  } });
  assert.deepEqual(getStoredProofs(), []);
  raw = JSON.stringify([proof, { id: 'bad' }]);
  assert.deepEqual(getStoredProofs(), [proof]);
  assert.deepEqual(importProofs([{ ...proof, id: 'new' }, { id: 'bad' } as PaymentProofRecord]), { added: 1, total: 2 });
});
