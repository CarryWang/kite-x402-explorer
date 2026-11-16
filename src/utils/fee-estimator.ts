export interface FeeMarketObservation {
  baseFeeGwei: number;
  /** Recent observed priority fees, all from the same network as baseFeeGwei. */
  priorityFeeSamplesGwei: number[];
}

export interface FeeTierRecommendation {
  tier: 'Low' | 'Standard' | 'Fast';
  maxPriorityFeePerGasGwei: number;
  maxFeePerGasGwei: number;
}

/** Illustrative EIP-1559 caps from supplied observations; no inclusion time is predicted. */
export function computeFeeRecommendations(observation: FeeMarketObservation | null): FeeTierRecommendation[] {
  if (!observation || !Number.isFinite(observation.baseFeeGwei) || observation.baseFeeGwei < 0) return [];
  const samples = observation.priorityFeeSamplesGwei
    .filter((fee) => Number.isFinite(fee) && fee >= 0)
    .sort((a, b) => a - b);
  if (samples.length === 0) return [];

  const percentile = (fraction: number) => samples[Math.floor((samples.length - 1) * fraction)];
  return ([['Low', 0.25], ['Standard', 0.5], ['Fast', 0.75]] as const).map(([tier, fraction]) => {
    const priority = percentile(fraction);
    return {
      tier,
      maxPriorityFeePerGasGwei: priority,
      maxFeePerGasGwei: Number((2 * observation.baseFeeGwei + priority).toFixed(4)),
    };
  });
}
