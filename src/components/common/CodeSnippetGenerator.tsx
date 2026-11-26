import React, { useEffect, useState } from 'react';
import type { ServiceManifest, ServiceEndpoint } from '../../types/service.js';
import { generateCurlSnippet } from '../../lib/curl-snippet.js';
import { Copy, Check, Terminal, FileCode, Bot } from 'lucide-react';
import { buildTsSnippet, buildPythonSnippet, buildGoSnippet, buildRustSnippet } from '../../lib/client-snippets.js';
import { buildAgentToolSnippet } from '../../lib/agent-tool-snippet.js';

interface CodeSnippetGeneratorProps {
  service: ServiceManifest;
  endpoint: ServiceEndpoint;
}

type LangTab = 'curl' | 'ts' | 'python' | 'go' | 'rust' | 'agent' | 'swarm' | 'channel';

export const CodeSnippetGenerator: React.FC<CodeSnippetGeneratorProps> = ({
  service,
  endpoint,
}) => {
  const [activeTab, setActiveTab] = useState<LangTab>('curl');
  const [copyResult, setCopyResult] = useState<{ text: string; status: 'pending' | 'copied' | 'failed' }>();

  useEffect(() => {
    if (copyResult?.status !== 'copied') return;
    const timeout = setTimeout(() => setCopyResult(undefined), 2000);
    return () => clearTimeout(timeout);
  }, [copyResult]);

  const isTestnet = service.network === 'eip155:2368';
  const chainId = isTestnet ? 2368 : 2366;

  const handleCopy = async (text: string) => {
    setCopyResult({ text, status: 'pending' });
    try {
      await navigator.clipboard.writeText(text);
      setCopyResult({ text, status: 'copied' });
    } catch {
      setCopyResult({ text, status: 'failed' });
    }
  };

  const getTsCode = () => {
    return buildTsSnippet(service, endpoint);
  };

  const getPythonCode = () => {
    return buildPythonSnippet(service, endpoint);
  };

  const getGoCode = () => {
    return buildGoSnippet(service, endpoint);
  };

  const getRustCode = () => {
    return buildRustSnippet(service, endpoint);
  };

  const getAgentToolCode = () => {
    return buildAgentToolSnippet(service, endpoint);
  };

  const getSwarmOrchestratorCode = () => {
    return `// Kite Agent Swarm Orchestrator DAG Node Definition
export interface SwarmAgentTask {
  taskId: string;
  targetEndpoint: ${JSON.stringify(endpoint.path)};
  serviceCostUsd: "${endpoint.price_usd}";
  upstreamNetwork: "${service.network}";
  dependencies: string[];
}

export const swarm${service.name.replace(/[^a-zA-Z0-9]/g, '')}Step: SwarmAgentTask = {
  taskId: "task_${service.name.replace(/-/g, '_')}_exec",
  targetEndpoint: ${JSON.stringify(endpoint.path)},
  serviceCostUsd: "${endpoint.price_usd}",
  upstreamNetwork: "${service.network}",
  dependencies: ["step_research_synthesis"],
};

// Swarm Bounty Split Matrix (100% total)
export const swarmBountyMatrix = [
  { role: "coordinator", bps: 4000 }, // 40%
  { role: "executor", bps: 4000 },    // 40%
  { role: "sentinel_verifier", bps: 2000 } // 20%
];`;
  };

  const getStreamChannelCode = () => {
    return `// Kite Stream Channel Micropayment Ticket (EIP-155: ${chainId})
import { openStreamChannel, allocateStreamTicket } from './stream-channel-router';

// 1. Open off-chain micro-channel with recipient
const channel = openStreamChannel(
  "chan_${service.name.replace(/-/g, '_')}_01",
  "0xYourPayerAddressHere",
  "${service.pay_to}",
  1000000000000000000n // 1.0 capacity
);

// 2. Allocate micro-ticket per streaming chunk
const chunkCost = 1000000000000000n; // 0.001 token
const { channel: updatedChan, ticket } = allocateStreamTicket(channel, chunkCost);

console.log(\`Issued ticket nonce \${ticket.sequenceNonce}, cumulative: \${ticket.cumulativeWei} wei\`);
// Transmit the ticket for stream verification according to the service protocol.`;
  };

  const getActiveCode = () => {
    switch (activeTab) {
      case 'curl':
        return generateCurlSnippet(service, endpoint);
      case 'ts':
        return getTsCode();
      case 'python':
        return getPythonCode();
      case 'go':
        return getGoCode();
      case 'rust':
        return getRustCode();
      case 'agent':
        return getAgentToolCode();
      case 'swarm':
        return getSwarmOrchestratorCode();
      case 'channel':
        return getStreamChannelCode();
    }
  };

  const activeCode = getActiveCode();
  const copyStatus = copyResult?.text === activeCode ? copyResult.status : 'idle';

  return (
    <div style={{ marginTop: '1rem' }}>
      {/* Tab Switcher */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <div style={{ display: 'flex', gap: '0.35rem' }}>
          <button
            onClick={() => setActiveTab('curl')}
            style={{
              padding: '3px 10px',
              fontSize: '0.75rem',
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'curl' ? 'var(--bg-tertiary)' : 'transparent',
              color: activeTab === 'curl' ? 'var(--accent-cyan)' : 'var(--text-muted)',
              fontWeight: activeTab === 'curl' ? 600 : 400,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Terminal size={12} /> cURL
          </button>
          <button
            onClick={() => setActiveTab('ts')}
            style={{
              padding: '3px 10px',
              fontSize: '0.75rem',
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'ts' ? 'var(--bg-tertiary)' : 'transparent',
              color: activeTab === 'ts' ? 'var(--accent-cyan)' : 'var(--text-muted)',
              fontWeight: activeTab === 'ts' ? 600 : 400,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <FileCode size={12} /> TypeScript
          </button>
          <button
            onClick={() => setActiveTab('python')}
            style={{
              padding: '3px 10px',
              fontSize: '0.75rem',
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'python' ? 'var(--bg-tertiary)' : 'transparent',
              color: activeTab === 'python' ? 'var(--accent-cyan)' : 'var(--text-muted)',
              fontWeight: activeTab === 'python' ? 600 : 400,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <FileCode size={12} /> Python
          </button>
          <button
            onClick={() => setActiveTab('go')}
            style={{
              padding: '3px 10px',
              fontSize: '0.75rem',
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'go' ? 'var(--bg-tertiary)' : 'transparent',
              color: activeTab === 'go' ? 'var(--accent-cyan)' : 'var(--text-muted)',
              fontWeight: activeTab === 'go' ? 600 : 400,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <FileCode size={12} /> Go
          </button>
          <button
            onClick={() => setActiveTab('rust')}
            style={{
              padding: '3px 10px',
              fontSize: '0.75rem',
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'rust' ? 'var(--bg-tertiary)' : 'transparent',
              color: activeTab === 'rust' ? 'var(--accent-cyan)' : 'var(--text-muted)',
              fontWeight: activeTab === 'rust' ? 600 : 400,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <FileCode size={12} /> Rust
          </button>
          <button
            onClick={() => setActiveTab('agent')}
            style={{
              padding: '3px 10px',
              fontSize: '0.75rem',
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'agent' ? 'rgba(121, 40, 202, 0.2)' : 'transparent',
              color: activeTab === 'agent' ? '#c084fc' : 'var(--text-muted)',
              fontWeight: activeTab === 'agent' ? 600 : 400,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Bot size={12} /> Agent Tool
          </button>
          <button
            onClick={() => setActiveTab('swarm')}
            style={{
              padding: '3px 10px',
              fontSize: '0.75rem',
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'swarm' ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
              color: activeTab === 'swarm' ? 'var(--accent-emerald)' : 'var(--text-muted)',
              fontWeight: activeTab === 'swarm' ? 600 : 400,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Bot size={12} /> Swarm DAG
          </button>
          <button
            onClick={() => setActiveTab('channel')}
            style={{
              padding: '3px 10px',
              fontSize: '0.75rem',
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'channel' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
              color: activeTab === 'channel' ? '#60a5fa' : 'var(--text-muted)',
              fontWeight: activeTab === 'channel' ? 600 : 400,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Bot size={12} /> State Channel
          </button>
        </div>

        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          Kite {isTestnet ? 'Testnet (pieUSD)' : 'Mainnet (USDC.e)'}
        </span>
      </div>

      {/* Code Area */}
      {activeTab === 'curl' && (
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          cURL examples use Bash / POSIX shell syntax.
        </p>
      )}
      <div style={{ position: 'relative' }}>
        <pre className="code-block" style={{ margin: 0, fontSize: '0.78rem', maxHeight: '280px', overflowY: 'auto' }}>
          {activeCode}
        </pre>
        <button
          onClick={() => handleCopy(activeCode)}
          disabled={copyResult?.status === 'pending'}
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-glass)',
            color: 'var(--text-secondary)',
            borderRadius: '4px',
            padding: '5px 8px',
            cursor: 'pointer',
            fontSize: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
          title="Copy snippet"
        >
          {copyStatus === 'copied'
            ? <Check size={13} color="var(--accent-emerald)" />
            : <Copy size={13} />}
          <span aria-live="polite" style={{ color: copyStatus === 'copied' ? 'var(--accent-emerald)' : undefined }}>
            {copyStatus === 'copied' ? 'Copied'
              : copyStatus === 'failed' ? 'Copy failed'
              : copyStatus === 'pending' ? 'Copying…'
              : 'Copy'}
          </span>
        </button>
      </div>
    </div>
  );
};
