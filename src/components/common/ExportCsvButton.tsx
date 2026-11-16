import React from 'react';

export type CsvRow = Record<string, unknown>;

const encodeCell = (value: unknown): string => {
  const raw = value == null ? '' : String(value);
  const safe = typeof value === 'string' && (/^\s*[=+\-@]/.test(raw) || /^[\t\r\n]/.test(raw)) ? `'${raw}` : raw;
  return '"' + safe.replace(/"/g, '""') + '"';
};

/** Export a stable union of columns so missing fields never shift values. */
export const buildCsv = (rows: readonly CsvRow[]): string => {
  if (rows.length === 0) return '';
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return [
    headers.map(encodeCell).join(','),
    ...rows.map((row) => headers.map((key) => encodeCell(row[key])).join(',')),
  ].join('\r\n');
};

export const ExportCsvButton: React.FC<{ rows?: readonly CsvRow[] | null; filename?: string }> = ({ rows, filename = 'kite-transactions.csv' }) => {
  const handleExport = () => {
    if (!rows?.length) return;
    const blob = new Blob([buildCsv(rows)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  return (
    <button type="button" onClick={handleExport} disabled={!rows?.length} className="rounded bg-neutral-800 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-700">
      Export CSV
    </button>
  );
};

export default ExportCsvButton;
