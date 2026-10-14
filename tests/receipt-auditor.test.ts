import assert from 'node:assert/strict';
import test from 'node:test';
import { ReceiptAnomalyAuditor } from '../src/lib/receipt-auditor.ts';
import type { PaymentProofRecord } from '../src/types/proof.ts';

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
});
