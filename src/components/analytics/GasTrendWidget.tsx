import type { FC } from 'react';

export interface GasDataPoint {
  blockNumber: number;
  baseFeeGwei: number;
  priorityFeeGwei: number;
  latencyMs: number;
  timestamp: number;
}

interface GasTrendWidgetProps {
  /** Observations supplied by the caller, ordered from oldest to newest. */
  dataPoints: GasDataPoint[];
}

export const GasTrendWidget: FC<GasTrendWidgetProps> = ({ dataPoints }) => {
  const points = dataPoints.filter((point) =>
    Number.isFinite(point.baseFeeGwei) && point.baseFeeGwei >= 0 &&
    Number.isFinite(point.latencyMs) && point.latencyMs >= 0
  ).slice(-24);
  const latest = points.at(-1);
  const averageBaseFee = points.length
    ? points.reduce((total, point) => total + point.baseFeeGwei, 0) / points.length
    : 0;
  const latencies = points.map((point) => point.latencyMs).sort((a, b) => a - b);
  const p95Latency = latencies[Math.ceil(latencies.length * 0.95) - 1];

  return (
    <section className="glass-card" style={{ padding: '1.25rem' }} aria-label="Observed gas and latency metrics">
      <h3 style={{ fontSize: '0.95rem', marginBottom: '0.25rem' }}>Gas &amp; Latency Metrics</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '0.75rem' }}>
        {points.length} supplied block observation{points.length === 1 ? '' : 's'}
      </p>
      {!latest ? (
        <p role="status">No gas measurements available.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.75rem' }}>
          <div><small>Latest base fee</small><p>{latest.baseFeeGwei.toFixed(4)} Gwei</p></div>
          <div><small>Average base fee</small><p>{averageBaseFee.toFixed(4)} Gwei</p></div>
          <div><small>P95 observed latency</small><p>{p95Latency} ms</p></div>
        </div>
      )}
    </section>
  );
};

export default GasTrendWidget;
