import test from 'node:test';
import assert from 'node:assert/strict';
import * as exportModal from '../src/components/common/TxReceiptExportModal.js';
import { parseAndValidateReceipt } from '../src/lib/receipt-exporter.js';
import type { PaymentProofRecord } from '../src/types/proof.js';

const address = '0x' + '11'.repeat(20);
const proof: PaymentProofRecord = {
  id: 'proof-1', timestamp: '2026-11-01T00:00:00Z', serviceName: '=HYPERLINK("bad")',
  serviceDisplayName: 'Weather', endpointPath: '/', httpMethod: 'GET', network: 'eip155:2368',
  tokenSymbol: 'pieUSD', tokenAddress: address, amountFormatted: '1 pieUSD', amountRaw: '1000000000000000000',
  payerAddress: address, payToAddress: address, status: 'simulated', responseStatus: 200,
};

test('receipt JSON uses the canonical importable schema', () => {
  const mod = exportModal as Record<string, any>;
  assert.equal(typeof mod.buildReceiptExportJson, 'function');
  const json = JSON.parse(mod.buildReceiptExportJson([proof]));
  assert.equal(json.receipts.length, 1);
  assert.equal(parseAndValidateReceipt(json.receipts[0]).valid, true);
  assert.equal(json.receipts[0].payment.settlement.settled, false);
});

test('CSV quotes separators and neutralizes spreadsheet formulas', () => {
  const mod = exportModal as Record<string, any>;
  assert.equal(typeof mod.serializeReceiptsCsv, 'function');
  const csv: string = mod.serializeReceiptsCsv([proof]);
  assert.match(csv, /amountRaw/);
  assert.doesNotMatch(csv, /amountGwei/);
  assert.match(csv, /"'=HYPERLINK\(""bad""\)"/);
  assert.match(csv, /"simulated"/);
});
