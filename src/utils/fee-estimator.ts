export interface FeeTierRecommendation {
  tier: 'Low' | 'Standard' | 'Fast';
  maxPriorityFeePerGasGwei: number;
  maxFeePerGasGwei: number;
  estimatedWaitSeconds: number;
}

export function computeFeeRecommendations(baseFeeGwei: number): FeeTierRecommendation[] {
  const safeBase = Math.max(0.001, baseFeeGwei);
  return [
    {
      tier: 'Low',
      maxPriorityFeePerGasGwei: 0.005,
      maxFeePerGasGwei: Number((safeBase * 1.1 + 0.005).toFixed(4)),
      estimatedWaitSeconds: 30,
    },
    {
      tier: 'Standard',
      maxPriorityFeePerGasGwei: 0.015,
      maxFeePerGasGwei: Number((safeBase * 1.25 + 0.015).toFixed(4)),
      estimatedWaitSeconds: 12,
    },
    {
      tier: 'Fast',
      maxPriorityFeePerGasGwei: 0.035,
      maxFeePerGasGwei: Number((safeBase * 1.5 + 0.035).toFixed(4)),
      estimatedWaitSeconds: 3,
    },
  ];
}
