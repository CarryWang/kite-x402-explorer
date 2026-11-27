import test from 'node:test';
import assert from 'node:assert/strict';
import { saveProof, importProofs, getStoredProofs, subscribeToProofs, clearAllProofs } from '../src/services/proof-logger.js';
import type { PaymentProofRecord } from '../src/types/proof.js';

const address = '0x' + '11'.repeat(20);
function proof(): PaymentProofRecord {
  return {
    id: 'local-fixture', timestamp: '2026-11-01T00:00:00Z', serviceName: 'weather', serviceDisplayName: 'Weather',
    endpointPath: '/', httpMethod: 'GET', network: 'eip155:2368', tokenSymbol: 'pieUSD', tokenAddress: address,
    amountFormatted: '1 pieUSD', amountRaw: '1000', payerAddress: address, payToAddress: address,
    status: 'simulated', responseStatus: 200,
    eip3009Details: { from: address, to: address, value: '1000', nonce: '0x' + '22'.repeat(32), validAfter: 0, validBefore: 60 },
  };
}

function storage() {
  let raw: string | null = null;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: () => raw, setItem: (_key: string, value: string) => { raw = value; }, removeItem: () => { raw = null; },
  } });
}

test('a listener cannot alter the array or nested payment metadata delivered to another listener', () => {
  storage();
  let observed: PaymentProofRecord[] = [];
  const offFirst = subscribeToProofs(records => {
    records[0].status = 'settled';
    records[0].eip3009Details!.value = '9999';
    records.length = 0;
  });
  const offSecond = subscribeToProofs(records => { observed = records; });
  try {
    saveProof(proof());
    assert.deepEqual(observed, [proof()]);
    assert.deepEqual(getStoredProofs(), [proof()]);
  } finally { offFirst(); offSecond(); }
});

test('save return values and import arguments do not remain aliased to delivered component state', () => {
  storage();
  let observed: PaymentProofRecord[] = [];
  const off = subscribeToProofs(records => { observed = records; });
  try {
    const saved = saveProof(proof());
    saved.eip3009Details!.value = '9999';
    assert.equal(observed[0].eip3009Details!.value, '1000');
    const incoming = { ...proof(), id: 'imported' };
    importProofs([incoming]);
    incoming.status = 'failed';
    incoming.eip3009Details!.value = '9999';
    assert.equal(observed[0].status, 'simulated');
    assert.equal(observed[0].eip3009Details!.value, '1000');
  } finally { off(); }
});

test('JSON-compatible extra properties and clear/unsubscribe retain their behavior', () => {
  storage();
  let calls = 0;
  let observed: PaymentProofRecord[] = [];
  const off = subscribeToProofs(records => { calls++; observed = records; });
  try {
    // 与 localStorage 的 JSON 语义一致：调用方额外的函数属性不会成为支付证据。
    saveProof(Object.assign(proof(), { ignored: () => 'fixture' }));
    assert.equal(observed.length, 1);
    assert.equal(Object.hasOwn(observed[0], 'ignored'), false);
    clearAllProofs();
    assert.deepEqual(observed, []);
    assert.equal(calls, 2);
  } finally { off(); }
  saveProof(proof());
  assert.equal(calls, 2);
});
