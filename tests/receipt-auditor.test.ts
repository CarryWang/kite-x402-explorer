import assert from 'node:assert/strict';
import test from 'node:test';
import { ReceiptAnomalyAuditor } from '../src/lib/receipt-auditor.ts';
import type { PaymentProofRecord } from '../src/types/proof.ts';
import { buildVerifiableReceipt } from '../src/lib/receipt-exporter.ts';
import { formatDisputeDigest, type OptimisticDisputeClaim } from '../src/lib/dispute-arbiter.ts';

test('simulated receipt is counted separately from settled and failed payments', () => {
  const proof: PaymentProofRecord = {
    id: 'sim-1', timestamp: new Date().toISOString(), serviceName: 'demo',
    serviceDisplayName: 'Demo', endpointPath: '/v1/demo', httpMethod: 'POST',
    network: 'eip155:2368', tokenSymbol: 'pieUSD', tokenAddress: '0x0',
    amountFormatted: '0.001', amountRaw: '100', payerAddress: '0x1', payToAddress: '0x2',
    status: 'simulated', responseStatus: 200,
  };
  const stats = new ReceiptAnomalyAuditor().auditBatch([proof]).stats;
  assert.equal(stats.settledCount, 0);
  assert.equal(stats.failureCount, 0);
  assert.equal(stats.simulatedCount, 1);
  const exported = buildVerifiableReceipt(proof);
  assert.equal(exported.payment.settlement.settled, false);
  assert.equal(exported.verification.clientVerified, false);
  assert.match(exported.verification.guaranteeNote, /simulat/i);
});

test('nonce replay detection scopes nonce to payer and token contract', () => {
  const base: PaymentProofRecord = {
    id: 'one', timestamp: new Date().toISOString(), serviceName: 'demo', serviceDisplayName: 'Demo',
    endpointPath: '/', httpMethod: 'POST', network: 'eip155:2368', tokenSymbol: 'pieUSD',
    tokenAddress: '0x01', amountFormatted: '1', amountRaw: '1', payerAddress: '0x01',
    payToAddress: '0x02', status: 'settled', responseStatus: 200,
    eip3009Details: { from: '0x01', to: '0x02', value: '1', validAfter: 0, validBefore: 100, nonce: '0xabc' },
  };
  const auditor = new ReceiptAnomalyAuditor();
  assert.equal(auditor.auditBatch([base, { ...base, id: 'two', payerAddress: '0x03', eip3009Details: { ...base.eip3009Details!, from: '0x03' } }]).anomalies.length, 0);
  assert.equal(auditor.auditBatch([base, { ...base, id: 'three', tokenAddress: '0x04' }]).anomalies.length, 0);
  assert.equal(auditor.auditBatch([base, { ...base, id: 'four' }]).anomalies.length, 1);
});

test('expired dispute cannot be marked eligible for slashing', () => {
  const claim: OptimisticDisputeClaim = {
    disputeId: 'dispute', txHash: '0x01', payer: '0x01', payee: '0x02',
    paymentValueWei: 1n, challengerBondWei: 1n, reason: 'invalid_output_hash',
    createdAtTimestamp: 0, challengeWindowSeconds: 60, status: 'opened',
  };
  assert.equal(formatDisputeDigest(claim).isEligibleForSlashing, false);
});
