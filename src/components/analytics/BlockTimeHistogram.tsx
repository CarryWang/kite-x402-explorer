import React from 'react';

export const BlockTimeHistogram: React.FC<{ intervals?: number[] }> = ({ intervals = [1.2, 1.1, 1.4, 0.9, 1.3] }) => {
  const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 text-xs">
      <h4 className="font-semibold text-neutral-300 mb-1">Block Time Interval</h4>
      <p className="font-mono text-cyan-400 font-bold text-base">{avg.toFixed(2)}s avg</p>
      <p className="text-[10px] text-neutral-500 mt-1">Calculated over {intervals.length} consecutive blocks</p>
    </div>
  );
};

export default BlockTimeHistogram;
