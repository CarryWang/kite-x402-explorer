import test from 'node:test';
import assert from 'node:assert/strict';
const A = '0x1111111111111111111111111111111111111111' as const;
const B = '0x2222222222222222222222222222222222222222' as const;
const C = '0x3333333333333333333333333333333333333333' as const;
import { AgentSubgraphIndexer, type IndexedPaymentEvent } from '../src/lib/agent-subgraph-indexer.js';

function event(): IndexedPaymentEvent { return { eventId: 'one', txHash: 'local-fixture', blockNumber: 1,
  payerAddress: A, recipientAddress: B, network: 'eip155:2368', amountAtomic: 100n, status: 'SETTLED', timestamp: 1000 }; }

test('query rows cannot change settlement volume or indexed payer membership', () => {
  const indexer = new AgentSubgraphIndexer(); indexer.ingest(event());
  const row = indexer.query({ payerAddress: A })[0];
  row.amountAtomic = 900n; row.payerAddress = C; row.eventId = 'other';
  assert.equal(indexer.getMetrics().totalSettledVolumeAtomic, 100n);
  assert.equal(indexer.query({ payerAddress: A })[0].payerAddress, A);
  assert.equal(indexer.query({ payerAddress: C }).length, 0);
});

test('pagination and replacing an event still keep independent query snapshots', () => {
  const indexer = new AgentSubgraphIndexer(); indexer.ingest(event());
  const old = indexer.query()[0];
  indexer.ingest({ ...event(), recipientAddress: C, amountAtomic: 50n });
  assert.equal(old.recipientAddress, B);
  assert.equal(indexer.query({ recipientAddress: B }).length, 0);
  assert.equal(indexer.query({}, 1, 0)[0].amountAtomic, 50n);
});
