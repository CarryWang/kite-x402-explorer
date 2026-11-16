import React from 'react';

export interface BlockLatencyMetric {
  blockNumber: number;
  propagationTimeMs: number;
  gasUsedPercent: number;
  timestamp: number;
}

export interface P95LatencyTrackerProps {
  metrics?: BlockLatencyMetric[];
  initialWindowSize?: number;
}

export const P95LatencyTracker: React.FC<P95LatencyTrackerProps> = ({
  metrics = [], initialWindowSize = 30,
}) => {
  const windowSize = Number.isInteger(initialWindowSize) && initialWindowSize > 0 ? initialWindowSize : 30;
  const observed = metrics.slice(-windowSize).map((m) => m.propagationTimeMs)
    .filter((ms) => Number.isFinite(ms) && ms >= 0).sort((a, b) => a - b);
  const count = observed.length;
  const p50 = count ? (observed[Math.floor((count - 1) / 2)] + observed[Math.floor(count / 2)]) / 2 : null;
  const p95 = count ? observed[Math.ceil(count * 0.95) - 1] : null;
  const avg = count ? observed.reduce((sum, ms) => sum + ms, 0) / count : null;

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-5">
      <h4>P95 Block Propagation Latency</h4>
      <p>Observed rolling window ({count} blocks)</p>
      {count === 0 ? <p>No observations</p> : (
        <div className="grid grid-cols-3 gap-4 pt-4">
          <p>P50 Median: {p50} ms</p>
          <p>Mean Average: {avg} ms</p>
          <p>P95 Quantile: {p95} ms</p>
        </div>
      )}
    </div>
  );
};

export default P95LatencyTracker;
