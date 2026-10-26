import { describe, it, expect } from 'vitest';
import { AgentReputationScorer } from '../src/lib/agent-reputation-scorer';

describe('AgentReputationScorer', () => {
  it('calculates trusted tier for high success and low latency agents', () => {
    const report = AgentReputationScorer.calculateReputation({
      agentAddress: '0xAgent001',
      totalExecutions: 100,
      successfulSettlements: 98,
      failedSettlements: 2,
      disputeCount: 0,
      averageLatencyMs: 150,
    });

    expect(report.tier).toBe('TRUSTED');
    expect(report.score).toBeGreaterThanOrEqual(85);
    expect(report.penaltyMultiplier).toBe(0.8);
  });

  it('downgrades to probationary for frequent disputes', () => {
    const report = AgentReputationScorer.calculateReputation({
      agentAddress: '0xAgent002',
      totalExecutions: 50,
      successfulSettlements: 35,
      failedSettlements: 15,
      disputeCount: 8,
      averageLatencyMs: 800,
    });

    expect(report.tier).toBe('PROBATIONARY');
    expect(report.penaltyMultiplier).toBe(1.5);
  });
});
