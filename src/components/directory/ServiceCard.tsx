import React from 'react';
import type { ServiceManifest } from '../../types/service.js';
import { Play, Code } from 'lucide-react';

interface ServiceCardProps {
  service: ServiceManifest;
  onSelectService: (service: ServiceManifest) => void;
  onOpenPlayground: (service: ServiceManifest) => void;
}

export const ServiceCard: React.FC<ServiceCardProps> = ({
  service,
  onSelectService,
  onOpenPlayground,
}) => {
  const isTestnet = service.network === 'eip155:2368';
  const minPrice = service.endpoints.reduce((min, ep) => {
    const p = parseFloat(ep.price_usd);
    return p < min ? p : min;
  }, Infinity);

  return (
    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {service.display_name}
            </h3>
            <span className={`badge ${service.status === 'live' ? 'badge-purple' : 'badge-cyan'}`}>
              {service.status}
            </span>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            services/{service.name}
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Pricing</div>
          <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
            ${minPrice < Infinity ? minPrice : '0.001'}
            <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-secondary)' }}>/call</span>
          </div>
        </div>
      </div>

      {/* Description */}
      <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '1rem', flex: 1 }}>
        {service.description}
      </p>

      {/* Tags & Network */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1.25rem' }}>
        <span
          style={{
            fontSize: '0.7rem',
            padding: '2px 8px',
            borderRadius: 'var(--radius-sm)',
            background: isTestnet ? 'rgba(0, 245, 255, 0.1)' : 'rgba(121, 40, 202, 0.15)',
            color: isTestnet ? 'var(--accent-cyan)' : '#c084fc',
            border: `1px solid ${isTestnet ? 'rgba(0, 245, 255, 0.25)' : 'rgba(121, 40, 202, 0.3)'}`,
            fontWeight: 600,
          }}
        >
          {isTestnet ? 'Kite Testnet (pieUSD)' : 'Kite Mainnet (USDC.e)'}
        </span>
        {service.categories.map((cat) => (
          <span
            key={cat}
            style={{
              fontSize: '0.7rem',
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)',
            }}
          >
            #{cat}
          </span>
        ))}
      </div>

      {/* Endpoints snippet */}
      <div
        style={{
          background: 'rgba(0, 0, 0, 0.25)',
          borderRadius: 'var(--radius-md)',
          padding: '0.6rem 0.8rem',
          marginBottom: '1.25rem',
          border: '1px solid rgba(255, 255, 255, 0.05)',
        }}
      >
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.35rem', fontWeight: 600 }}>
          AVAILABLE ENDPOINTS ({service.endpoints.length})
        </div>
        {service.endpoints.slice(0, 2).map((ep) => (
          <div
            key={ep.path}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.78rem',
              fontFamily: 'var(--font-mono)',
              padding: '2px 0',
            }}
          >
            <span style={{ color: 'var(--text-code)' }}>
              <strong style={{ color: ep.method === 'GET' ? 'var(--accent-emerald)' : 'var(--accent-amber)', marginRight: '6px' }}>
                {ep.method}
              </strong>
              {ep.path}
            </span>
            <span style={{ color: 'var(--text-muted)' }}>${ep.price_usd}</span>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <button
          className="btn btn-secondary"
          onClick={() => onSelectService(service)}
          style={{ fontSize: '0.82rem', padding: '0.55rem 0.75rem' }}
        >
          <Code size={14} />
          Details & Spec
        </button>
        <button
          className="btn btn-primary"
          onClick={() => onOpenPlayground(service)}
          style={{ fontSize: '0.82rem', padding: '0.55rem 0.75rem' }}
        >
          <Play size={14} />
          Playground
        </button>
      </div>
    </div>
  );
};
