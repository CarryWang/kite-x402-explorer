import { describe, it, expect } from 'vitest';
import { MerchantFeeTierEngine, DEFAULT_FEE_TIERS } from '../src/lib/merchant-fee-tier-engine';

describe('MerchantFeeTierEngine', () => {
  const engine = new MerchantFeeTierEngine();

  it('assigns Standard tier for zero or low volume', () => {
    const tier = engine.getTierForVolume(500);
    expect(tier.id).toBe('tier-standard');
    expect(tier.baseFeeBps).toBe(50);
  });

  it('promotes to Gold tier upon meeting volume threshold', () => {
    const tier = engine.getTierForVolume(60_000);
    expect(tier.id).toBe('tier-gold');
    expect(tier.baseFeeBps).toBe(30);
  });

  it('calculates fees with cap and rebate for Platinum tier', () => {
    const res = engine.calculateFee(300_000, 10_000);
    expect(res.tier.id).toBe('tier-platinum');
    expect(res.feeAmountUsd).toBeLessThanOrEqual(res.tier.maxFeeCapUsd);
    expect(res.rebateAmountUsd).toBeGreaterThan(0);
    expect(res.netSettlementUsd).toBeLessThanOrEqual(res.grossAmountUsd);
  });

  it('computes distance to next tier accurately', () => {
    const res = engine.calculateFee(8_000, 500);
    expect(res.nextTier?.id).toBe('tier-silver');
    expect(res.volumeToNextTierUsd).toBe(2000);
  });
});
