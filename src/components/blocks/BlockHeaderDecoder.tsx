import React, { useState } from 'react';

export interface BlockHeaderData {
  number: number;
  hash: string;
  parentHash: string;
  stateRoot: string;
  receiptsRoot: string;
  extraDataHex: string;
}

interface BlockHeaderDecoderProps {
  header?: BlockHeaderData;
}

export const BlockHeaderDecoder: React.FC<BlockHeaderDecoderProps> = ({ header }) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!header) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 text-xs text-neutral-500 italic">
        No block header selected for decoding.
      </div>
    );
  }

  const handleCopy = (key: string, val: string) => {
    navigator.clipboard.writeText(val);
    setCopiedField(key);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const fields = [
    { label: 'Block Number', value: `#${header.number}` },
    { label: 'Block Hash', value: header.hash },
    { label: 'Parent Hash', value: header.parentHash },
    { label: 'State Root', value: header.stateRoot },
    { label: 'Receipts Root', value: header.receiptsRoot },
    { label: 'Extra Data (Hex)', value: header.extraDataHex },
  ];

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-5 backdrop-blur-md">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-3">Decoded Block Header</h3>
      <div className="space-y-2">
        {fields.map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between rounded-lg bg-neutral-800/40 p-2 text-xs">
            <span className="text-neutral-400 font-medium">{label}</span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-neutral-200 truncate max-w-[240px]">{value}</span>
              <button
                onClick={() => handleCopy(label, value)}
                className="text-[11px] text-cyan-400 hover:text-cyan-300"
              >
                {copiedField === label ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BlockHeaderDecoder;
