import React, { useState } from 'react';

export interface TraceStepItem {
  id: string;
  type: 'CALL' | 'DELEGATECALL' | 'STATICCALL' | 'CREATE';
  from: string;
  to: string;
  gasUsed: number;
  gasLimit: number;
  valueEth?: string;
  success: boolean;
  depth: number;
}

interface ExecutionTimelineProps {
  steps: TraceStepItem[];
}

export const ExecutionTimeline: React.FC<ExecutionTimelineProps> = ({ steps }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!steps || steps.length === 0) {
    return <div className="text-xs text-neutral-500 italic p-3">No internal execution trace available.</div>;
  }

  return (
    <div className="space-y-2 rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-3">Internal Call Trace</h4>
      <div className="relative border-l border-neutral-800 ml-4 space-y-4">
        {steps.map((step) => {
          const gasPercent = Math.min(100, Math.round((step.gasUsed / Math.max(step.gasLimit, 1)) * 100));
          return (
            <div key={step.id} className="relative pl-6">
              <span
                className={`absolute -left-1.5 top-1.5 h-3 w-3 rounded-full border-2 border-neutral-900 ${
                  step.success ? 'bg-emerald-500' : 'bg-red-500'
                }`}
              />
              <div
                className="cursor-pointer rounded-lg border border-neutral-800 bg-neutral-800/40 p-3 hover:border-neutral-700 transition"
                onClick={() => setExpandedId(expandedId === step.id ? null : step.id)}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono font-bold text-cyan-400">{step.type}</span>
                  <span className="font-mono text-neutral-400">{step.gasUsed.toLocaleString()} gas ({gasPercent}%)</span>
                </div>
                <div className="mt-1 flex items-center gap-2 font-mono text-xs text-neutral-300">
                  <span className="truncate max-w-[140px] text-neutral-400">{step.from}</span>
                  <span className="text-neutral-500">&rarr;</span>
                  <span className="truncate max-w-[140px] font-semibold text-neutral-200">{step.to}</span>
                </div>
                {expandedId === step.id && (
                  <div className="mt-3 pt-3 border-t border-neutral-800 text-xs text-neutral-400 space-y-1">
                    <p>Depth Level: {step.depth}</p>
                    <p>Gas Limit: {step.gasLimit.toLocaleString()}</p>
                    {step.valueEth && <p>Value: {step.valueEth} KITE</p>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ExecutionTimeline;
