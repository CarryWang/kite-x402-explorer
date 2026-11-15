import React from 'react';
import { CheckCircle, Layers } from 'lucide-react';

export const DocsView: React.FC = () => {
  return (
    <div style={{ maxWidth: '960px', margin: '0 auto' }}>
      {/* Title */}
      <div style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2.25rem', fontWeight: 800, marginBottom: '0.75rem' }}>
          Architecture & <span>Project History</span>
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', lineHeight: 1.6 }}>
          A reference x402 flow and a summary of the original feature milestones. The current development schedule is tracked in the repository roadmap.
        </p>
      </div>

      {/* Protocol Diagram Card */}
      <div className="glass-card" style={{ marginBottom: '2.5rem', padding: '1.75rem' }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Layers size={18} color="var(--accent-cyan)" />
          Reference x402 Payment Flow
        </h3>

        <div style={{ background: '#07090e', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)' }}>
          <pre style={{ color: 'var(--text-code)', fontSize: '0.82rem', lineHeight: 1.5, margin: 0, fontFamily: 'var(--font-mono)' }}>
{`Agent (Buyer)                         x402 Wrapper Proxy                     Upstream API
─────────────                         ──────────────────                     ────────────
GET /v1/resource ────────────────────► HTTP 402 + PAYMENT-REQUIRED
                                       (network, asset, amount, payTo)
Sign EIP-3009 Transfer Auth
GET /v1/resource
  PAYMENT-SIGNATURE: ... ────────────► Facilitator /verify ✓
                                       GET /resource ────────────────────────► 200 OK
                                       Facilitator /settle ✓ (on-chain tx)
◄───────────────────────────────────── 200 OK + PAYMENT-RESPONSE (tx hash)`}
          </pre>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: '0.75rem' }}>
          This diagram describes a possible live integration. The current playground uses a local mock and does not call the facilitator or move funds.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginTop: '1.25rem' }}>
          <div style={{ background: 'var(--bg-secondary)', padding: '0.9rem', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>TESTNET (eip155:2368)</div>
            <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>pieUSD Token</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>18 decimals, RPC: rpc-testnet.gokite.ai</div>
          </div>
          <div style={{ background: 'var(--bg-secondary)', padding: '0.9rem', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>MAINNET (eip155:2366)</div>
            <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#c084fc' }}>USDC.e Token</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>6 decimals, RPC: rpc.gokite.ai</div>
          </div>
          <div style={{ background: 'var(--bg-secondary)', padding: '0.9rem', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>SETTLEMENT FACILITATOR</div>
            <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--accent-emerald)' }}>Gasless Settle</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>https://facilitator.pieverse.io/v2</div>
          </div>
        </div>
      </div>

      {/* 4-Week Progress Tracker */}
      <h3 style={{ fontSize: '1.35rem', fontWeight: 700, marginBottom: '1.25rem' }}>
        Original Feature Milestones
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Week 1 */}
        <div className="glass-card" style={{ borderLeft: '4px solid var(--accent-cyan)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span className="badge badge-cyan">WEEK 1</span>
              <h4 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Foundation & Services Directory Showcase</h4>
            </div>
            <span style={{ fontSize: '0.8rem', color: 'var(--accent-emerald)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <CheckCircle size={14} /> Completed
            </span>
          </div>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
            Vite + React workspace, Ajv schema validator, YAML loader, multi-facet directory filtering & sorting, and deep parameter inspection drawer.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--accent-emerald)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <CheckCircle size={13} /> Day 1-7: Full Directory, Spec Drawer & Code Generator
            </span>
          </div>
        </div>

        {/* Week 2 */}
        <div className="glass-card" style={{ borderLeft: '4px solid var(--accent-purple)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span className="badge badge-purple">WEEK 2</span>
              <h4 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Interactive x402 Protocol Playground</h4>
            </div>
            <span style={{ fontSize: '0.8rem', color: 'var(--accent-emerald)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <CheckCircle size={14} /> Completed
            </span>
          </div>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
            Local 402 challenge inspection, simulated authorization, protocol audit trail, and failure demonstrations. The demo does not settle on chain.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--accent-emerald)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <CheckCircle size={13} /> Day 8-14: Local 3-Step Protocol Demonstration
            </span>
          </div>
        </div>

        {/* Week 3 */}
        <div className="glass-card" style={{ borderLeft: '4px solid var(--accent-emerald)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span className="badge badge-emerald">WEEK 3 (SPRINT 1)</span>
              <h4 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Health Probing Engine & Local Proof Logs</h4>
            </div>
            <span style={{ fontSize: '0.8rem', color: 'var(--accent-emerald)', fontWeight: 600 }}>Completed as local features</span>
          </div>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
            Live /healthz probing for configured demo services, latency indicators, local proof history, and receipt export that marks simulated results.
          </p>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            These features are local or read-only; exported receipts identify simulated results.
          </div>
        </div>

        {/* Week 4 */}
        <div className="glass-card" style={{ borderLeft: '4px solid var(--accent-amber)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span className="badge badge-amber">WEEK 4 (SPRINT 2)</span>
              <h4 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Manifest Builder, Testnet Diagnostics & Packaging</h4>
            </div>
            <span style={{ fontSize: '0.8rem', color: 'var(--accent-emerald)' }}>Completed as read-only diagnostics</span>
          </div>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
            Manifest builder, schema linting, PR-ready YAML export, read-only Kite testnet diagnostics, and production bundle packaging. No testnet payment is sent.
          </p>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            The diagnostic suite does not submit a payment or verify settlement.
          </div>
        </div>
      </div>
    </div>
  );
};
