/**
 * Autonomous Agent Reputation and Reliability Scorer
 * Evaluates execution reliability, latency percentiles, and dispute penalty rates for AI agents.
 */

export interface AgentMetricSnapshot {
  agentAddress: string;
  totalExecutions: number;
  successfulSettlements: number;
  failedSettlements: number;
  disputeCount: number;
  averageLatencyMs: number;
}

export interface AgentReputationReport {
  agentAddress: string;
  score: number; // 0 to 100
  tier: 'TRUSTED' | 'STANDARD' | 'PROBATIONARY' | 'UNTRUSTED';
  successRate: number;
  disputeRate: number;
  penaltyMultiplier: number;
}

export class AgentReputationScorer {
  public static calculateReputation(metrics: AgentMetricSnapshot): AgentReputationReport {
    const { totalExecutions, successfulSettlements, failedSettlements, disputeCount, averageLatencyMs } = metrics;

    if (![totalExecutions, successfulSettlements, failedSettlements, disputeCount].every(
      (value) => Number.isSafeInteger(value) && value >= 0
    ) || !Number.isFinite(averageLatencyMs) || averageLatencyMs < 0 ||
      successfulSettlements + failedSettlements > totalExecutions || disputeCount > totalExecutions) {
      throw new Error('Invalid agent metrics');
    }

    if (totalExecutions === 0) {
      return {
        agentAddress: metrics.agentAddress,
        score: 50,
        tier: 'STANDARD',
        successRate: 0,
        disputeRate: 0,
        penaltyMultiplier: 1.0,
      };
    }

    const successRate = (successfulSettlements / totalExecutions) * 100;
    const disputeRate = (disputeCount / totalExecutions) * 100;

    let score = successRate * 0.6; // Max 60 pts from success rate

    // Latency factor (max 25 pts)
    if (averageLatencyMs <= 200) {
      score += 25;
    } else if (averageLatencyMs <= 1000) {
      score += 25 - ((averageLatencyMs - 200) / 800) * 15;
    } else {
      score += Math.max(0, 10 - ((averageLatencyMs - 1000) / 2000) * 10);
    }

    // Dispute penalty (max 15 pts deduction)
    const disputeDeduction = Math.min(15, disputeRate * 3);
    score = Math.max(0, Math.min(100, Math.round(score + 15 - disputeDeduction)));
    if (totalExecutions < 20) score = Math.min(score, 84);

    let tier: AgentReputationReport['tier'] = 'STANDARD';
    let penaltyMultiplier = 1.0;

    if (score >= 85) {
      tier = 'TRUSTED';
      penaltyMultiplier = 0.8;
    } else if (score >= 60) {
      tier = 'STANDARD';
      penaltyMultiplier = 1.0;
    } else if (score >= 40) {
      tier = 'PROBATIONARY';
      penaltyMultiplier = 1.5;
    } else {
      tier = 'UNTRUSTED';
      penaltyMultiplier = 2.0;
    }

    return {
      agentAddress: metrics.agentAddress,
      score,
      tier,
      successRate: Math.round(successRate * 10) / 10,
      disputeRate: Math.round(disputeRate * 10) / 10,
      penaltyMultiplier,
    };
  }
}
