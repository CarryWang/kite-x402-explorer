import React from 'react';

export const BlockTimeHistogram: React.FC<{ intervals?: readonly number[] | null }> = ({ intervals }) => {
  if (!intervals?.length) {
    return <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 text-xs">Block time data unavailable.</div>;
  }
  if (intervals.some((value) => !Number.isFinite(value) || value < 0)) {
    return <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 text-xs">Invalid block time data.</div>;
  }

  let min = Infinity;
  let max = -Infinity;
  let total = 0;
  for (const interval of intervals) {
    min = Math.min(min, interval);
    max = Math.max(max, interval);
    total += interval;
  }
  const binCount = min === max ? 1 : Math.min(5, Math.ceil(Math.sqrt(intervals.length)));
  const counts = Array<number>(binCount).fill(0);
  for (const interval of intervals) {
    const index = min === max ? 0 : Math.min(binCount - 1, Math.floor((interval - min) / (max - min) * binCount));
    counts[index] += 1;
  }
  const maxCount = Math.max(...counts);

  return (
    <figure className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 text-xs">
      <figcaption className="font-semibold text-neutral-300 mb-1">Block time distribution</figcaption>
      <p className="font-mono text-cyan-400 font-bold text-base">{(total / intervals.length).toFixed(2)} s avg</p>
      <p className="text-[10px] text-neutral-500 mt-1">Calculated from {intervals.length} supplied block intervals</p>
      <ul role="list" aria-label="Block time interval distribution">
        {counts.map((count, index) => {
          const start = min + (max - min) * index / binCount;
          const end = min + (max - min) * (index + 1) / binCount;
          return (
            <li role="listitem" key={index} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.25rem' }}>
              <span style={{ minWidth: '7rem' }}>{start.toFixed(2)}–{end.toFixed(2)} s</span>
              <span style={{ display: 'inline-block', width: `${count / maxCount * 100}%`, minHeight: '0.5rem', background: 'var(--accent-cyan)' }} aria-hidden="true" />
              <span>{count} {count === 1 ? 'interval' : 'intervals'}</span>
            </li>
          );
        })}
      </ul>
    </figure>
  );
};

export default BlockTimeHistogram;
