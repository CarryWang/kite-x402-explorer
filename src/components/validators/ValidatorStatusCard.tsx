import React from 'react';

export interface ValidatorInfo {
  address: string;
  uptimePercent: number;
  blocksProposed: number;
  isActive: boolean;
}

export const ValidatorStatusCard: React.FC<{ validator: ValidatorInfo }> = ({ validator }) => {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 text-xs">
      <div className="flex items-center justify-between pb-2">
        <span className="font-mono text-neutral-300 truncate max-w-[160px]">{validator.address}</span>
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${validator.isActive ? 'bg-emerald-950 text-emerald-400' : 'bg-neutral-800 text-neutral-400'}`}>
          {validator.isActive ? 'Active' : 'Inactive'}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-neutral-400">
        <div>Uptime: <span className="font-bold text-neutral-200">{validator.uptimePercent}%</span></div>
        <div>Proposed: <span className="font-bold text-neutral-200">{validator.blocksProposed}</span></div>
      </div>
    </div>
  );
};

export default ValidatorStatusCard;
