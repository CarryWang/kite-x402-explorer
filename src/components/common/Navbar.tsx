import React from 'react';
import { Compass, Terminal, BookOpen, ShieldCheck, FileCode, Zap } from 'lucide-react';

export type NavTab = 'directory' | 'playground' | 'builder' | 'e2e' | 'docs';

interface NavbarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  selectedNetwork: 'all' | 'testnet' | 'mainnet';
  onSelectNetwork: (net: 'all' | 'testnet' | 'mainnet') => void;
  proofCount?: number;
  onOpenProofLogs?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  selectedNetwork,
  onSelectNetwork,
  proofCount = 0,
  onOpenProofLogs,
}) => {
  return (
    <header className="navbar">
      <div className="navbar-inner">
        <div className="brand" role="button" onClick={() => onSelectTab('directory')} style={{ cursor: 'pointer' }}>
          <img src="/kite-icon.svg" alt="Kite AI" className="brand-logo" />
          <div>
            <div className="brand-text">Kite x402 Explorer</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
              AGENT PAYMENT PROTOCOL HUB
            </div>
          </div>
        </div>

        <nav className="nav-links">
          <button
            className={`nav-item ${activeTab === 'directory' ? 'active' : ''}`}
            onClick={() => onSelectTab('directory')}
            style={{ background: 'none', border: 'none' }}
          >
            <Compass size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
            Services Directory
          </button>
          <button
            className={`nav-item ${activeTab === 'playground' ? 'active' : ''}`}
            onClick={() => onSelectTab('playground')}
            style={{ background: 'none', border: 'none' }}
          >
            <Terminal size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
            x402 Playground
          </button>
          <button
            className={`nav-item ${activeTab === 'builder' ? 'active' : ''}`}
            onClick={() => onSelectTab('builder')}
            style={{ background: 'none', border: 'none' }}
          >
            <FileCode size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
            Manifest Builder
          </button>
          <button
            className={`nav-item ${activeTab === 'e2e' ? 'active' : ''}`}
            onClick={() => onSelectTab('e2e')}
            style={{ background: 'none', border: 'none' }}
          >
            <Zap size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
            Testnet E2E Suite
          </button>
          <button
            className={`nav-item ${activeTab === 'docs' ? 'active' : ''}`}
            onClick={() => onSelectTab('docs')}
            style={{ background: 'none', border: 'none' }}
          >
            <BookOpen size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
            Architecture & Docs
          </button>
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ display: 'flex', background: 'var(--bg-secondary)', padding: '2px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)' }}>
            <button
              onClick={() => onSelectNetwork('all')}
              style={{
                padding: '4px 10px',
                fontSize: '0.75rem',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                background: selectedNetwork === 'all' ? 'var(--bg-tertiary)' : 'transparent',
                color: selectedNetwork === 'all' ? 'var(--text-primary)' : 'var(--text-muted)',
                fontWeight: selectedNetwork === 'all' ? 600 : 400,
              }}
            >
              All
            </button>
            <button
              onClick={() => onSelectNetwork('testnet')}
              style={{
                padding: '4px 10px',
                fontSize: '0.75rem',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                background: selectedNetwork === 'testnet' ? 'rgba(0, 245, 255, 0.15)' : 'transparent',
                color: selectedNetwork === 'testnet' ? 'var(--accent-cyan)' : 'var(--text-muted)',
                fontWeight: selectedNetwork === 'testnet' ? 600 : 400,
              }}
            >
              Testnet (pieUSD)
            </button>
            <button
              onClick={() => onSelectNetwork('mainnet')}
              style={{
                padding: '4px 10px',
                fontSize: '0.75rem',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                background: selectedNetwork === 'mainnet' ? 'rgba(138, 43, 226, 0.15)' : 'transparent',
                color: selectedNetwork === 'mainnet' ? '#c084fc' : 'var(--text-muted)',
                fontWeight: selectedNetwork === 'mainnet' ? 600 : 400,
              }}
            >
              Mainnet (USDC.e)
            </button>
          </div>

          <div className="network-badge">
            <span className="dot-indicator" />
            <span>Kite eip155</span>
          </div>

          {Boolean(onOpenProofLogs) && (
            <button
              onClick={onOpenProofLogs}
              className="btn btn-secondary"
              style={{
                fontSize: '0.75rem',
                padding: '5px 10px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-glass)',
              }}
              title="Inspect persistent payment proof logs"
            >
              <ShieldCheck size={14} color="var(--accent-cyan)" />
              <span>Proofs</span>
              {typeof proofCount === 'number' && proofCount > 0 && (
                <span
                  style={{
                    background: 'rgba(0, 245, 255, 0.2)',
                    color: 'var(--accent-cyan)',
                    padding: '1px 6px',
                    borderRadius: '10px',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                  }}
                >
                  {proofCount}
                </span>
              )}
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
