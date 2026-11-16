import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { proofRecordErrors } from '../src/lib/proof-schema.js';
import { buildVerifiableReceipt, parseAndValidateReceipt } from '../src/lib/receipt-exporter.js';
import { GasTrendWidget } from '../src/components/analytics/GasTrendWidget.js';
import { PriorityFeeAdvisor } from '../src/components/gas/PriorityFeeAdvisor.js';
import * as proofDrawer from '../src/components/common/ProofLogDrawer.js';
import { computeFeeRecommendations } from '../src/utils/fee-estimator.js';
import type { PaymentProofRecord } from '../src/types/proof.js';

const address = `0x${'11'.repeat(20)}`;
const otherAddress = `0x${'22'.repeat(20)}`;
const hash = `0x${'33'.repeat(32)}`;
const proof: PaymentProofRecord = {
  id: 'proof-1', timestamp: '2026-11-01T00:00:00Z', serviceName: 'weather',
  serviceDisplayName: 'Weather', endpointPath: '/', httpMethod: 'GET',
  network: 'eip155:2368', tokenSymbol: 'pieUSD', tokenAddress: address,
  amountFormatted: '1 pieUSD', amountRaw: '1000', payerAddress: address,
  payToAddress: otherAddress, status: 'simulated', responseStatus: 200,
};

test('rejects a zero-deduction claim that also reports a transaction hash', () => {
  const contradictory = { ...proof, status: 'aborted_502' as const, responseStatus: 502, txHash: hash };
  assert.match(proofRecordErrors(contradictory).join(' '), /aborted|transaction/i);
  assert.equal(parseAndValidateReceipt(contradictory).valid, false);

  const exported = buildVerifiableReceipt(contradictory);
  assert.equal(parseAndValidateReceipt(exported).valid, false);
});

test('rejects authorization values that disagree with the payment record', () => {
  const auth = {
    from: address, to: otherAddress, value: '1000', validAfter: 0,
    validBefore: 100, nonce: hash,
  };
  for (const mismatch of [
    { ...auth, from: otherAddress },
    { ...auth, to: address },
    { ...auth, value: '2000' },
  ]) {
    assert.match(proofRecordErrors({ ...proof, eip3009Details: mismatch }).join(' '), /authorization|payment/i);
  }
  assert.deepEqual(proofRecordErrors({ ...proof, eip3009Details: auth }), []);
  assert.doesNotThrow(() => proofRecordErrors({ ...proof, amountRaw: 'invalid', eip3009Details: auth }));
});

test('gas widget shows only supplied measurements and an honest empty state', () => {
  const empty = renderToStaticMarkup(React.createElement(GasTrendWidget, { dataPoints: [] }));
  assert.match(empty, /No gas measurements available/);
  assert.doesNotMatch(empty, /Live|0\.0000 Gwei/);

  const observed = renderToStaticMarkup(React.createElement(GasTrendWidget, {
    dataPoints: [
      { blockNumber: 1, baseFeeGwei: 1, priorityFeeGwei: 0.1, latencyMs: 100, timestamp: 1 },
      { blockNumber: 2, baseFeeGwei: 3, priorityFeeGwei: 0.2, latencyMs: 300, timestamp: 2 },
    ],
  }));
  assert.match(observed, /3\.0000 Gwei/);
  assert.match(observed, /2\.0000 Gwei/);
  assert.doesNotMatch(observed, /Live/);
});

test('fee tiers derive from observed samples and disappear without observations', () => {
  assert.deepEqual(computeFeeRecommendations({ baseFeeGwei: 0.1, priorityFeeSamplesGwei: [] }), []);
  assert.deepEqual(computeFeeRecommendations({ baseFeeGwei: Number.NaN, priorityFeeSamplesGwei: [0.01] }), []);
  const tiers = computeFeeRecommendations({
    baseFeeGwei: 0.1,
    priorityFeeSamplesGwei: [0.01, 0.02, 0.03, 0.04, 0.05],
  });
  assert.deepEqual(tiers.map((tier) => tier.maxPriorityFeePerGasGwei), [0.02, 0.03, 0.04]);
  assert.deepEqual(tiers.map((tier) => tier.maxFeePerGasGwei), [0.22, 0.23, 0.24]);
  assert.equal(tiers.some((tier) => 'estimatedWaitSeconds' in tier), false);

  const empty = renderToStaticMarkup(React.createElement(PriorityFeeAdvisor, { observation: null }));
  assert.match(empty, /No fee observations available/);
  assert.doesNotMatch(empty, /Recommended|~\d+s/);
});

test('proof drawer describes imported settlement and abort statuses as reports', () => {
  const label = (proofDrawer as unknown as { proofStatusLabel?: (status: string) => string }).proofStatusLabel;
  assert.equal(typeof label, 'function');
  assert.match(label!('settled'), /reported/i);
  assert.doesNotMatch(label!('settled'), /settled on-chain/i);
  assert.match(label!('aborted_502'), /reported/i);
  assert.doesNotMatch(label!('aborted_502'), /no deduction/i);
});
