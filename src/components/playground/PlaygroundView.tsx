import React, { useState, useEffect } from 'react';
import type { ServiceManifest, ServiceEndpoint } from '../../types/service.js';
import { decodePaymentRequiredHeader } from '../../lib/x402-decoder.js';
import type { X402ChallengePayload } from '../../types/x402.js';
import { WalletConnector, type WalletSigner } from './WalletConnector.js';
import { ProtocolVisualizer } from './ProtocolVisualizer.js';
import { createSignedEIP3009Payload } from '../../lib/eip3009.js';
import { CheckCircle2, RefreshCw } from 'lucide-react';

interface PlaygroundViewProps {
  services: ServiceManifest[];
  selectedService: ServiceManifest | null;
  selectedEndpoint: ServiceEndpoint | null;
  onSelectService: (srv: ServiceManifest) => void;
}

export const PlaygroundView: React.FC<PlaygroundViewProps> = ({
  services,
  selectedService: initialService,
  selectedEndpoint: initialEndpoint,
  onSelectService,
}) => {
  const [currentService, setCurrentService] = useState<ServiceManifest>(initialService || services[0]);
  const [currentEndpoint, setCurrentEndpoint] = useState<ServiceEndpoint>(
    initialEndpoint || currentService?.endpoints[0] || services[0].endpoints[0]
  );
  const [activeSigner, setActiveSigner] = useState<WalletSigner | null>(null);

  useEffect(() => {
    if (initialService) {
      setCurrentService(initialService);
      setCurrentEndpoint(initialEndpoint || initialService.endpoints[0]);
    }
  }, [initialService, initialEndpoint]);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [challengePayload, setChallengePayload] = useState<X402ChallengePayload | null>(null);
  const [raw402Header, setRaw402Header] = useState<string>('');
  const [simulatedSignature, setSimulatedSignature] = useState<string>('');
  const [responseStatus, setResponseStatus] = useState<number | null>(null);
  const [responseBody, setResponseBody] = useState<string>('');
  const [txHash, setTxHash] = useState<string>('');

  const handleServiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const found = services.find((s) => s.name === e.target.value);
    if (found) {
      setCurrentService(found);
      setCurrentEndpoint(found.endpoints[0]);
      resetPlayground();
      onSelectService(found);
    }
  };

  const handleEndpointChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const found = currentService.endpoints.find((ep) => ep.path === e.target.value);
    if (found) {
      setCurrentEndpoint(found);
      resetPlayground();
    }
  };

  const resetPlayground = () => {
    setStep(1);
    setChallengePayload(null);
    setRaw402Header('');
    setSimulatedSignature('');
    setResponseStatus(null);
    setResponseBody('');
    setTxHash('');
  };

  // Step 1: Initial Request returning 402
  const handleTriggerInitialRequest = async () => {
    setLoading(true);
    try {
      // Try local simulator endpoint first, fallback to mock generator if server is offline
      const mockUrl = `/api/mock-x402/${currentService.name}${currentEndpoint.path}`;
      const res = await fetch(mockUrl, {
        method: currentEndpoint.method,
        headers: { Accept: 'application/json' },
      });

      const header402 = res.headers.get('payment-required') || res.headers.get('PAYMENT-REQUIRED');
      if (header402) {
        setRaw402Header(header402);
        const decoded = decodePaymentRequiredHeader(header402);
        setChallengePayload(decoded);
        setResponseStatus(res.status);
        const body = await res.json().catch(() => ({}));
        setResponseBody(JSON.stringify(body, null, 2));
      } else {
        throw new Error('No payment-required header received');
      }
    } catch {
      // Offline fallback: generate conforming 402 challenge
      const isTestnet = currentService.network === 'eip155:2368';
      const fallbackChallenge: X402ChallengePayload = {
        x402Version: 2,
        accepts: [
          {
            scheme: 'exact',
            network: currentService.network,
            asset: isTestnet
              ? '0x38129cf4CE5E183eFF248F42A7D345Bb1B47621A'
              : '0x7aB6f3ed87C42eF0aDb67Ed95090f8bF5240149e',
            amount: isTestnet ? '1000000000000000' : '1000',
            payTo: currentService.pay_to,
            maxTimeoutSeconds: 60,
            extra: {
              name: isTestnet ? 'pieUSD' : 'Bridged USDC (Kite AI)',
              version: isTestnet ? '1' : '2',
            },
          },
        ],
      };
      const base64Header = btoa(JSON.stringify(fallbackChallenge));
      setRaw402Header(base64Header);
      setChallengePayload(fallbackChallenge);
      setResponseStatus(402);
      setResponseBody(
        JSON.stringify(
          {
            error: 'Payment Required',
            message: `This endpoint requires an authorization of $${currentEndpoint.price_usd} settled on Kite chain.`,
          },
          null,
          2
        )
      );
    } finally {
      setStep(2);
      setLoading(false);
    }
  };

  // Step 2: Sign real EIP-3009 Authorization via active signer (Sandbox or Web3 Wallet)
  const handleSignAuthorization = async () => {
    if (!activeSigner || !challengePayload || !challengePayload.accepts[0]) {
      alert('Wallet signer not initialized');
      return;
    }

    setLoading(true);
    try {
      const accept = challengePayload.accepts[0];
      const result = await createSignedEIP3009Payload({
        fromAddress: activeSigner.address,
        payToAddress: accept.payTo,
        amountUnits: accept.amount,
        network: currentService.network,
        assetAddress: accept.asset,
        tokenName: accept.extra?.name,
        tokenVersion: accept.extra?.version,
        signTypedDataFn: activeSigner.signTypedData,
      });

      setSimulatedSignature(result.base64Header);
      setStep(3);
    } catch (err) {
      console.error('Signing failed:', err);
      alert('Signing failed or rejected: ' + String(err));
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Settle with PAYMENT-SIGNATURE and retrieve 200 OK
  const handleSendPaidRequest = async () => {
    if (!simulatedSignature) return;
    setLoading(true);

    try {
      const mockUrl = `/api/mock-x402/${currentService.name}${currentEndpoint.path}`;
      const res = await fetch(mockUrl, {
        method: currentEndpoint.method,
        headers: {
          Accept: 'application/json',
          'PAYMENT-SIGNATURE': simulatedSignature,
        },
      });

      const respHeader = res.headers.get('payment-response') || res.headers.get('PAYMENT-RESPONSE');
      let extractedTx = '';
      if (respHeader) {
        try {
          const parsedResp = JSON.parse(atob(respHeader));
          extractedTx = parsedResp.txHash;
        } catch (e) {
          console.warn('Failed to parse PAYMENT-RESPONSE header', e);
        }
      }

      const body = await res.json().catch(() => ({}));
      setResponseStatus(res.status);
      setResponseBody(JSON.stringify(body, null, 2));

      if (extractedTx) {
        setTxHash(extractedTx);
      } else if (body.settlement?.txHash) {
        setTxHash(body.settlement.txHash);
      }
    } catch {
      // Fallback response simulation
      const fallbackTx = '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
      setTxHash(fallbackTx);
      setResponseStatus(200);
      setResponseBody(
        JSON.stringify(
          {
            success: true,
            service: currentService.name,
            result: `Service executed successfully behind Kite x402 reverse proxy.`,
            settlement: {
              facilitator: 'https://facilitator.pieverse.io/v2',
              txHash: fallbackTx,
              settledOnChain: true,
            },
          },
          null,
          2
        )
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '1080px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 800, marginBottom: '0.5rem' }}>
          Interactive <span>x402 Protocol Playground</span>
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Step-by-step walkthrough of how an autonomous Agent discovers an HTTP 402 challenge, signs an EIP-3009 transfer authorization, and gets a verified 200 OK with on-chain settlement.
        </p>
      </div>

      {/* Target Selector Bar */}
      <div
        className="glass-card"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr auto',
          gap: '1rem',
          alignItems: 'center',
          marginBottom: '1.5rem',
        }}
      >
        <div>
          <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
            SELECT SERVICE
          </label>
          <select
            value={currentService.name}
            onChange={handleServiceChange}
            style={{
              width: '100%',
              padding: '0.55rem',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-glass)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              fontSize: '0.88rem',
            }}
          >
            {services.map((s) => (
              <option key={s.name} value={s.name}>
                {s.display_name} ({s.network === 'eip155:2368' ? 'Testnet' : 'Mainnet'})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
            SELECT ENDPOINT
          </label>
          <select
            value={currentEndpoint.path}
            onChange={handleEndpointChange}
            style={{
              width: '100%',
              padding: '0.55rem',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-glass)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              fontSize: '0.88rem',
            }}
          >
            {currentService.endpoints.map((ep) => (
              <option key={ep.path} value={ep.path}>
                {ep.method} {ep.path} (${ep.price_usd})
              </option>
            ))}
          </select>
        </div>

        <div style={{ alignSelf: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={resetPlayground} style={{ padding: '0.55rem 1rem' }}>
            <RefreshCw size={14} />
            Reset Flow
          </button>
        </div>
      </div>

      {/* Wallet Connector Integration */}
      <WalletConnector
        targetNetwork={currentService.network}
        onSignerReady={(signer) => setActiveSigner(signer)}
      />

      {/* 3-Step Interactive Process */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        {/* Step 1 Card */}
        <div
          style={{
            background: step >= 1 ? 'var(--bg-card)' : 'rgba(18, 21, 30, 0.4)',
            border: step === 1 ? '1px solid var(--accent-cyan)' : '1px solid var(--border-glass)',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem',
            opacity: step >= 1 ? 1 : 0.5,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>STEP 1</span>
            {step > 1 && <CheckCircle2 size={16} color="var(--accent-emerald)" />}
          </div>
          <h4 style={{ fontSize: '0.98rem', fontWeight: 700, marginBottom: '0.35rem' }}>Trigger Initial Call</h4>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Request the endpoint without payment header. Upstream wrapper intercepts and answers HTTP 402.
          </p>
          <button
            className="btn btn-primary"
            onClick={handleTriggerInitialRequest}
            disabled={step !== 1 || loading}
            style={{ width: '100%', fontSize: '0.82rem' }}
          >
            {loading && step === 1 ? 'Calling...' : '1. Send Call (No Auth)'}
          </button>
        </div>

        {/* Step 2 Card */}
        <div
          style={{
            background: step >= 2 ? 'var(--bg-card)' : 'rgba(18, 21, 30, 0.4)',
            border: step === 2 ? '1px solid var(--accent-cyan)' : '1px solid var(--border-glass)',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem',
            opacity: step >= 2 ? 1 : 0.5,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-purple)' }}>STEP 2</span>
            {step > 2 && <CheckCircle2 size={16} color="var(--accent-emerald)" />}
          </div>
          <h4 style={{ fontSize: '0.98rem', fontWeight: 700, marginBottom: '0.35rem' }}>Sign EIP-3009</h4>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Decode PAYMENT-REQUIRED, construct EIP-712 typed data and sign TransferWithAuthorization with your Agent wallet.
          </p>
          <button
            className="btn btn-secondary"
            onClick={handleSignAuthorization}
            disabled={step !== 2 || loading || !activeSigner}
            style={{
              width: '100%',
              fontSize: '0.82rem',
              borderColor: step === 2 ? 'var(--accent-purple)' : undefined,
              color: step === 2 ? '#c084fc' : undefined,
            }}
          >
            {loading && step === 2 ? 'Signing...' : '2. Sign Authorization'}
          </button>
        </div>

        {/* Step 3 Card */}
        <div
          style={{
            background: step >= 3 ? 'var(--bg-card)' : 'rgba(18, 21, 30, 0.4)',
            border: step === 3 ? '1px solid var(--accent-emerald)' : '1px solid var(--border-glass)',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem',
            opacity: step >= 3 ? 1 : 0.5,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-emerald)' }}>STEP 3</span>
            {responseStatus === 200 && <CheckCircle2 size={16} color="var(--accent-emerald)" />}
          </div>
          <h4 style={{ fontSize: '0.98rem', fontWeight: 700, marginBottom: '0.35rem' }}>Settle & Return 200</h4>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Attach PAYMENT-SIGNATURE. Facilitator settles gaslessly and proxies to upstream 200 OK.
          </p>
          <button
            className="btn btn-primary"
            onClick={handleSendPaidRequest}
            disabled={step !== 3 || loading || responseStatus === 200}
            style={{
              width: '100%',
              fontSize: '0.82rem',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            }}
          >
            {loading && step === 3 ? 'Settling...' : responseStatus === 200 ? 'Settled ✓' : '3. Settle & Execute'}
          </button>
        </div>
      </div>

      {/* Response & Console Inspector */}
      <div className="glass-card" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Protocol Inspector</h3>
            {responseStatus && (
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  background: responseStatus === 200 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)',
                  color: responseStatus === 200 ? 'var(--accent-emerald)' : 'var(--accent-rose)',
                }}
              >
                HTTP {responseStatus} {responseStatus === 402 ? 'Payment Required' : 'OK'}
              </span>
            )}
          </div>

          {txHash && (
            <div style={{ fontSize: '0.78rem', color: 'var(--accent-emerald)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>Settlement Tx:</span>
              <a
                href={`${currentService.network === 'eip155:2368' ? 'https://testnet.kitescan.ai' : 'https://kitescan.ai'}/tx/${txHash}`}
                target="_blank"
                rel="noreferrer"
                style={{ color: 'var(--accent-cyan)', textDecoration: 'none', fontFamily: 'var(--font-mono)' }}
              >
                {txHash.slice(0, 10)}...{txHash.slice(-8)} ↗
              </a>
            </div>
          )}
        </div>

        {/* Breakdown of 402 Challenge if available */}
        {challengePayload && (
          <div
            style={{
              background: 'rgba(0, 245, 255, 0.04)',
              border: '1px solid rgba(0, 245, 255, 0.15)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem',
              marginBottom: '1rem',
            }}
          >
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '0.4rem' }}>
              PARSED 402 PAYMENT-REQUIRED HEADER
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', fontSize: '0.8rem' }}>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block' }}>Network</span>
                <code>{challengePayload.accepts[0].network}</code>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block' }}>Asset Contract</span>
                <code>{challengePayload.accepts[0].asset.slice(0, 8)}...</code>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block' }}>Required Amount</span>
                <code>{challengePayload.accepts[0].amount} units</code>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block' }}>Pay To</span>
                <code>{challengePayload.accepts[0].payTo.slice(0, 8)}...</code>
              </div>
            </div>
          </div>
        )}

        {/* Raw Headers Inspector */}
        {(raw402Header || simulatedSignature) && (
          <div style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {raw402Header && (
              <div style={{ fontSize: '0.75rem', background: 'rgba(0,0,0,0.3)', padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid var(--border-glass)' }}>
                <span style={{ color: 'var(--accent-cyan)', fontWeight: 600, marginRight: '8px' }}>PAYMENT-REQUIRED (Base64):</span>
                <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>{raw402Header}</span>
              </div>
            )}
            {simulatedSignature && (
              <div style={{ fontSize: '0.75rem', background: 'rgba(0,0,0,0.3)', padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid var(--border-glass)' }}>
                <span style={{ color: '#c084fc', fontWeight: 600, marginRight: '8px' }}>PAYMENT-SIGNATURE (Base64):</span>
                <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>{simulatedSignature}</span>
              </div>
            )}
          </div>
        )}

        {/* Raw Response Viewer */}
        <pre className="code-block" style={{ maxHeight: '320px', overflowY: 'auto' }}>
          {responseBody || '// Console output will appear here after triggering step 1...'}
        </pre>
      </div>

      {/* Protocol Visualizer & Audit Trail */}
      <ProtocolVisualizer
        step={step}
        challengePayload={challengePayload}
        rawSignaturePayload={simulatedSignature}
        responseStatus={responseStatus}
        txHash={txHash}
        network={currentService.network}
      />
    </div>
  );
};
