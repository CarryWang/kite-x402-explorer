import React from 'react';

export interface ValidatorInfo {
  address: string;
  source: string;
  observedAt: string;
  uptimePercent?: number;
  blocksProposed?: number;
  isActive?: boolean;
}

export const ValidatorStatusCard: React.FC<{ validator?: ValidatorInfo | null }> = ({ validator }) => {
  if (!validator?.address || !validator.source?.trim() || !validator.observedAt || Number.isNaN(Date.parse(validator.observedAt))) {
    return <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 text-xs">Validator data unavailable.</div>;
  }
  const uptime = typeof validator.uptimePercent === 'number' && Number.isFinite(validator.uptimePercent)
    && validator.uptimePercent >= 0 && validator.uptimePercent <= 100 ? `${validator.uptimePercent}%` : 'Unknown';
  const proposed = typeof validator.blocksProposed === 'number' && Number.isSafeInteger(validator.blocksProposed)
    && validator.blocksProposed >= 0 ? validator.blocksProposed : 'Unknown';
  const status = typeof validator.isActive === 'boolean' ? (validator.isActive ? 'Active' : 'Inactive') : 'Unknown';
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 text-xs">
      <div className="flex items-center justify-between pb-2">
        <span className="font-mono text-neutral-300 truncate max-w-[160px]">{validator.address}</span>
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${validator.isActive === true ? 'bg-emerald-950 text-emerald-400' : 'bg-neutral-800 text-neutral-400'}`}>
          {status}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-neutral-400">
        <div>Uptime: <span className="font-bold text-neutral-200">{uptime}</span></div>
        <div>Proposed: <span className="font-bold text-neutral-200">{proposed}</span></div>
      </div>
      <p className="text-neutral-500">Observed {validator.observedAt} via {validator.source}</p>
    </div>
  );
};

export default ValidatorStatusCard;
