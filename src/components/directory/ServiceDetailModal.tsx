import React, { useState } from 'react';
import type { ServiceManifest, ServiceEndpoint } from '../../types/service.js';
import { X, Play, AlertTriangle } from 'lucide-react';
import { CodeSnippetGenerator } from '../common/CodeSnippetGenerator.js';

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
  const [selectedEndpointIndex, setSelectedEndpointIndex] = useState<number>(0);

  if (!service) return null;

  const currentEp = service.endpoints[selectedEndpointIndex] || service.endpoints[0];
  const isTestnet = service.network === 'eip155:2368';

  // Convert USD price to integer token units
  const calculateTokenUnits = (usdStr: string) => {
    const usd = parseFloat(usdStr);
    if (isNaN(usd)) return '0';
    if (isTestnet) {
      // 1 pieUSD = 10^18 units ($1). $0.001 = 10^15 units
      return (BigInt(Math.round(usd * 1e6)) * BigInt(1e12)).toString();
    } else {
      // 1 USDC.e = 10^6 units ($1). $0.001 = 1000 units
      return Math.round(usd * 1e6).toString();
    }
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
          maxWidth: '880px',
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
          <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', marginTop: '0.5rem', lineHeight: 1.5 }}>
            {service.description}
          </p>
        </div>

        {/* Specs Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '0.75rem',
            background: 'var(--bg-secondary)',
            padding: '1rem',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1.5rem',
            border: '1px solid var(--border-glass)',
          }}
        >
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>NETWORK</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent-cyan)' }}>
              {isTestnet ? 'Kite Testnet (2368)' : 'Kite Mainnet (2366)'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>PAYMENT ASSET</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>
              {isTestnet ? 'pieUSD (18 dec)' : 'USDC.e (6 dec)'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>PAY TO WALLET</div>
            <div
              style={{
                fontSize: '0.8rem',
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
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>UPSTREAM API</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{service.upstream.name}</div>
          </div>
        </div>

        {/* Endpoints Tab Selector */}
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.5rem' }}>
            SERVICE ENDPOINTS ({service.endpoints.length})
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {service.endpoints.map((ep, idx) => (
              <button
                key={ep.path}
                onClick={() => setSelectedEndpointIndex(idx)}
                style={{
                  padding: '0.45rem 0.85rem',
                  borderRadius: 'var(--radius-md)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  border:
                    selectedEndpointIndex === idx
                      ? '1px solid var(--accent-cyan)'
                      : '1px solid var(--border-glass)',
                  background:
                    selectedEndpointIndex === idx ? 'rgba(0, 245, 255, 0.12)' : 'var(--bg-secondary)',
                  color: selectedEndpointIndex === idx ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <span
                  style={{
                    color: ep.method === 'GET' ? 'var(--accent-emerald)' : 'var(--accent-amber)',
                  }}
                >
                  {ep.method}
                </span>
                <span>{ep.path}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Selected Endpoint Deep Dive */}
        <div
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-glass)',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem',
            marginBottom: '1.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: '4px',
                  background: currentEp.method === 'GET' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                  color: currentEp.method === 'GET' ? 'var(--accent-emerald)' : 'var(--accent-amber)',
                }}
              >
                {currentEp.method}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '1.05rem' }}>
                {currentEp.path}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                  ${currentEp.price_usd}
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>
                  {calculateTokenUnits(currentEp.price_usd)} units
                </span>
              </div>
              <button
                className="btn btn-primary"
                onClick={() => {
                  onClose();
                  onOpenPlayground(service, currentEp);
                }}
                style={{ padding: '0.45rem 1rem', fontSize: '0.82rem' }}
              >
                <Play size={13} />
                Test in Playground
              </button>
            </div>
          </div>

          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            {currentEp.summary}
          </p>

          {/* Pitfalls alert if present */}
          {currentEp.pitfalls && currentEp.pitfalls.length > 0 && (
            <div
              style={{
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.75rem',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.6rem',
              }}
            >
              <AlertTriangle size={16} color="var(--accent-amber)" style={{ marginTop: '2px', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-amber)', marginBottom: '2px' }}>
                  DEVELOPER PITFALLS & CALL CAVEATS
                </div>
                <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {currentEp.pitfalls.map((pitfall, pIdx) => (
                    <li key={pIdx}>{pitfall}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Query Parameters Table */}
          {Boolean(currentEp.example_request?.query) && currentEp.example_request?.query && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.35rem' }}>
                QUERY PARAMETERS
              </div>
              <div style={{ background: '#07090e', borderRadius: '4px', border: '1px solid var(--border-glass)', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-glass)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '6px 12px' }}>Param</th>
                      <th style={{ padding: '6px 12px' }}>Example Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(currentEp.example_request.query).map(([k, v]) => (
                      <tr key={k} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '6px 12px', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>{k}</td>
                        <td style={{ padding: '6px 12px', fontFamily: 'var(--font-mono)', color: 'var(--text-code)' }}>{String(v)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Request Body Example */}
          {Boolean(currentEp.example_request?.body) && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.35rem' }}>
                REQUEST BODY (JSON)
              </div>
              <pre className="code-block" style={{ margin: 0, fontSize: '0.8rem' }}>
                {JSON.stringify(currentEp.example_request?.body, null, 2)}
              </pre>
            </div>
          )}

          {/* Interactive Code Generator Component */}
          <div style={{ marginTop: '1.25rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              DEVELOPER CODE SNIPPETS
            </div>
            <CodeSnippetGenerator service={service} endpoint={currentEp} />
          </div>
        </div>
      </div>
    </div>
  );
};
