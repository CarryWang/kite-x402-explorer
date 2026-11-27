import test from 'node:test';
import assert from 'node:assert/strict';
import { MerchantFeeTierEngine, type FeeTier } from '../src/lib/merchant-fee-tier-engine.js';

function tiers(): FeeTier[] {
  return [{ id: 'base', name: 'Base', minVolumeUsd: 0, baseFeeBps: 100, rebatePercent: 0, maxFeeCapUsd: 1000 },
    { id: 'high', name: 'High', minVolumeUsd: 100, baseFeeBps: 50, rebatePercent: 0, maxFeeCapUsd: 1000 }];
}

test('changing caller tier objects cannot alter an already validated fee policy', () => {
  const supplied = tiers();
  const engine = new MerchantFeeTierEngine(supplied);
  supplied[1].minVolumeUsd = 100_000;
  supplied[0].baseFeeBps = NaN;
  assert.equal(engine.calculateFee(100, 1000).feeAmountUsd, 5);
  assert.equal(engine.calculateFee(0, 1000).feeAmountUsd, 10);
});

test('lookup and calculation results do not expose installed fee tiers', () => {
  const engine = new MerchantFeeTierEngine(tiers());
  engine.getTierForVolume(0).baseFeeBps = 9999;
  engine.getNextTier(0)!.rebatePercent = 100;
  const result = engine.calculateFee(100, 1000);
  assert.equal(result.feeAmountUsd, 5);
  assert.equal(result.rebateAmountUsd, 0);
  result.tier.baseFeeBps = 0;
  assert.equal(engine.calculateFee(100, 1000).feeAmountUsd, 5);
  assert.equal(engine.calculateFee(0, 1000).feeAmountUsd, 10);
});

test('the documented fee cap and tier order still apply', () => {
  const engine = new MerchantFeeTierEngine(tiers().reverse());
  assert.equal(engine.calculateFee(0, 100_000_000).feeAmountUsd, 1000);
  assert.equal(engine.getNextTier(100), null);
});
