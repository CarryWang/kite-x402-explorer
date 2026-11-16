import React from 'react';

export interface GasSpikeAlertBadgeProps {
  currentGasGwei: number;
  baselineGasGwei: number;
  anomalyThresholdPercent?: number;
}

export const GasSpikeAlertBadge: React.FC<GasSpikeAlertBadgeProps> = ({
  currentGasGwei,
  baselineGasGwei,
  anomalyThresholdPercent = 25,
}) => {
  if (baselineGasGwei <= 0) return null;

  const diffPercent = Math.round(((currentGasGwei - baselineGasGwei) / baselineGasGwei) * 100);
  const isSpike = diffPercent >= anomalyThresholdPercent;

  if (!isSpike) {
    return (
      <div className="inline-flex items-center space-x-1.5 rounded-full bg-emerald-950/60 border border-emerald-800/50 px-2.5 py-1 text-xs text-emerald-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        <span>Gas Normal ({currentGasGwei.toFixed(4)} Gwei)</span>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center space-x-1.5 rounded-full bg-amber-950/70 border border-amber-700/60 px-3 py-1 text-xs text-amber-300 animate-pulse">
      <span className="h-2 w-2 rounded-full bg-amber-400" />
      <span className="font-semibold">Gas Surge +{diffPercent}%</span>
      <span className="text-amber-400/80">({currentGasGwei.toFixed(4)} vs avg {baselineGasGwei.toFixed(4)} Gwei)</span>
    </div>
  );
};

export default GasSpikeAlertBadge;
