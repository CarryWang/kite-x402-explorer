import { describe, it, expect } from 'vitest';
import { AgentGasStationOracle } from '../src/lib/agent-gas-station-oracle';

describe('AgentGasStationOracle', () => {
  it('provides multi-tier speed recommendations for Kite Mainnet', () => {
    const oracle = new AgentGasStationOracle();
    const recs = oracle.getRecommendations('kite-mainnet');

    expect(recs.length).toBe(4);
    expect(recs[0].speed).toBe('SLOW');
    expect(recs[1].speed).toBe('STANDARD');
    expect(recs[2].speed).toBe('FAST');
    expect(recs[3].speed).toBe('INSTANT');
    expect(recs[3].maxFeePerGasGwei).toBeGreaterThan(recs[1].maxFeePerGasGwei);
  });

  it('estimates settlement cost accurately', () => {
    const oracle = new AgentGasStationOracle();
    const estimate = oracle.estimateSettlementCost('kite-mainnet', 65_000n, 'STANDARD', 2.0);

    expect(estimate.network).toBe('kite-mainnet');
    expect(estimate.gasLimit).toBe(65_000n);
    expect(Number(estimate.estimatedCostEth)).toBeGreaterThan(0);
    expect(estimate.estimatedCostUsd).toMatch(/^\$[0-9\.]+$/);
  });

  it('updates base fee dynamically and reflects in recommendations', () => {
    const oracle = new AgentGasStationOracle();
    oracle.updateBaseFee('kite-mainnet', 50);

    const recs = oracle.getRecommendations('kite-mainnet');
    expect(recs[0].baseFeeGwei).toBe(50);
    expect(recs[0].maxFeePerGasGwei).toBe(51);
  });
});
