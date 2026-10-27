/**
 * Autonomous AI Agent Event Subgraph & Micro-Indexer for x402 on-chain activities.
 * Indexes payment requests, settlements, and agent-to-agent interactions
 * with multi-index query filtering and aggregated volume analytics.
 */

export interface IndexedPaymentEvent {
  eventId: string;
  txHash: string;
  blockNumber: number;
  payerAddress: string;
  recipientAddress: string;
  network: string;
  amountAtomic: bigint;
  status: 'SETTLED' | 'FAILED' | 'PENDING';
  timestamp: number;
}

export interface SubgraphQueryFilter {
  payerAddress?: string;
  recipientAddress?: string;
  network?: string;
  status?: 'SETTLED' | 'FAILED' | 'PENDING';
  fromBlock?: number;
  toBlock?: number;
  fromTimestamp?: number;
  toTimestamp?: number;
}

export interface SubgraphVolumeMetrics {
  totalSettledVolumeAtomic: bigint;
  totalEventsCount: number;
  settledCount: number;
  failedCount: number;
  uniquePayersCount: number;
  uniqueRecipientsCount: number;
}

export class AgentSubgraphIndexer {
  private events: Map<string, IndexedPaymentEvent> = new Map();
  private payerIndex: Map<string, Set<string>> = new Map();
  private recipientIndex: Map<string, Set<string>> = new Map();

  /**
   * Ingests a new payment event into the indexer.
   */
  public ingest(event: IndexedPaymentEvent): void {
    const payerKey = event.payerAddress.toLowerCase();
    const recipientKey = event.recipientAddress.toLowerCase();
    const previous = this.events.get(event.eventId);
    if (previous) {
      this.payerIndex.get(previous.payerAddress)?.delete(event.eventId);
      this.recipientIndex.get(previous.recipientAddress)?.delete(event.eventId);
    }

    this.events.set(event.eventId, {
      ...event,
      payerAddress: payerKey,
      recipientAddress: recipientKey,
    });

    if (!this.payerIndex.has(payerKey)) {
      this.payerIndex.set(payerKey, new Set());
    }
    this.payerIndex.get(payerKey)!.add(event.eventId);

    if (!this.recipientIndex.has(recipientKey)) {
      this.recipientIndex.set(recipientKey, new Set());
    }
    this.recipientIndex.get(recipientKey)!.add(event.eventId);
  }

  /**
   * Queries events matching the criteria.
   */
  public query(filter: SubgraphQueryFilter = {}, limit: number = 100, offset: number = 0): IndexedPaymentEvent[] {
    let candidateEventIds: Set<string> | null = null;

    if (filter.payerAddress) {
      candidateEventIds = this.payerIndex.get(filter.payerAddress.toLowerCase()) ?? new Set();
    }

    if (filter.recipientAddress) {
      const recipientIds = this.recipientIndex.get(filter.recipientAddress.toLowerCase()) ?? new Set();
      if (candidateEventIds === null) {
        candidateEventIds = recipientIds;
      } else {
        candidateEventIds = new Set([...candidateEventIds].filter((id) => recipientIds.has(id)));
      }
    }

    const baseList: IndexedPaymentEvent[] = candidateEventIds
      ? Array.from(candidateEventIds).map((id) => this.events.get(id)!).filter(Boolean)
      : Array.from(this.events.values());

    const filtered = baseList.filter((event) => {
      if (filter.network && event.network !== filter.network) return false;
      if (filter.status && event.status !== filter.status) return false;
      if (filter.fromBlock !== undefined && event.blockNumber < filter.fromBlock) return false;
      if (filter.toBlock !== undefined && event.blockNumber > filter.toBlock) return false;
      if (filter.fromTimestamp !== undefined && event.timestamp < filter.fromTimestamp) return false;
      if (filter.toTimestamp !== undefined && event.timestamp > filter.toTimestamp) return false;
      return true;
    });

    // Sort descending by timestamp
    filtered.sort((a, b) => b.timestamp - a.timestamp);

    return filtered.slice(offset, offset + limit);
  }

  /**
   * Aggregates total volume and failure statistics.
   */
  public getMetrics(filter: SubgraphQueryFilter = {}): SubgraphVolumeMetrics {
    const events = this.query(filter, Number.MAX_SAFE_INTEGER, 0);

    let totalSettledVolumeAtomic = 0n;
    let settledCount = 0;
    let failedCount = 0;
    const uniquePayers = new Set<string>();
    const uniqueRecipients = new Set<string>();

    for (const ev of events) {
      uniquePayers.add(ev.payerAddress);
      uniqueRecipients.add(ev.recipientAddress);

      if (ev.status === 'SETTLED') {
        settledCount++;
        totalSettledVolumeAtomic += ev.amountAtomic;
      } else if (ev.status === 'FAILED') {
        failedCount++;
      }
    }

    return {
      totalSettledVolumeAtomic,
      totalEventsCount: events.length,
      settledCount,
      failedCount,
      uniquePayersCount: uniquePayers.size,
      uniqueRecipientsCount: uniqueRecipients.size,
    };
  }

  public size(): number {
    return this.events.size;
  }
}
