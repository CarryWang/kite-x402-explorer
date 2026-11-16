export interface SettlementEvent {
  timestampMs: number;
  amountGwei: number;
}

export interface ThroughputStats {
  tps: number;
  totalGwei: number;
  sampleCount: number;
}

export class ThroughputCalculator {
  private windowMs: number;
  private events: SettlementEvent[];

  constructor(windowMs: number = 60000) {
    this.windowMs = windowMs;
    this.events = [];
  }

  public recordEvent(amountGwei: number): void {
    this.events.push({ timestampMs: Date.now(), amountGwei });
    this.evictOldEvents();
  }

  public getStats(): ThroughputStats {
    this.evictOldEvents();
    const count = this.events.length;
    const totalGwei = this.events.reduce((sum, e) => sum + e.amountGwei, 0);
    const windowSeconds = this.windowMs / 1000;
    const tps = parseFloat((count / windowSeconds).toFixed(2));

    return { tps, totalGwei, sampleCount: count };
  }

  private evictOldEvents(): void {
    const cutoff = Date.now() - this.windowMs;
    this.events = this.events.filter((e) => e.timestampMs >= cutoff);
  }
}

export default ThroughputCalculator;
