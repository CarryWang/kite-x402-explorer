import React, { useState } from 'react';
import {
  Zap,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Terminal,
  Download,
} from 'lucide-react';
import {checkRpc,checkDomain,checkFacilitator,checkOfflineSignature,checkZeroDeduction,type CheckEvidence} from '../../services/testnet-checks.js';
import { KITE_TESTNET } from '../../types/kite.js';

export type E2ETestStatus = 'idle' | 'running' | 'passed' | 'failed' | 'blocked';

export interface E2ETestCase {
  id: string;
  name: string;
  description: string;
  status: E2ETestStatus;
  scope?: CheckEvidence['scope'];
  durationMs?: number;
  output?: string;
  error?: string;
}

const INITIAL_TESTS: E2ETestCase[] = [
  {
    id: 'rpc-connectivity',
    name: '1. Kite Testnet RPC Connectivity & Chain ID Verification',
    description: 'Queries https://rpc-testnet.gokite.ai via eth_chainId & eth_blockNumber to verify chain ID 2368.',
    status: 'idle',
  },
  {
    id: 'pieusd-domain-hash',
    name: '2. pieUSD EIP-712 Domain Separator Integrity',
    description: 'Compares the configured pieUSD domain with the on-chain DOMAIN_SEPARATOR on Kite testnet.',
    status: 'idle',
  },
  {
    id: 'facilitator-ping',
    name: '3. Facilitator v2 Settlement Engine Reachability',
    description: 'Validates facilitator endpoint https://facilitator.pieverse.io/v2 response latency and status.',
    status: 'idle',
  },
  {
    id: 'eip3009-settlement',
    name: '4. EIP-3009 TransferWithAuthorization Signature Roundtrip',
    description: 'Signs and recovers an ephemeral EIP-3009 authorization locally. No transaction is submitted.',
    status: 'idle',
  },
  {
    id: 'zero-deduction-guard',
    name: '5. Payment Failure Evidence (Requires Seller Integration)',
    description: 'Requires an instrumented seller and balance evidence; reported as blocked until that integration exists.',
    status: 'idle',
  },
];

export const TestnetE2ESuite: React.FC = () => {
  const [tests, setTests] = useState<E2ETestCase[]>(INITIAL_TESTS);
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [logs, setLogs] = useState<string[]>([
    `[${new Date().toLocaleTimeString()}] Kite Testnet E2E Suite initialized. Ready for execution.`,
  ]);

  const addLog = (msg: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const updateTest = (id: string, update: Partial<E2ETestCase>) => {
    setTests((prev) => prev.map((t) => (t.id === id ? { ...t, ...update } : t)));
  };

  const runCheck = async (id:string, check:() => CheckEvidence | Promise<CheckEvidence>): Promise<boolean> => {
    updateTest(id,{status:'running',error:undefined,output:undefined,scope:undefined});
    const start = performance.now();
    try {
      const evidence = await check();
      updateTest(id,{...evidence,durationMs:Math.round(performance.now()-start)});
      addLog(evidence.status.toUpperCase() + ' [' + evidence.scope + '] ' + evidence.output);
      return evidence.status === 'passed';
    } catch(error) {
      updateTest(id,{status:'failed',error:String(error),durationMs:Math.round(performance.now()-start)});
      addLog('FAILED: ' + String(error));
      return false;
    }
  };
  const runRpcTest = () => runCheck('rpc-connectivity',checkRpc);
  const runDomainHashTest = () => runCheck('pieusd-domain-hash',checkDomain);
  const runFacilitatorTest = () => runCheck('facilitator-ping',checkFacilitator);
  const runEip3009Test = () => runCheck('eip3009-settlement',checkOfflineSignature);
  const runZeroDeductionTest = () => runCheck('zero-deduction-guard',checkZeroDeduction);

  const handleRunAll = async () => {
    setIsRunningAll(true);
    addLog('=== Starting Comprehensive Kite Testnet E2E Suite ===');

    await runRpcTest();
    await new Promise((r) => setTimeout(r, 200));

    await runDomainHashTest();
    await new Promise((r) => setTimeout(r, 200));

    await runFacilitatorTest();
    await new Promise((r) => setTimeout(r, 200));

    await runEip3009Test();
    await new Promise((r) => setTimeout(r, 200));

    await runZeroDeductionTest();

    addLog('=== Kite Testnet E2E Suite Completed ===');
    setIsRunningAll(false);
  };

  const handleDownloadReport = () => {
    const report = {
      title: 'Kite Testnet Diagnostic Evidence Report',
      timestamp: new Date().toISOString(),
      network: KITE_TESTNET,
      settlementVerified: false,
      results: tests,
      logs,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kite-testnet-e2e-report-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const passedCount = tests.filter((t) => t.status === 'passed').length;

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '2rem',
        }}
      >
        <div>
          <div className="hero-tag" style={{ display: 'inline-flex', marginBottom: '0.5rem' }}>
            <Zap size={13} style={{ marginRight: '6px' }} />
            Network and Offline Diagnostics
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 800 }}>
            Kite Testnet <span>Diagnostic Suite</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', maxWidth: '640px' }}>
            Read-only network checks and an offline signature roundtrip. This suite does not submit payments or verify settlement; unavailable evidence remains failed or blocked.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button
            className="btn btn-secondary"
            onClick={handleDownloadReport}
            style={{ fontSize: '0.82rem', padding: '0.55rem 0.9rem' }}
          >
            <Download size={14} /> Download Report
          </button>
          <button
            className="btn btn-primary"
            onClick={handleRunAll}
            disabled={isRunningAll}
            style={{ fontSize: '0.82rem', padding: '0.55rem 1.1rem' }}
          >
            <RefreshCw
              size={14}
              style={{ animation: isRunningAll ? 'spin 1s linear infinite' : 'none' }}
            />
            <span>{isRunningAll ? 'Running E2E Suite...' : 'Run All E2E Tests'}</span>
          </button>
        </div>
      </div>

      {/* Network Specs Bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-glass)',
          borderRadius: 'var(--radius-md)',
          padding: '1rem 1.25rem',
          marginBottom: '1.5rem',
        }}
      >
        <div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>NETWORK & CHAIN ID</div>
          <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
            Kite Testnet (2368)
          </div>
        </div>

        <div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>PAYMENT ASSET</div>
          <div style={{ fontSize: '0.88rem', fontWeight: 700 }}>
            pieUSD (18 Decimals)
          </div>
        </div>

        <div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>ASSET CONTRACT</div>
          <div style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)', color: 'var(--text-code)' }}>
            0x3812...621A
          </div>
        </div>

        <div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>FAUCET & EXPLORER</div>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '2px', fontSize: '0.78rem' }}>
            <a
              href="https://faucet.gokite.ai"
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--accent-cyan)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '2px' }}
            >
              Faucet <ExternalLink size={11} />
            </a>
            <a
              href="https://testnet.kitescan.ai"
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--accent-cyan)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '2px' }}
            >
              KiteScan <ExternalLink size={11} />
            </a>
          </div>
        </div>
      </div>

      {/* Main Grid: Test Cases on Left, Console on Right */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.2fr 0.8fr',
          gap: '1.5rem',
          alignItems: 'start',
        }}
      >
        {/* Test Cases List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.5rem 0',
            }}
          >
            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Test Scenarios ({tests.length})</h3>
            <span
              style={{
                fontSize: '0.75rem',
                padding: '2px 8px',
                borderRadius: '12px',
                background: passedCount === tests.length ? 'rgba(16, 185, 129, 0.2)' : 'rgba(0, 245, 255, 0.15)',
                color: passedCount === tests.length ? 'var(--accent-emerald)' : 'var(--accent-cyan)',
                fontWeight: 700,
              }}
            >
              {passedCount}/{tests.length} Passed
            </span>
          </div>

          {tests.map((test) => {
            const isPassed = test.status === 'passed';
            const isRunning = test.status === 'running';
            const isFailed = test.status === 'failed';

            return (
              <div
                key={test.id}
                className="glass-card"
                style={{
                  padding: '1.25rem',
                  border: isPassed
                    ? '1px solid rgba(16, 185, 129, 0.3)'
                    : isFailed
                    ? '1px solid rgba(244, 63, 94, 0.3)'
                    : '1px solid var(--border-glass)',
                  background: isPassed ? 'rgba(16, 185, 129, 0.03)' : undefined,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {isPassed && <CheckCircle2 size={18} color="var(--accent-emerald)" />}
                    {test.status === 'blocked' && <AlertTriangle size={18} color="var(--accent-cyan)" />}
                    {isFailed && <AlertTriangle size={18} color="var(--accent-rose)" />}
                    {isRunning && <RefreshCw size={18} color="var(--accent-cyan)" style={{ animation: 'spin 1s linear infinite' }} />}
                    {test.status === 'idle' && (
                      <span
                        style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          border: '2px solid var(--border-glass)',
                          display: 'inline-block',
                        }}
                      />
                    )}

                    <strong style={{ fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                      {test.name} — {test.status}{test.scope ? ` (${test.scope})` : ''}
                    </strong>
                  </div>

                  {test.durationMs && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {test.durationMs}ms
                    </span>
                  )}
                </div>

                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '0.75rem' }}>
                  {test.description}
                </p>

                {test.output && (
                  <div
                    style={{
                      background: '#07090e',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.5rem 0.75rem',
                      fontSize: '0.75rem',
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--accent-emerald)',
                      border: '1px solid rgba(16, 185, 129, 0.2)',
                    }}
                  >
                    {test.output}
                  </div>
                )}

                {test.error && (
                  <div
                    style={{
                      background: 'rgba(244, 63, 94, 0.1)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.5rem 0.75rem',
                      fontSize: '0.75rem',
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--accent-rose)',
                      border: '1px solid rgba(244, 63, 94, 0.3)',
                    }}
                  >
                    Error: {test.error}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Live Logs Terminal */}
        <div style={{ position: 'sticky', top: '5rem', display: 'flex', flexDirection: 'column' }}>
          <div
            className="glass-card"
            style={{
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              background: '#07090e',
              border: '1px solid var(--border-glass)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Terminal size={15} color="var(--accent-cyan)" />
                <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>Execution Logs</span>
              </div>
              <button
                onClick={() => setLogs([`[${new Date().toLocaleTimeString()}] Logs cleared.`])}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '0.72rem',
                  cursor: 'pointer',
                }}
              >
                Clear
              </button>
            </div>

            <div
              style={{
                height: '420px',
                overflowY: 'auto',
                fontSize: '0.72rem',
                fontFamily: 'var(--font-mono)',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                lineHeight: 1.4,
              }}
            >
              {logs.map((log, idx) => (
                <div
                  key={idx}
                  style={{
                    color: log.includes('✓')
                      ? 'var(--accent-emerald)'
                      : log.includes('✗')
                      ? 'var(--accent-rose)'
                      : log.includes('===')
                      ? 'var(--accent-cyan)'
                      : 'var(--text-secondary)',
                  }}
                >
                  {log}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
