import React, { useState } from 'react';
import type { ServiceManifest, ServiceEndpoint } from '../../types/service.js';
import { X, Copy, Check, Play } from 'lucide-react';

interface ServiceDetailModalProps {
  service: ServiceManifest | null;
  onClose: () => void;
  onOpenPlayground: (service: ServiceManifest, endpoint?: ServiceEndpoint) => void;
}

export const ServiceDetailModal: React.FC<ServiceDetailModalProps> = ({
  service,
  onClose,
  onOpenPlayground,
}) => {
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [activeCodeTab, setActiveCodeTab] = useState<'curl' | 'ts'>('curl');

  if (!service) return null;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPath(id);
    setTimeout(() => setCopiedPath(null), 2000);
  };

  const getCurlSnippet = (ep: ServiceEndpoint) => {
    const fullUrl = `${service.base_url || 'https://your-host'}${ep.path}`;
    return `curl -i -X ${ep.method} "${fullUrl}" \\
  -H "Accept: application/json"`;
  };

  const getTsSnippet = (ep: ServiceEndpoint) => {
    return `// Using Kite x402 client or fetch with EIP-3009 authorization
const res = await fetch("${service.base_url || 'https://your-host'}${ep.path}", {
  method: "${ep.method}",
  headers: {
    "Accept": "application/json",
    // "PAYMENT-SIGNATURE": "<eip-3009-authorization-base64>"
  }
});
const data = await res.json();
console.log(data);`;
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
      }}
      onClick={onClose}
    >
      <div
        className="glass-card"
        style={{
          width: '100%',
          maxWidth: '820px',
          maxHeight: '90vh',
          overflowY: 'auto',
          position: 'relative',
          padding: '2rem',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1.5rem',
            right: '1.5rem',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-glass)',
            color: 'var(--text-secondary)',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <X size={16} />
        </button>

        {/* Modal Title */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>{service.display_name}</h2>
            <span className={`badge ${service.status === 'live' ? 'badge-purple' : 'badge-cyan'}`}>
              {service.status}
            </span>
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            services/{service.name}/service.yaml
          </div>
        </div>

        {/* Specs Table */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            background: 'var(--bg-secondary)',
            padding: '1rem',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1.5rem',
            border: '1px solid var(--border-glass)',
          }}
        >
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>NETWORK</div>
            <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--accent-cyan)' }}>
              {service.network === 'eip155:2368' ? 'Kite Testnet (2368)' : 'Kite Mainnet (2366)'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>PAYMENT ASSET</div>
            <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>
              {service.network === 'eip155:2368' ? 'pieUSD (18 decimals)' : 'USDC.e (6 decimals)'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>PAY TO ADDRESS</div>
            <div
              style={{
                fontSize: '0.82rem',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-code)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={service.pay_to}
            >
              {service.pay_to.slice(0, 8)}...{service.pay_to.slice(-6)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>UPSTREAM API</div>
            <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>{service.upstream.name}</div>
          </div>
        </div>

        {/* Endpoints Breakdown */}
        <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
          Endpoints & Schema
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
          {service.endpoints.map((ep) => (
            <div
              key={ep.path}
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-glass)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: ep.method === 'GET' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                      color: ep.method === 'GET' ? 'var(--accent-emerald)' : 'var(--accent-amber)',
                    }}
                  >
                    {ep.method}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.92rem' }}>
                    {ep.path}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                    ${ep.price_usd}
                  </span>
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      onClose();
                      onOpenPlayground(service, ep);
                    }}
                    style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                  >
                    <Play size={12} />
                    Test Endpoint
                  </button>
                </div>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                {ep.summary}
              </p>

              {/* Code snippet with tab switch */}
              <div style={{ marginBottom: '0.4rem', display: 'flex', gap: '0.4rem' }}>
                <button
                  onClick={() => setActiveCodeTab('curl')}
                  style={{
                    padding: '2px 8px',
                    fontSize: '0.72rem',
                    borderRadius: '4px',
                    border: 'none',
                    cursor: 'pointer',
                    background: activeCodeTab === 'curl' ? 'var(--bg-tertiary)' : 'transparent',
                    color: activeCodeTab === 'curl' ? 'var(--accent-cyan)' : 'var(--text-muted)',
                    fontWeight: activeCodeTab === 'curl' ? 600 : 400,
                  }}
                >
                  cURL
                </button>
                <button
                  onClick={() => setActiveCodeTab('ts')}
                  style={{
                    padding: '2px 8px',
                    fontSize: '0.72rem',
                    borderRadius: '4px',
                    border: 'none',
                    cursor: 'pointer',
                    background: activeCodeTab === 'ts' ? 'var(--bg-tertiary)' : 'transparent',
                    color: activeCodeTab === 'ts' ? 'var(--accent-cyan)' : 'var(--text-muted)',
                    fontWeight: activeCodeTab === 'ts' ? 600 : 400,
                  }}
                >
                  TypeScript
                </button>
              </div>

              <div style={{ position: 'relative' }}>
                <pre className="code-block" style={{ margin: 0, fontSize: '0.78rem' }}>
                  {activeCodeTab === 'curl' ? getCurlSnippet(ep) : getTsSnippet(ep)}
                </pre>
                <button
                  onClick={() => handleCopy(activeCodeTab === 'curl' ? getCurlSnippet(ep) : getTsSnippet(ep), ep.path)}
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-glass)',
                    color: 'var(--text-secondary)',
                    borderRadius: '4px',
                    padding: '4px',
                    cursor: 'pointer',
                  }}
                  title="Copy code"
                >
                  {copiedPath === ep.path ? <Check size={12} color="var(--accent-emerald)" /> : <Copy size={12} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
