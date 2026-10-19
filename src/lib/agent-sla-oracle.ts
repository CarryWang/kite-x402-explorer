/**
 * Agent Service Level Agreement (SLA) Oracle & Automated Slashing Protocol
 *
 * Provides real-time decentralized heartbeat tracking, rolling latency evaluations,
 * and automated slashing penalty enforcement for autonomous AI agent services.
 */

export interface SLASpec {
  provider: string;
  serviceId: string;
  minUptimePercent: number;      // e.g. 99.5%
  maxP95LatencyMs: number;       // e.g. 800ms
  maxErrorRatePercent: number;    // e.g. 1.0%
  stakedCollateralKite: number;   // e.g. 1000 KITE
  penaltyPerBreachKite: number;   // e.g. 50 KITE
}

export interface AgentHeartbeat {
  agentAddress: string;
  serviceId: string;
  timestamp: number;
  blockNumber: number;
  latencyMs: number;
  statusCode: number;
  signature: string;
}

export interface SLAMetricSnapshot {
  serviceId: string;
  totalPings: number;
  successfulPings: number;
  failedPings: number;
  uptimePercent: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  isCompliant: boolean;
  lastUpdated: number;
}

export interface SLAViolationPenalty {
  penaltyId: string;
  serviceId: string;
  provider: string;
  violationReason: 'UPTIME_BREACH' | 'LATENCY_EXCEEDED' | 'ERROR_RATE_HIGH';
  slashedAmountKite: number;
  remainingCollateralKite: number;
  timestamp: number;
  refundPoolAllocatedKite: number;
}

export interface SLARefundVoucher {
  voucherId: string;
  recipientCaller: string;
  serviceId: string;
  breachPenaltyId: string;
  rebateAmountKite: number;
  issuedAt: number;
  isRedeemed: boolean;
}

export class AgentSLAOracle {
  private slaConfigs: Map<string, SLASpec> = new Map();
  private heartbeats: Map<string, AgentHeartbeat[]> = new Map();
  private penalties: SLAViolationPenalty[] = [];
  private refundVouchers: Map<string, SLARefundVoucher> = new Map();

  /**
   * Registers or updates an SLA specification for an agent service.
   */
  public registerSLASpec(spec: SLASpec): void {
    this.slaConfigs.set(spec.serviceId, { ...spec });
    if (!this.heartbeats.has(spec.serviceId)) {
      this.heartbeats.set(spec.serviceId, []);
    }
  }

  /**
   * Records an authenticated telemetry heartbeat ping.
   */
  public recordHeartbeat(ping: AgentHeartbeat): void {
    const list = this.heartbeats.get(ping.serviceId) || [];
    list.push(ping);
    // Keep last 1000 pings for rolling window analysis
    if (list.length > 1000) {
      list.shift();
    }
    this.heartbeats.set(ping.serviceId, list);
  }

  /**
   * Computes a rolling SLA compliance snapshot.
   */
  public evaluateSLAMetrics(serviceId: string): SLAMetricSnapshot {
    const pings = this.heartbeats.get(serviceId) || [];
    const spec = this.slaConfigs.get(serviceId);

    if (pings.length === 0) {
      return {
        serviceId,
        totalPings: 0,
        successfulPings: 0,
        failedPings: 0,
        uptimePercent: 100,
        avgLatencyMs: 0,
        p95LatencyMs: 0,
        isCompliant: true,
        lastUpdated: Date.now(),
      };
    }

    const totalPings = pings.length;
    const successfulPings = pings.filter((p) => p.statusCode >= 200 && p.statusCode < 400).length;
    const failedPings = totalPings - successfulPings;
    const uptimePercent = parseFloat(((successfulPings / totalPings) * 100).toFixed(2));

    const latencies = pings.map((p) => p.latencyMs).sort((a, b) => a - b);
    const avgLatencyMs = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
    const p95Idx = Math.floor(latencies.length * 0.95);
    const p95LatencyMs = latencies[Math.min(p95Idx, latencies.length - 1)];

    let isCompliant = true;
    if (spec) {
      if (uptimePercent < spec.minUptimePercent) isCompliant = false;
      if (p95LatencyMs > spec.maxP95LatencyMs) isCompliant = false;
      const errorRate = (failedPings / totalPings) * 100;
      if (errorRate > spec.maxErrorRatePercent) isCompliant = false;
    }

    return {
      serviceId,
      totalPings,
      successfulPings,
      failedPings,
      uptimePercent,
      avgLatencyMs,
      p95LatencyMs,
      isCompliant,
      lastUpdated: Date.now(),
    };
  }

  /**
   * Checks compliance and triggers automated slashing when SLA is breached.
   */
  public evaluateAndSlash(serviceId: string): SLAViolationPenalty | null {
    const spec = this.slaConfigs.get(serviceId);
    if (!spec) return null;

    const metrics = this.evaluateSLAMetrics(serviceId);
    if (metrics.isCompliant || metrics.totalPings < 10) {
      return null;
    }

    let reason: SLAViolationPenalty['violationReason'] = 'UPTIME_BREACH';
    if (metrics.uptimePercent < spec.minUptimePercent) {
      reason = 'UPTIME_BREACH';
    } else if (metrics.p95LatencyMs > spec.maxP95LatencyMs) {
      reason = 'LATENCY_EXCEEDED';
    } else {
      reason = 'ERROR_RATE_HIGH';
    }

    const slashAmount = Math.min(spec.penaltyPerBreachKite, spec.stakedCollateralKite);
    spec.stakedCollateralKite -= slashAmount;
    this.slaConfigs.set(serviceId, spec);

    const penalty: SLAViolationPenalty = {
      penaltyId: `sla-pen-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      serviceId,
      provider: spec.provider,
      violationReason: reason,
      slashedAmountKite: slashAmount,
      remainingCollateralKite: spec.stakedCollateralKite,
      timestamp: Date.now(),
      refundPoolAllocatedKite: slashAmount * 0.8, // 80% to caller refund pool, 20% protocol burn
    };

    this.penalties.push(penalty);
    return penalty;
  }

  /**
   * Issues a compensation refund voucher for callers who suffered from a degraded SLA invocation.
   */
  public issueCallerRefund(
    recipientCaller: string,
    serviceId: string,
    penaltyId: string,
    rebateAmountKite: number
  ): SLARefundVoucher {
    const voucher: SLARefundVoucher = {
      voucherId: `sla-vouch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      recipientCaller,
      serviceId,
      breachPenaltyId: penaltyId,
      rebateAmountKite,
      issuedAt: Date.now(),
      isRedeemed: false,
    };
    this.refundVouchers.set(voucher.voucherId, voucher);
    return voucher;
  }

  /**
   * Redeems an issued SLA compensation voucher.
   */
  public redeemVoucher(voucherId: string): boolean {
    const voucher = this.refundVouchers.get(voucherId);
    if (!voucher || voucher.isRedeemed) return false;
    voucher.isRedeemed = true;
    this.refundVouchers.set(voucherId, voucher);
    return true;
  }

  public getPenalties(): SLAViolationPenalty[] {
    return [...this.penalties];
  }

  public getVouchersForCaller(caller: string): SLARefundVoucher[] {
    return Array.from(this.refundVouchers.values()).filter((v) => v.recipientCaller === caller);
  }
}

export const globalSLAOracle = new AgentSLAOracle();
