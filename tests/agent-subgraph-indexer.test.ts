import { describe, it, expect } from './vitest-compat.js';
import { AgentSubgraphIndexer, IndexedPaymentEvent } from '../src/lib/agent-subgraph-indexer';

describe('AgentSubgraphIndexer', () => {
  const sampleEvents: IndexedPaymentEvent[] = [
    {
      eventId: 'evt-1',
      txHash: '0xaaa',
      blockNumber: 100,
      payerAddress: '0xAlice',
      recipientAddress: '0xServer',
      network: 'kite-mainnet',
      amountAtomic: 10_000_000n,
      status: 'SETTLED',
      timestamp: 1000,
    },
    {
      eventId: 'evt-2',
      txHash: '0xbbb',
      blockNumber: 105,
      payerAddress: '0xBob',
      recipientAddress: '0xServer',
      network: 'kite-mainnet',
      amountAtomic: 5_000_000n,
      status: 'SETTLED',
      timestamp: 1200,
    },
    {
      eventId: 'evt-3',
      txHash: '0xccc',
      blockNumber: 110,
      payerAddress: '0xAlice',
      recipientAddress: '0xOther',
      network: 'kite-testnet',
      amountAtomic: 2_000_000n,
      status: 'FAILED',
      timestamp: 1400,
    },
  ];

  it('ingests events and supports filtered queries by payer and network', () => {
    const indexer = new AgentSubgraphIndexer();
    for (const ev of sampleEvents) {
      indexer.ingest(ev);
    }

    expect(indexer.size()).toBe(3);

    const aliceEvents = indexer.query({ payerAddress: '0xalice' });
    expect(aliceEvents.length).toBe(2);

    const mainnetEvents = indexer.query({ network: 'kite-mainnet' });
    expect(mainnetEvents.length).toBe(2);
  });

  it('aggregates volume metrics correctly', () => {
    const indexer = new AgentSubgraphIndexer();
    for (const ev of sampleEvents) {
      indexer.ingest(ev);
    }

    const metrics = indexer.getMetrics({ network: 'kite-mainnet' });
    expect(metrics.totalEventsCount).toBe(2);
    expect(metrics.settledCount).toBe(2);
    expect(metrics.failedCount).toBe(0);
    expect(metrics.totalSettledVolumeAtomic).toBe(15_000_000n);
    expect(metrics.uniquePayersCount).toBe(2);
    expect(metrics.uniqueRecipientsCount).toBe(1);
  });

  it('removes stale address index entries when an event is replaced', () => {
    const indexer = new AgentSubgraphIndexer();
    indexer.ingest(sampleEvents[0]);
    indexer.ingest({ ...sampleEvents[0], payerAddress: '0xBob', recipientAddress: '0xOther' });
    expect(indexer.query({ payerAddress: '0xAlice' }).length).toBe(0);
    expect(indexer.query({ recipientAddress: '0xServer' }).length).toBe(0);
    expect(indexer.query({ payerAddress: '0xBob' }).length).toBe(1);
  });
});
