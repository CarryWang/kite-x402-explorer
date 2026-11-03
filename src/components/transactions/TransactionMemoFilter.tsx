import React, { useState, useEffect } from 'react';

export interface FilterState {
  methodId: string;
  memoKeyword: string;
  status: 'ALL' | 'SUCCESS' | 'FAILED';
}

interface TransactionMemoFilterProps {
  onFilterChange: (filters: FilterState) => void;
}

export const TransactionMemoFilter: React.FC<TransactionMemoFilterProps> = ({ onFilterChange }) => {
  const [methodId, setMethodId] = useState('');
  const [memoKeyword, setMemoKeyword] = useState('');
  const [status, setStatus] = useState<'ALL' | 'SUCCESS' | 'FAILED'>('ALL');

  useEffect(() => {
    const handler = setTimeout(() => {
      onFilterChange({ methodId, memoKeyword, status });
    }, 300);
    return () => clearTimeout(handler);
  }, [methodId, memoKeyword, status, onFilterChange]);

  const handleClear = () => {
    setMethodId('');
    setMemoKeyword('');
    setStatus('ALL');
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900/40 p-3 text-xs">
      <div className="flex items-center gap-2">
        <label className="text-neutral-400 font-medium">Method 4B:</label>
        <input
          type="text"
          placeholder="0xa9059cbb"
          value={methodId}
          onChange={(e) => setMethodId(e.target.value.trim())}
          className="w-28 rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-neutral-100 placeholder-neutral-500 focus:border-cyan-500 focus:outline-none font-mono"
        />
      </div>

      <div className="flex items-center gap-2">
        <label className="text-neutral-400 font-medium">Memo / Msg:</label>
        <input
          type="text"
          placeholder="e.g. x402-settle"
          value={memoKeyword}
          onChange={(e) => setMemoKeyword(e.target.value)}
          className="w-40 rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-neutral-100 placeholder-neutral-500 focus:border-cyan-500 focus:outline-none"
        />
      </div>

      <div className="flex items-center gap-2">
        <label className="text-neutral-400 font-medium">Status:</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as any)}
          className="rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-neutral-200 focus:border-cyan-500 focus:outline-none"
        >
          <option value="ALL">All</option>
          <option value="SUCCESS">Success Only</option>
          <option value="FAILED">Failed Only</option>
        </select>
      </div>

      {(methodId || memoKeyword || status !== 'ALL') && (
        <button
          onClick={handleClear}
          className="ml-auto text-neutral-400 hover:text-neutral-200 underline text-xs"
        >
          Reset Filters
        </button>
      )}
    </div>
  );
};

export default TransactionMemoFilter;
