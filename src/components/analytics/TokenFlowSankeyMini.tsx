import React from 'react';

export interface FlowNode {
  label: string;
  volumePercent: number;
}

export const TokenFlowSankeyMini: React.FC<{ flows?: FlowNode[] }> = ({
  flows = [
    { label: 'Settlement Escrow', volumePercent: 55 },
    { label: 'Agent Fee Split', volumePercent: 30 },
    { label: 'Treasury Burn', volumePercent: 15 },
  ],
}) => {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
      <h5 className="text-xs font-semibold text-neutral-300">Token Volume Distribution</h5>
      <div className="mt-3 space-y-2">
        {flows.map((flow) => (
          <div key={flow.label}>
            <div className="flex justify-between text-xs text-neutral-400">
              <span>{flow.label}</span>
              <span className="font-mono text-cyan-400">{flow.volumePercent}%</span>
            </div>
            <div className="mt-1 h-1.5 w-full rounded-full bg-neutral-800 overflow-hidden">
              <div
                className="h-full bg-cyan-500 rounded-full"
                style={{ width: `${flow.volumePercent}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TokenFlowSankeyMini;
