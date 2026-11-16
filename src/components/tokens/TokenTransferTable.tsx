import React from 'react';

export interface TokenTransferEvent {
  tokenAddress: string;
  tokenSymbol: string;
  from: string;
  to: string;
  amountFormatted: string;
}

interface TokenTransferTableProps {
  transfers: TokenTransferEvent[];
}

export const TokenTransferTable: React.FC<TokenTransferTableProps> = ({ transfers }) => {
  if (!transfers || transfers.length === 0) {
    return <div className="text-xs text-neutral-500 italic p-3">No ERC-20 token transfer events in this transaction.</div>;
  }

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-3">Token Transfers</h4>
      <div className="space-y-2">
        {transfers.map((t, idx) => (
          <div key={idx} className="flex items-center justify-between rounded-lg bg-neutral-800/30 p-3 text-xs">
            <div className="flex items-center gap-2 font-mono">
              <span className="font-semibold text-neutral-100">{t.amountFormatted}</span>
              <span className="rounded bg-cyan-950/40 px-1.5 py-0.5 text-[10px] text-cyan-300 font-bold">{t.tokenSymbol}</span>
            </div>
            <div className="flex items-center gap-2 font-mono text-[11px] text-neutral-400">
              <span className="truncate max-w-[100px]">{t.from}</span>
              <span className="text-neutral-600">&rarr;</span>
              <span className="truncate max-w-[100px] text-neutral-200">{t.to}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TokenTransferTable;
