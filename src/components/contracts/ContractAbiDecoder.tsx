import React from 'react';
import { decodeFunctionData, type Abi, type Hex } from 'viem';

interface ContractAbiDecoderProps {
  abi?: Abi | null;
  data?: Hex | null;
}

export const ContractAbiDecoder: React.FC<ContractAbiDecoderProps> = ({ abi, data }) => {
  if (!abi?.length || !data) {
    return <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 text-xs">Decoded calldata unavailable; supply an ABI and calldata.</div>;
  }

  let decoded: { functionName: string; args?: readonly unknown[] };
  try {
    decoded = decodeFunctionData({ abi, data });
  } catch {
    return <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 text-xs">Unable to decode calldata with supplied ABI.</div>;
  }

  const args = decoded.args ?? [];
  const formatValue = (value: unknown): string =>
    typeof value === 'bigint' ? value.toString() :
    typeof value === 'string' ? value :
    JSON.stringify(value, (_, item: unknown) => typeof item === 'bigint' ? item.toString() : item) ?? String(value);

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 text-xs">
      <h4 className="font-semibold text-neutral-300 mb-2 font-mono text-[11px] text-cyan-400">Decoded call: {decoded.functionName}</h4>
      {args.length === 0 ? (
        <p className="text-neutral-500 italic">This call has no arguments.</p>
      ) : (
        <div className="space-y-1.5 font-mono">
          {args.map((value, i) => (
            <div key={i} className="flex justify-between bg-neutral-800/30 p-2 rounded">
              <span className="text-neutral-400">Argument {i + 1}:</span>
              <span className="text-neutral-200 truncate max-w-[200px]">{formatValue(value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ContractAbiDecoder;
