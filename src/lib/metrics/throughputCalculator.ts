export interface SettlementEvent {
  timestampMs: number;
}

export interface ThroughputStats {
  tps: number;
  sampleCount: number;
}

export class ThroughputCalculator {
  private events: SettlementEvent[] = [];

  constructor(private readonly windowMs: number = 60000) {
    if (!Number.isFinite(windowMs) || windowMs <= 0) throw new RangeError('windowMs must be positive and finite');
  }

  public recordEvent(timestampMs: number): void {
    if (!Number.isFinite(timestampMs) || timestampMs < 0) throw new RangeError('timestampMs must be non-negative and finite');
    this.events.push({ timestampMs });
  }

  public getStats(nowMs: number = Date.now()): ThroughputStats {
    if (!Number.isFinite(nowMs) || nowMs < 0) throw new RangeError('nowMs must be non-negative and finite');
    const cutoff = nowMs - this.windowMs;
    this.events = this.events.filter((e) => e.timestampMs >= cutoff && e.timestampMs <= nowMs);
    const sampleCount = this.events.length;
    return { tps: sampleCount / (this.windowMs / 1000), sampleCount };
  }
}

export default ThroughputCalculator;
