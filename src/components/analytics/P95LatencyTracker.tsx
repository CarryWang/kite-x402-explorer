import React, { useMemo, useState, useEffect } from 'react';

export interface BlockLatencyMetric {
  blockNumber: number;
  propagationTimeMs: number;
  gasUsedPercent: number;
  timestamp: number;
}

export interface P95LatencyTrackerProps {
  initialWindowSize?: number;
  pollIntervalMs?: number;
}

export const P95LatencyTracker: React.FC<P95LatencyTrackerProps> = ({
  initialWindowSize = 30,
  pollIntervalMs = 6000,
}) => {
  const [metrics, setMetrics] = useState<BlockLatencyMetric[]>([]);

  useEffect(() => {
    // Generate synthetic rolling window metrics for real-time telemetry
    const now = Math.floor(Date.now() / 1000);
    const mockData: BlockLatencyMetric[] = Array.from({ length: initialWindowSize }).map((_, i) => ({
      blockNumber: 1350200 + i,
      propagationTimeMs: Math.round(180 + Math.sin(i / 4) * 45 + Math.random() * 30),
      gasUsedPercent: Math.round(40 + Math.random() * 35),
      timestamp: now - (initialWindowSize - i) * 6,
    }));
    setMetrics(mockData);

    const interval = setInterval(() => {
      setMetrics((prev) => {
        const lastBlock = prev.length > 0 ? prev[prev.length - 1].blockNumber : 1350200;
        const newMetric: BlockLatencyMetric = {
          blockNumber: lastBlock + 1,
          propagationTimeMs: Math.round(180 + Math.random() * 60),
          gasUsedPercent: Math.round(45 + Math.random() * 30),
          timestamp: Math.floor(Date.now() / 1000),
        };
        return [...prev.slice(1), newMetric];
      });
    }, pollIntervalMs);

    return () => clearInterval(interval);
  }, [initialWindowSize, pollIntervalMs]);

  const stats = useMemo(() => {
    if (metrics.length === 0) return { p50: 0, p95: 0, avg: 0 };
    const sorted = [...metrics].map((m) => m.propagationTimeMs).sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const avg = Math.round(sorted.reduce((acc, v) => acc + v, 0) / sorted.length);
    return { p50, p95, avg };
  }, [metrics]);

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-5 shadow-lg backdrop-blur-md">
      <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
        <div>
          <h4 className="text-sm font-semibold tracking-wide text-neutral-100">P95 Block Propagation Latency</h4>
          <p className="text-xs text-neutral-400">Adaptive rolling window monitoring ({initialWindowSize} blocks)</p>
        </div>
        <div className="flex items-center space-x-2">
          <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-xs font-mono text-cyan-300">Live Telemetry</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4 pt-4">
        <div className="rounded-lg bg-neutral-800/40 p-3">
          <span className="text-xs text-neutral-400">P50 Median</span>
          <p className="text-lg font-mono font-bold text-neutral-200">{stats.p50} ms</p>
        </div>
        <div className="rounded-lg bg-neutral-800/40 p-3">
          <span className="text-xs text-neutral-400">Mean Average</span>
          <p className="text-lg font-mono font-bold text-neutral-200">{stats.avg} ms</p>
        </div>
        <div className="rounded-lg bg-neutral-800/40 p-3">
          <span className="text-xs text-neutral-400">P95 Quantile</span>
          <p className="text-lg font-mono font-bold text-cyan-400">{stats.p95} ms</p>
        </div>
      </div>
    </div>
  );
};

export default P95LatencyTracker;
