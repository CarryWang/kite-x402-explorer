import React, { useState } from 'react';

export interface TxExportItem {
  txHash: string;
  sender: string;
  recipient: string;
  amountGwei: number;
  blockNumber: number;
  timestamp: string;
}

export interface TxReceiptExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: TxExportItem[];
}

export const TxReceiptExportModal: React.FC<TxReceiptExportModalProps> = ({
  isOpen,
  onClose,
  items,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleExportJson = () => {
    const jsonStr = JSON.stringify(items, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kite-settlement-receipts-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = () => {
    const headers = 'txHash,sender,recipient,amountGwei,blockNumber,timestamp\n';
    const rows = items
      .map(
        (it) =>
          `${it.txHash},${it.sender},${it.recipient},${it.amountGwei},${it.blockNumber},${it.timestamp}`
      )
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kite-settlement-receipts-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl">
        <h3 className="text-base font-semibold text-neutral-100">Export Settlement Receipts</h3>
        <p className="mt-1 text-xs text-neutral-400">Selected {items.length} records ready for download.</p>
        <div className="mt-6 flex flex-col space-y-3">
          <button
            onClick={handleExportJson}
            className="w-full rounded-lg bg-neutral-800 px-4 py-2.5 text-xs font-medium text-neutral-200 hover:bg-neutral-700 transition"
          >
            Download JSON Format (.json)
          </button>
          <button
            onClick={handleExportCsv}
            className="w-full rounded-lg bg-cyan-600 px-4 py-2.5 text-xs font-medium text-white hover:bg-cyan-500 transition"
          >
            Download CSV Spreadsheet (.csv)
          </button>
        </div>
        <div className="mt-4 flex justify-end">
          <button onClick={onClose} className="text-xs text-neutral-400 hover:text-neutral-200">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default TxReceiptExportModal;
