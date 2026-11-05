import React from 'react';

export const ExportCsvButton: React.FC<{ rows: any[]; filename?: string }> = ({ rows, filename = 'kite-transactions.csv' }) => {
  const handleExport = () => {
    if (!rows || rows.length === 0) return;
    const headers = Object.keys(rows[0]).join(',');
    const values = rows.map((r) => Object.values(r).map((v) => `"${v}"`).join(',')).join('\n');
    const csv = `${headers}\n${values}`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button onClick={handleExport} className="rounded bg-neutral-800 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-700">
      Export CSV
    </button>
  );
};

export default ExportCsvButton;
