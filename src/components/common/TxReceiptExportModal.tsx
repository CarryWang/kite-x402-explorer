import React from 'react';
import { buildVerifiableReceipt } from '../../lib/receipt-exporter.js';
import type { PaymentProofRecord } from '../../types/proof.js';

export interface TxReceiptExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: PaymentProofRecord[];
}

export function buildReceiptExportJson(items: PaymentProofRecord[]): string {
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    count: items.length,
    receipts: items.map(buildVerifiableReceipt),
  }, null, 2);
}

const csvHeaders = ['serviceName', 'network', 'tokenSymbol', 'amountRaw', 'status',
  'txHash', 'payerAddress', 'payToAddress', 'timestamp'] as const;

function csvCell(value: string): string {
  // A quoted CSV field can still execute as a formula in spreadsheet software.
  const safe = /^[\s\x00-\x1f]*[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function serializeReceiptsCsv(items: PaymentProofRecord[]): string {
  const rows = items.map((item) => csvHeaders.map((key) => csvCell(String(item[key] ?? ''))).join(','));
  return [csvHeaders.join(','), ...rows].join('\r\n') + '\r\n';
}

function download(text: string, mime: string, extension: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `kite-x402-receipts-${Date.now()}.${extension}`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export const TxReceiptExportModal: React.FC<TxReceiptExportModalProps> = ({ isOpen, onClose, items }) => {
  if (!isOpen) return null;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="receipt-export-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-neutral-800 bg-neutral-900 p-6">
        <h3 id="receipt-export-title">Export Local Payment Records</h3>
        <p>{items.length} records selected. Settlement status is reported by each record and is not independently verified.</p>
        <div className="mt-6 flex flex-col space-y-3">
          <button disabled={items.length === 0} onClick={() => download(buildReceiptExportJson(items), 'application/json', 'json')}>
            Download x402 Receipts (.json)
          </button>
          <button disabled={items.length === 0} onClick={() => download(serializeReceiptsCsv(items), 'text/csv;charset=utf-8', 'csv')}>
            Download CSV (.csv)
          </button>
        </div>
        <button onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
};

export default TxReceiptExportModal;
