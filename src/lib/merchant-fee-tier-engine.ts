/**
 * Merchant Volume Fee Tier Engine
 * Calculates dynamic fee rates and tier discounts based on 30-day cumulative settlement volume.
 */

export interface FeeTier {
  id: string;
  name: string;
  minVolumeUsd: number;
  baseFeeBps: number;
  rebatePercent: number;
  maxFeeCapUsd: number;
}

export const DEFAULT_FEE_TIERS: FeeTier[] = [
  { id: 'tier-standard', name: 'Standard', minVolumeUsd: 0, baseFeeBps: 50, rebatePercent: 0, maxFeeCapUsd: 25 },
  { id: 'tier-silver', name: 'Silver', minVolumeUsd: 10_000, baseFeeBps: 40, rebatePercent: 5, maxFeeCapUsd: 20 },
  { id: 'tier-gold', name: 'Gold', minVolumeUsd: 50_000, baseFeeBps: 30, rebatePercent: 10, maxFeeCapUsd: 15 },
  { id: 'tier-platinum', name: 'Platinum', minVolumeUsd: 250_000, baseFeeBps: 20, rebatePercent: 15, maxFeeCapUsd: 10 },
  { id: 'tier-diamond', name: 'Diamond', minVolumeUsd: 1_000_000, baseFeeBps: 10, rebatePercent: 20, maxFeeCapUsd: 5 },
];

export interface FeeCalculationResult {
  tier: FeeTier;
  grossAmountUsd: number;
  feeAmountUsd: number;
  rebateAmountUsd: number;
  netSettlementUsd: number;
  effectiveRateBps: number;
  nextTier: FeeTier | null;
  volumeToNextTierUsd: number;
}

export class MerchantFeeTierEngine {
  private tiers: FeeTier[];

  constructor(customTiers?: FeeTier[]) {
    this.tiers = [...(customTiers || DEFAULT_FEE_TIERS)].sort((a, b) => a.minVolumeUsd - b.minVolumeUsd);
  }

  public getTierForVolume(volumeUsd: number): FeeTier {
    let currentTier = this.tiers[0];
    for (const tier of this.tiers) {
      if (volumeUsd >= tier.minVolumeUsd) {
        currentTier = tier;
      } else {
        break;
      }
    }
    return currentTier;
  }

  public getNextTier(volumeUsd: number): FeeTier | null {
    for (const tier of this.tiers) {
      if (tier.minVolumeUsd > volumeUsd) {
        return tier;
      }
    }
    return null;
  }

  public calculateFee(volumeUsd: number, transactionAmountUsd: number): FeeCalculationResult {
    const tier = this.getTierForVolume(volumeUsd);
    const nextTier = this.getNextTier(volumeUsd);
    const volumeToNextTierUsd = nextTier ? Math.max(0, nextTier.minVolumeUsd - volumeUsd) : 0;

    let rawFee = (transactionAmountUsd * tier.baseFeeBps) / 10000;
    const feeAmountUsd = Math.min(rawFee, tier.maxFeeCapUsd);
    const rebateAmountUsd = (feeAmountUsd * tier.rebatePercent) / 100;
    const effectiveFee = feeAmountUsd - rebateAmountUsd;
    const netSettlementUsd = transactionAmountUsd - effectiveFee;
    const effectiveRateBps = transactionAmountUsd > 0 ? (effectiveFee / transactionAmountUsd) * 10000 : 0;

    return {
      tier,
      grossAmountUsd: transactionAmountUsd,
      feeAmountUsd,
      rebateAmountUsd,
      netSettlementUsd,
      effectiveRateBps,
      nextTier,
      volumeToNextTierUsd,
    };
  }
}
