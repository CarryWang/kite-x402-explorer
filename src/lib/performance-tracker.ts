export interface SettlementLatencyMetric {
  serviceName: string;
  endpointPath: string;
  step1ProbeMs: number;
  step2SigningMs: number;
  step3SettlementMs: number;
  totalRoundtripMs: number;
  timestamp: number;
  success: boolean;
}

export interface ServicePerformanceSummary {
  serviceName: string;
  sampleCount: number;
  avgProbeMs: number;
  avgSigningMs: number;
  avgSettlementMs: number;
  avgTotalMs: number;
  successRate: number;
}

export class ProtocolPerformanceTracker {
  private metrics: SettlementLatencyMetric[] = [];
  private readonly maxSamples: number;

  constructor(maxSamples: number = 50) {
    this.maxSamples = maxSamples;
  }

  public recordMetric(metric: SettlementLatencyMetric): void {
    this.metrics.push(metric);
    if (this.metrics.length > this.maxSamples) {
      this.metrics.shift();
    }
  }

  public getSummary(serviceName?: string): ServicePerformanceSummary | null {
    const list = serviceName
      ? this.metrics.filter((m) => m.serviceName === serviceName)
      : this.metrics;

    if (list.length === 0) {
      return null;
    }

    const total = list.length;
    const successes = list.filter((m) => m.success).length;

    const sumProbe = list.reduce((a, b) => a + b.step1ProbeMs, 0);
    const sumSigning = list.reduce((a, b) => a + b.step2SigningMs, 0);
    const sumSettlement = list.reduce((a, b) => a + b.step3SettlementMs, 0);
    const sumTotal = list.reduce((a, b) => a + b.totalRoundtripMs, 0);

    return {
      serviceName: serviceName || 'all-services',
      sampleCount: total,
      avgProbeMs: Math.round(sumProbe / total),
      avgSigningMs: Math.round(sumSigning / total),
      avgSettlementMs: Math.round(sumSettlement / total),
      avgTotalMs: Math.round(sumTotal / total),
      successRate: Math.round((successes / total) * 100),
    };
  }

  public getAllMetrics(): SettlementLatencyMetric[] {
    return [...this.metrics];
  }

  public clear(): void {
    this.metrics = [];
  }
}
