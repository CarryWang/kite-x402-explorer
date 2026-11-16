import React, { useState } from 'react';
import { computeFeeRecommendations, FeeTierRecommendation } from '../../utils/fee-estimator';

interface PriorityFeeAdvisorProps {
  currentBaseFeeGwei?: number;
  onSelectTier?: (tier: FeeTierRecommendation) => void;
}

export const PriorityFeeAdvisor: React.FC<PriorityFeeAdvisorProps> = ({
  currentBaseFeeGwei = 0.05,
  onSelectTier,
}) => {
  const [selectedTier, setSelectedTier] = useState<string>('Standard');
  const tiers = computeFeeRecommendations(currentBaseFeeGwei);

  const handleSelect = (tier: FeeTierRecommendation) => {
    setSelectedTier(tier.tier);
    onSelectTier?.(tier);
  };

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-3">Recommended Gas Tiers</h4>
      <div className="grid grid-cols-3 gap-3">
        {tiers.map((t) => {
          const isSelected = selectedTier === t.tier;
          return (
            <button
              key={t.tier}
              onClick={() => handleSelect(t)}
              className={`rounded-lg p-3 text-left transition border ${
                isSelected
                  ? 'border-cyan-500 bg-cyan-950/20 text-neutral-100'
                  : 'border-neutral-800 bg-neutral-800/30 text-neutral-300 hover:border-neutral-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs">{t.tier}</span>
                <span className="text-[10px] text-neutral-500">~{t.estimatedWaitSeconds}s</span>
              </div>
              <p className="mt-2 font-mono text-sm font-bold text-cyan-400">{t.maxFeePerGasGwei} Gwei</p>
              <p className="text-[10px] text-neutral-400">Priority: {t.maxPriorityFeePerGasGwei} Gwei</p>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default PriorityFeeAdvisor;
