import React from 'react';
import type { X402ChallengePayload } from '../../types/x402.js';
import { ExternalLink, CheckCircle2, ShieldCheck, Hash } from 'lucide-react';
import { KITE_CHAINS } from '../../types/kite.js';

interface ProtocolVisualizerProps {
  step: 1 | 2 | 3;
  challengePayload: X402ChallengePayload | null;
  rawSignaturePayload: string;
  responseStatus: number | null;
  txHash: string;
  network: string;
}

export const ProtocolVisualizer: React.FC<ProtocolVisualizerProps> = ({
  step,
  challengePayload,
  rawSignaturePayload,
  responseStatus,
  txHash,
  network,
}) => {
  const chainConfig = KITE_CHAINS[network] || KITE_CHAINS['eip155:2368'];
  const isSettled = responseStatus === 200 && Boolean(txHash);

  let parsedSig: {
    authorization?: {
      from?: string;
      to?: string;
      value?: string;
      nonce?: string;
      v?: number;
      r?: string;
      s?: string;
    };
  } = {};

  if (rawSignaturePayload) {
    try {
      parsedSig = JSON.parse(atob(rawSignaturePayload));
    } catch {
      // ignore
    }
  }

  const auth = parsedSig.authorization;

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-glass)',
        borderRadius: 'var(--radius-lg)',
        padding: '1.5rem',
        marginTop: '1.5rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <ShieldCheck size={18} color="var(--accent-cyan)" />
          <h4 style={{ fontSize: '1rem', fontWeight: 700 }}>Protocol Audit Trail & Cryptographic Verification</h4>
        </div>
        <span className={`badge ${isSettled ? 'badge-emerald' : step > 1 ? 'badge-cyan' : 'badge-amber'}`}>
          {isSettled ? 'Settled on-chain' : step === 3 ? 'Awaiting Settle' : step === 2 ? '402 Captured' : 'Ready'}
        </span>
      </div>

      {/* 4-Phase Stepper */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
          marginBottom: '1.25rem',
        }}
      >
        {/* Phase 1: 402 Discovery */}
        <div
          style={{
            background: step >= 2 ? 'rgba(0, 245, 255, 0.05)' : 'var(--bg-secondary)',
            border: step >= 2 ? '1px solid rgba(0, 245, 255, 0.25)' : '1px solid var(--border-glass)',
            borderRadius: 'var(--radius-md)',
            padding: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--accent-cyan)', fontWeight: 700 }}>PHASE 1</span>
            {step >= 2 && <CheckCircle2 size={14} color="var(--accent-emerald)" />}
          </div>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.25rem' }}>402 Challenge</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {challengePayload ? (
              <span>Amount: <code style={{ color: 'var(--text-primary)' }}>{challengePayload.accepts[0].amount}</code></span>
            ) : (
              'Awaiting call...'
            )}
          </div>
        </div>

        {/* Phase 2: EIP-3009 Signature */}
        <div
          style={{
            background: step >= 3 ? 'rgba(121, 40, 202, 0.08)' : 'var(--bg-secondary)',
            border: step >= 3 ? '1px solid rgba(121, 40, 202, 0.3)' : '1px solid var(--border-glass)',
            borderRadius: 'var(--radius-md)',
            padding: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.72rem', color: '#c084fc', fontWeight: 700 }}>PHASE 2</span>
            {step >= 3 && <CheckCircle2 size={14} color="var(--accent-emerald)" />}
          </div>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.25rem' }}>EIP-3009 Consent</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {auth ? (
              <span>From: <code style={{ color: 'var(--text-code)' }}>{auth.from?.slice(0, 6)}...{auth.from?.slice(-4)}</code></span>
            ) : (
              'Waiting for sign...'
            )}
          </div>
        </div>

        {/* Phase 3: Facilitator Settlement */}
        <div
          style={{
            background: isSettled ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-secondary)',
            border: isSettled ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border-glass)',
            borderRadius: 'var(--radius-md)',
            padding: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--accent-emerald)', fontWeight: 700 }}>PHASE 3</span>
            {isSettled && <CheckCircle2 size={14} color="var(--accent-emerald)" />}
          </div>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.25rem' }}>Kite Chain Settlement</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {txHash ? (
              <span style={{ color: 'var(--accent-emerald)' }}>Settled (Gasless)</span>
            ) : (
              'Pending relay...'
            )}
          </div>
        </div>
      </div>

      {/* Detailed Cryptographic Decomposition if available */}
      {auth && (
        <div
          style={{
            background: '#07090e',
            borderRadius: 'var(--radius-md)',
            padding: '1rem',
            border: '1px solid var(--border-glass)',
            marginBottom: '1rem',
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-purple)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Hash size={13} />
            EIP-712 SIGNATURE PARAMETERS DECOMPOSITION
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '0.75rem',
              fontSize: '0.75rem',
              fontFamily: 'var(--font-mono)',
            }}
          >
            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block' }}>r:</span>
              <span style={{ color: 'var(--text-code)' }}>{auth.r?.slice(0, 14)}...{auth.r?.slice(-6)}</span>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block' }}>s:</span>
              <span style={{ color: 'var(--text-code)' }}>{auth.s?.slice(0, 14)}...{auth.s?.slice(-6)}</span>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block' }}>v:</span>
              <span style={{ color: 'var(--accent-emerald)' }}>{auth.v}</span>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block' }}>Nonce (32-bytes):</span>
              <span style={{ color: 'var(--accent-amber)' }}>{auth.nonce?.slice(0, 10)}...</span>
            </div>
          </div>
        </div>
      )}

      {/* Explorer Deep Link */}
      {txHash && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(0, 245, 255, 0.08)',
            border: '1px solid rgba(0, 245, 255, 0.25)',
            borderRadius: 'var(--radius-md)',
            padding: '0.85rem 1.25rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <CheckCircle2 size={18} color="var(--accent-emerald)" />
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                On-Chain Micropayment Settled
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                Tx: {txHash}
              </div>
            </div>
          </div>

          <a
            href={`${chainConfig.explorerUrl}/tx/${txHash}`}
            target="_blank"
            rel="noreferrer"
            className="btn btn-primary"
            style={{ fontSize: '0.78rem', padding: '0.45rem 0.85rem' }}
          >
            <span>Inspect on KiteScan</span>
            <ExternalLink size={13} />
          </a>
        </div>
      )}
    </div>
  );
};
