import React, { useState, useEffect } from 'react';
import type { PaymentProofRecord, ProofStatus } from '../../types/proof.js';
import {
  getStoredProofs,
  deleteProof,
  clearAllProofs,
  subscribeToProofs,
} from '../../services/proof-logger.js';
import {
  downloadReceiptAsJson,
  downloadBatchReceiptsAsJson,
  copyReceiptJson,
} from '../../lib/receipt-exporter.js';
import {
  X,
  ShieldCheck,
  Download,
  Copy,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Search,
  Check,
  AlertTriangle,
  History,
} from 'lucide-react';
import { KITE_CHAINS } from '../../types/kite.js';

interface ProofLogDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProofLogDrawer: React.FC<ProofLogDrawerProps> = ({ isOpen, onClose }) => {
  const [proofs, setProofs] = useState<PaymentProofRecord[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<ProofStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setProofs(getStoredProofs());
    const unsubscribe = subscribeToProofs((updated) => setProofs(updated));
    return unsubscribe;
  }, []);

  if (!isOpen) return null;

  const filteredProofs = proofs.filter((p) => {
    if (filterStatus !== 'all' && p.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = p.serviceDisplayName.toLowerCase().includes(q);
      const matchPath = p.endpointPath.toLowerCase().includes(q);
      const matchTx = p.txHash ? p.txHash.toLowerCase().includes(q) : false;
      const matchPayer = p.payerAddress.toLowerCase().includes(q);
      return matchName || matchPath || matchTx || matchPayer;
    }
    return true;
  });

  const handleCopy = async (proof: PaymentProofRecord) => {
    const ok = await copyReceiptJson(proof);
    if (ok) {
      setCopiedId(proof.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const getStatusBadge = (status: ProofStatus) => {
    switch (status) {
      case 'settled':
      case 'simulated':
        return <span className="badge badge-emerald">Settled On-Chain</span>;
      case 'aborted_502':
        return <span className="badge badge-amber">502 Guarded (No Deduction)</span>;
      case 'expired_sig':
        return <span className="badge badge-rose">Expired Sig</span>;
      default:
        return <span className="badge badge-cyan">{status}</span>;
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 300,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '680px',
          height: '100%',
          background: 'var(--bg-card)',
          borderLeft: '1px solid var(--border-glass)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-card)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-glass)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-secondary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <ShieldCheck size={20} color="var(--accent-cyan)" />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Persistent Proof Logs</h3>
                <span
                  style={{
                    fontSize: '0.75rem',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    background: 'rgba(0, 245, 255, 0.15)',
                    color: 'var(--accent-cyan)',
                    fontWeight: 700,
                  }}
                >
                  {proofs.length}
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Auditable EIP-3009 authorizations and settlement receipts
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {proofs.length > 0 && (
              <>
                <button
                  className="btn btn-secondary"
                  onClick={() => downloadBatchReceiptsAsJson(proofs)}
                  style={{ fontSize: '0.78rem', padding: '0.4rem 0.75rem' }}
                  title="Export all records as a single JSON report"
                >
                  <Download size={13} /> Export All
                </button>
                <button
                  onClick={() => {
                    if (window.confirm('Are you sure you want to clear all proof history?')) {
                      clearAllProofs();
                    }
                  }}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(244, 63, 94, 0.3)',
                    color: 'var(--accent-rose)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.4rem 0.6rem',
                    cursor: 'pointer',
                    fontSize: '0.78rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                  title="Clear all stored proof records"
                >
                  <Trash2 size={13} />
                </button>
              </>
            )}
            <button
              onClick={onClose}
              style={{
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-glass)',
                color: 'var(--text-secondary)',
                borderRadius: '50%',
                width: '30px',
                height: '30px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Filter Controls */}
        <div
          style={{
            padding: '0.85rem 1.5rem',
            borderBottom: '1px solid var(--border-glass)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            background: 'rgba(0, 0, 0, 0.2)',
          }}
        >
          {/* Search bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-glass)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.35rem 0.75rem',
              gap: '0.5rem',
            }}
          >
            <Search size={14} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Search by service, endpoint, or txHash..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
                outline: 'none',
                width: '100%',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Status filter pills */}
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>STATUS:</span>
            {(['all', 'settled', 'aborted_502', 'expired_sig'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                style={{
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.72rem',
                  border: filterStatus === st ? '1px solid var(--accent-cyan)' : '1px solid var(--border-glass)',
                  background: filterStatus === st ? 'rgba(0, 245, 255, 0.15)' : 'transparent',
                  color: filterStatus === st ? 'var(--accent-cyan)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  fontWeight: filterStatus === st ? 600 : 400,
                }}
              >
                {st === 'all'
                  ? 'All'
                  : st === 'settled'
                  ? 'Settled'
                  : st === 'aborted_502'
                  ? '502 Guarded'
                  : 'Expired'}
              </button>
            ))}
          </div>
        </div>

        {/* Proof Records List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.5rem' }}>
          {filteredProofs.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '4rem 1rem',
                color: 'var(--text-muted)',
              }}
            >
              <History size={40} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
              <div style={{ fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                No Payment Proofs Found
              </div>
              <p style={{ fontSize: '0.82rem', maxWidth: '360px', margin: '0 auto' }}>
                Run an interactive request in the x402 Playground to generate on-chain settlement receipts and EIP-3009 cryptographic proof logs.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {filteredProofs.map((proof) => {
                const isExpanded = expandedId === proof.id;
                const chainConfig = KITE_CHAINS[proof.network] || KITE_CHAINS['eip155:2368'];

                return (
                  <div
                    key={proof.id}
                    style={{
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-glass)',
                      borderRadius: 'var(--radius-md)',
                      padding: '1rem',
                      transition: 'border-color 0.2s',
                    }}
                  >
                    {/* Item Top Row */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                      }}
                      onClick={() => setExpandedId(isExpanded ? null : proof.id)}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                          <span style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {proof.serviceDisplayName}
                          </span>
                          {getStatusBadge(proof.status)}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', fontFamily: 'var(--font-mono)' }}>
                          <span style={{ color: 'var(--accent-emerald)', fontWeight: 700 }}>
                            {proof.httpMethod}
                          </span>
                          <span style={{ color: 'var(--text-code)' }}>{proof.endpointPath}</span>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div>
                          <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                            {proof.amountFormatted}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {new Date(proof.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                        <button
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: '4px',
                          }}
                        >
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </div>
                    </div>

                    {/* Expandable Details */}
                    {isExpanded && (
                      <div
                        style={{
                          marginTop: '1rem',
                          paddingTop: '1rem',
                          borderTop: '1px solid var(--border-glass)',
                          fontSize: '0.78rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.75rem',
                        }}
                      >
                        {/* Guard Note if 502 */}
                        {proof.status === 'aborted_502' && (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              background: 'rgba(245, 158, 11, 0.1)',
                              border: '1px solid rgba(245, 158, 11, 0.3)',
                              padding: '0.5rem 0.75rem',
                              borderRadius: 'var(--radius-sm)',
                              color: 'var(--accent-amber)',
                            }}
                          >
                            <AlertTriangle size={15} />
                            <span>
                              Zero-Deduction Guarantee: Facilitator aborted settlement because upstream service responded with HTTP 502.
                            </span>
                          </div>
                        )}

                        {/* Tx Hash */}
                        {proof.txHash && (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              background: '#07090e',
                              padding: '0.5rem 0.75rem',
                              borderRadius: 'var(--radius-sm)',
                              fontFamily: 'var(--font-mono)',
                            }}
                          >
                            <div>
                              <span style={{ color: 'var(--text-muted)', marginRight: '6px' }}>Tx:</span>
                              <span style={{ color: 'var(--accent-cyan)' }}>
                                {proof.txHash.slice(0, 16)}...{proof.txHash.slice(-8)}
                              </span>
                            </div>
                            <a
                              href={`${chainConfig.explorerUrl}/tx/${proof.txHash}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                color: 'var(--accent-cyan)',
                                textDecoration: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px',
                                fontSize: '0.72rem',
                              }}
                            >
                              KiteScan <ExternalLink size={12} />
                            </a>
                          </div>
                        )}

                        {/* Crypto parameters */}
                        {proof.eip3009Details && (
                          <div
                            style={{
                              background: '#07090e',
                              borderRadius: 'var(--radius-sm)',
                              padding: '0.65rem',
                              fontFamily: 'var(--font-mono)',
                              fontSize: '0.72rem',
                              display: 'grid',
                              gridTemplateColumns: '1fr 1fr',
                              gap: '0.4rem',
                            }}
                          >
                            <div>
                              <span style={{ color: 'var(--text-muted)' }}>Payer: </span>
                              <span style={{ color: 'var(--text-secondary)' }}>
                                {proof.payerAddress.slice(0, 8)}...{proof.payerAddress.slice(-4)}
                              </span>
                            </div>
                            <div>
                              <span style={{ color: 'var(--text-muted)' }}>PayTo: </span>
                              <span style={{ color: 'var(--text-secondary)' }}>
                                {proof.payToAddress.slice(0, 8)}...{proof.payToAddress.slice(-4)}
                              </span>
                            </div>
                            <div>
                              <span style={{ color: 'var(--text-muted)' }}>Nonce: </span>
                              <span style={{ color: 'var(--accent-amber)' }}>
                                {proof.eip3009Details.nonce.slice(0, 10)}...
                              </span>
                            </div>
                            <div>
                              <span style={{ color: 'var(--text-muted)' }}>ValidBefore: </span>
                              <span style={{ color: 'var(--accent-emerald)' }}>
                                {proof.eip3009Details.validBefore}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Action buttons */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            paddingTop: '0.4rem',
                          }}
                        >
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              className="btn btn-secondary"
                              onClick={() => downloadReceiptAsJson(proof)}
                              style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                            >
                              <Download size={12} /> JSON Receipt
                            </button>
                            <button
                              className="btn btn-secondary"
                              onClick={() => handleCopy(proof)}
                              style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                            >
                              {copiedId === proof.id ? (
                                <>
                                  <Check size={12} color="var(--accent-emerald)" /> Copied!
                                </>
                              ) : (
                                <>
                                  <Copy size={12} /> Copy JSON
                                </>
                              )}
                            </button>
                          </div>

                          <button
                            onClick={() => deleteProof(proof.id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--accent-rose)',
                              cursor: 'pointer',
                              fontSize: '0.75rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Trash2 size={12} /> Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
