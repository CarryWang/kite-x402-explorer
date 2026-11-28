import test from 'node:test';
import assert from 'node:assert/strict';
import { getStoredProofs, importProofs, MAX_STORED_PROOFS } from '../src/services/proof-logger.js';
import { buildVerifiableReceipt, parseAndValidateReceipt } from '../src/lib/receipt-exporter.js';
import type { PaymentProofRecord } from '../src/types/proof.js';

const address = '0x' + '11'.repeat(20);
const DAY = 86_400_000;
const BASE = Date.parse('2026-11-20T00:00:00Z');

/** A valid record `daysAgo` days before BASE. */
function proof(id: string, daysAgo: number): PaymentProofRecord {
  return {
    id, timestamp: new Date(BASE - daysAgo * DAY).toISOString(), serviceName: 'weather', serviceDisplayName: 'Weather',
    endpointPath: '/v1/x', httpMethod: 'GET', network: 'eip155:2368', tokenSymbol: 'pieUSD', tokenAddress: address,
    amountFormatted: '1 pieUSD', amountRaw: '1000', payerAddress: address, payToAddress: address,
    status: 'simulated', responseStatus: 200,
  };
}

function useStorage(records: PaymentProofRecord[]) {
  let raw: string | null = JSON.stringify(records);
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: () => raw, setItem: (_key: string, value: string) => { raw = value; }, removeItem: () => { raw = null; },
  } });
}

const ids = (records: PaymentProofRecord[]) => records.map((p) => p.id);

test('importing an old receipt into a full log does not push out a newer local record', () => {
  // A full log, newest first: local-0 (today) ... local-99 (99 days ago).
  const local = Array.from({ length: MAX_STORED_PROOFS }, (_, i) => proof(`local-${i}`, i));
  useStorage(local);

  const result = importProofs([proof('imported-old', 365)]);

  assert.deepEqual(result, { added: 0, skipped: 1, total: MAX_STORED_PROOFS });
  assert.deepEqual(ids(getStoredProofs()), ids(local), 'the log is unchanged');
});

test('a newer imported record takes the place of the oldest one, in date order', () => {
  const local = Array.from({ length: MAX_STORED_PROOFS }, (_, i) => proof(`local-${i}`, i + 1));
  useStorage(local);

  const result = importProofs([proof('imported-new', 0), proof('imported-mid', 50.5)]);

  assert.deepEqual(result, { added: 2, skipped: 0, total: MAX_STORED_PROOFS });
  const stored = ids(getStoredProofs());
  assert.equal(stored[0], 'imported-new');
  assert.equal(stored.indexOf('imported-mid'), 51); // after local-49 (50 days) and before local-50 (51 days)
  assert.equal(stored.includes('local-98'), false); // the two oldest made room
  assert.equal(stored.includes('local-99'), false);
  assert.equal(stored.includes('local-0'), true);
});

test('imported records are merged into date order, not stacked on top', () => {
  useStorage([proof('today', 0), proof('last-week', 7)]);
  importProofs([proof('two-days-ago', 2), proof('last-month', 30)]);
  assert.deepEqual(ids(getStoredProofs()), ['today', 'two-days-ago', 'last-week', 'last-month']);
});

test('an exported batch can be imported back into an empty log in the same order', () => {
  const original = [proof('a', 0), proof('b', 1), proof('c', 2)];
  const receipts = original.map(buildVerifiableReceipt).map((r) => parseAndValidateReceipt(r).proofRecord!);
  useStorage([]);
  assert.deepEqual(importProofs([...receipts].reverse()), { added: 3, skipped: 0, total: 3 });
  assert.deepEqual(ids(getStoredProofs()), ['a', 'b', 'c']);
});
