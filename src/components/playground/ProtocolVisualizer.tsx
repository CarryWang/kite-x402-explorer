import React, { useState } from 'react';
import type { X402ChallengePayload } from '../../types/x402.js';
import type { PaymentProofRecord } from '../../types/proof.js';
import {
  ExternalLink,
  CheckCircle2,
  ShieldCheck,
  Hash,
  Download,
  Copy,
  Check,
  FileCheck,
} from 'lucide-react';
import { KITE_CHAINS } from '../../types/kite.js';
import { downloadReceiptAsJson, copyReceiptJson } from '../../lib/receipt-exporter.js';

interface ProtocolVisualizerProps {
  step: 1 | 2 | 3;
  challengePayload: X402ChallengePayload | null;
  rawSignaturePayload: string;
  responseStatus: number | null;
  txHash: string;
  network: string;
  serviceName?: string;
  serviceDisplayName?: string;
  endpointPath?: string;
  httpMethod?: string;
  payerAddress?: string;
  onOpenProofLogs?: () => void;
}

export const ProtocolVisualizer: React.FC<ProtocolVisualizerProps> = ({
  step,
  challengePayload,
  rawSignaturePayload,
  responseStatus,
  txHash,
  network,
  serviceName = 'kite-service',
  serviceDisplayName = 'Kite x402 Service',
  endpointPath = '/v1/resource',
  httpMethod = 'GET',
  payerAddress = '0x0000000000000000000000000000000000000000',
  onOpenProofLogs,
}) => {
  const chainConfig = KITE_CHAINS[network] || KITE_CHAINS['eip155:2368'];
  const isSettled = responseStatus === 200 && Boolean(txHash);
  const [copied, setCopied] = useState(false);

  let parsedSig: {
    authorization?: {
      from?: string;
      to?: string;
      value?: string;
      nonce?: string;
      v?: number;
      r?: string;
      s?: string;
      validAfter?: number;
      validBefore?: number;
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

  // Construct standard proof record for export
  const currentProofRecord: PaymentProofRecord = {
    id: `prf_live_${txHash ? txHash.slice(-8) : Date.now().toString(36)}`,
    timestamp: new Date().toISOString(),
    serviceName,
    serviceDisplayName,
    endpointPath,
    httpMethod,
    network,
    tokenSymbol: network === 'eip155:2368' ? 'pieUSD' : 'USDC.e',
    tokenAddress:
      network === 'eip155:2368'
        ? '0x38129cf4CE5E183eFF248F42A7D345Bb1B47621A'
        : '0x7aB6f3ed87C42eF0aDb67Ed95090f8bF5240149e',
    amountFormatted: challengePayload?.accepts[0]?.amount
      ? `${challengePayload.accepts[0].amount} raw`
      : '0.001 pieUSD',
    amountRaw: challengePayload?.accepts[0]?.amount || '1000000000000000',
    payerAddress: auth?.from || payerAddress,
    payToAddress: (auth?.to as `0x${string}`) || '0x0000000000000000000000000000000000000000',
    status: isSettled ? 'settled' : 'simulated',
    txHash: txHash || undefined,
    rawChallengeHeader: challengePayload ? btoa(JSON.stringify(challengePayload)) : undefined,
    signedAuthorizationPayload: rawSignaturePayload || undefined,
    eip3009Details: auth
      ? {
          from: auth.from || '',
          to: auth.to || '',
          value: auth.value || '0',
          nonce: auth.nonce || '0x0',
          validAfter: auth.validAfter ?? 0,
          validBefore: auth.validBefore ?? 0,
          v: auth.v,
          r: auth.r,
          s: auth.s,
        }
      : undefined,
    responseStatus: responseStatus || 200,
  };

  const handleCopyReceipt = async () => {
    const ok = await copyReceiptJson(currentProofRecord);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {onOpenProofLogs && (
            <button
              onClick={onOpenProofLogs}
              className="btn btn-secondary"
              style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
            >
              <FileCheck size={13} /> View Audit Logs
            </button>
          )}
          <span className={`badge ${isSettled ? 'badge-emerald' : step > 1 ? 'badge-cyan' : 'badge-amber'}`}>
            {isSettled ? 'Settled on-chain' : step === 3 ? 'Awaiting Settle' : step === 2 ? '402 Captured' : 'Ready'}
          </span>
        </div>
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
            background: step >= 3 ? 'rgba(0, 245, 255, 0.05)' : 'var(--bg-secondary)',
            border: step >= 3 ? '1px solid rgba(0, 245, 255, 0.25)' : '1px solid var(--border-glass)',
            borderRadius: 'var(--radius-md)',
            padding: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--accent-cyan)', fontWeight: 700 }}>PHASE 2</span>
            {step >= 3 && <CheckCircle2 size={14} color="var(--accent-emerald)" />}
          </div>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.25rem' }}>EIP-3009 Auth</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {auth?.nonce ? (
              <span>Nonce: <code style={{ color: 'var(--accent-amber)' }}>{auth.nonce.slice(0, 8)}...</code></span>
            ) : (
              'Signer idle'
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
            <span style={{ fontSize: '0.72rem', color: isSettled ? 'var(--accent-emerald)' : 'var(--accent-cyan)', fontWeight: 700 }}>
              PHASE 3
            </span>
            {isSettled && <CheckCircle2 size={14} color="var(--accent-emerald)" />}
          </div>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.25rem' }}>Facilitator Verify</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {isSettled ? (
              <span style={{ color: 'var(--accent-emerald)' }}>Settled On-Chain</span>
            ) : (
              'Awaiting relay...'
            )}
          </div>
        </div>

        {/* Phase 4: API Response */}
        <div
          style={{
            background: isSettled ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-secondary)',
            border: isSettled ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border-glass)',
            borderRadius: 'var(--radius-md)',
            padding: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.72rem', color: isSettled ? 'var(--accent-emerald)' : 'var(--accent-cyan)', fontWeight: 700 }}>
              PHASE 4
            </span>
            {isSettled && <CheckCircle2 size={14} color="var(--accent-emerald)" />}
          </div>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.25rem' }}>Upstream 200 OK</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {responseStatus ? (
              <span style={{ color: responseStatus === 200 ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
                Status {responseStatus}
              </span>
            ) : (
              'Pending result'
            )}
          </div>
        </div>
      </div>

      {/* Signature decomposition details */}
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

      {/* Explorer Deep Link & Receipt Actions */}
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
            flexWrap: 'wrap',
            gap: '1rem',
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {/* Download Receipt */}
            <button
              className="btn btn-secondary"
              onClick={() => downloadReceiptAsJson(currentProofRecord)}
              style={{ fontSize: '0.78rem', padding: '0.45rem 0.85rem' }}
              title="Download cryptographically verifiable receipt"
            >
              <Download size={13} />
              <span>Download Receipt</span>
            </button>

            {/* Copy Receipt JSON */}
            <button
              className="btn btn-secondary"
              onClick={handleCopyReceipt}
              style={{ fontSize: '0.78rem', padding: '0.45rem 0.85rem' }}
              title="Copy verifiable receipt JSON to clipboard"
            >
              {copied ? (
                <>
                  <Check size={13} color="var(--accent-emerald)" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={13} />
                  <span>Copy Receipt</span>
                </>
              )}
            </button>

            {/* KiteScan link */}
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
        </div>
      )}
    </div>
  );
};
