import React from 'react';

interface DecodedParam {
  name: string;
  type: string;
  value: string;
}

interface ContractAbiDecoderProps {
  methodSignature?: string;
  params?: DecodedParam[];
}

export const ContractAbiDecoder: React.FC<ContractAbiDecoderProps> = ({
  methodSignature = 'transfer(address to, uint256 amount)',
  params = [],
}) => {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 text-xs">
      <h4 className="font-semibold text-neutral-300 mb-2 font-mono text-[11px] text-cyan-400">{methodSignature}</h4>
      {params.length === 0 ? (
        <p className="text-neutral-500 italic">No structured calldata arguments provided.</p>
      ) : (
        <div className="space-y-1.5 font-mono">
          {params.map((p, i) => (
            <div key={i} className="flex justify-between bg-neutral-800/30 p-2 rounded">
              <span className="text-neutral-400">{p.name} ({p.type}):</span>
              <span className="text-neutral-200 truncate max-w-[200px]">{p.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ContractAbiDecoder;
