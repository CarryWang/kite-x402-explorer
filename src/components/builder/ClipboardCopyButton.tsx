import React, { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';

export function ClipboardCopyButton({ text, label, style }: {
  text: string;
  label: string;
  style?: React.CSSProperties;
}) {
  const [attempt, setAttempt] = useState<{ text: string; status: 'pending' | 'copied' | 'failed' }>();
  const status = attempt?.status === 'pending' || attempt?.text === text ? attempt?.status : undefined;

  useEffect(() => {
    if (attempt?.status !== 'copied') return;
    const timer = setTimeout(() => setAttempt(undefined), 2000);
    return () => clearTimeout(timer);
  }, [attempt]);

  async function copy() {
    setAttempt({ text, status: 'pending' });
    try {
      await navigator.clipboard.writeText(text);
      setAttempt({ text, status: 'copied' });
    } catch {
      setAttempt({ text, status: 'failed' });
    }
  }

  return (
    <button type="button" className="btn btn-secondary" style={style}
      onClick={copy} disabled={status === 'pending'}
      title={status === 'failed' ? 'Select and copy the text manually, or click to retry.' : undefined}>
      {status === 'copied' ? <Check size={12} color="var(--accent-emerald)" /> : <Copy size={12} />}
      <span aria-live="polite">
        {status === 'pending' ? 'Copying…' : status === 'copied' ? 'Copied'
          : status === 'failed' ? 'Copy failed — select text or retry' : label}
      </span>
    </button>
  );
}
