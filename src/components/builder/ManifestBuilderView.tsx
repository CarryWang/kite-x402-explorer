import React, { useState, useMemo } from 'react';
import type {
  ServiceManifest,
  ServiceCategory,
  ServiceStatus,
  HttpMethod,
  ServiceEndpoint,
} from '../../types/service.js';
import { validateServiceManifest } from '../../services/schema-validator.js';
import { dumpManifestToYaml } from '../../services/manifest-loader.js';
import { PRSubmissionModal } from './PRSubmissionModal.js';
import {
  FileCode,
  Download,
  Copy,
  Check,
  Plus,
  Trash2,
  Sparkles,
  GitPullRequest,
  CheckCircle2,
  AlertTriangle,
  Play,
  Layers,
} from 'lucide-react';

interface ManifestBuilderViewProps {
  onTestInPlayground: (manifest: ServiceManifest) => void;
  onAddToDirectory?: (manifest: ServiceManifest) => void;
}

const ALL_CATEGORIES: { id: ServiceCategory; label: string }[] = [
  { id: 'ai', label: 'AI & ML' },
  { id: 'data', label: 'Data & Analytics' },
  { id: 'finance', label: 'DeFi & Finance' },
  { id: 'search', label: 'Search & Scrape' },
  { id: 'weather', label: 'Weather & Climate' },
  { id: 'web', label: 'Web Services' },
  { id: 'geo', label: 'Geolocation' },
  { id: 'messaging', label: 'Messaging' },
  { id: 'media', label: 'Media' },
  { id: 'shopping', label: 'Shopping' },
  { id: 'other', label: 'Other' },
];

const TEMPLATES: Record<string, { label: string; data: ServiceManifest }> = {
  ai: {
    label: 'AI Reasoning & LLM Agent',
    data: {
      schema: 1,
      name: 'agent-reasoning-engine',
      display_name: 'Autonomous Reasoning & Decision Engine',
      description: 'High-throughput LLM reasoning microservice designed for multi-agent consensus and structured tool execution.',
      maintainer: {
        github: 'agent-matrix',
        contact: 'dev@agentmatrix.xyz',
      },
      status: 'testnet',
      base_url: 'https://reasoning.sandbox.gokite.ai',
      network: 'eip155:2368',
      pay_to: '0x1111111111111111111111111111111111111111',
      upstream: {
        name: 'DeepSeek & Anthropic Inference Gateway',
        url: 'https://api.inference.internal',
        requires_api_key: true,
      },
      categories: ['ai', 'data'],
      tags: ['llm', 'reasoning', 'agent-tool', 'inference'],
      source: 'typescript-express',
      endpoints: [
        {
          method: 'POST',
          path: '/v1/agent/solve',
          summary: 'Submit a complex multi-step reasoning problem and receive verified execution tree.',
          price_usd: '0.005',
          example_request: {
            body: {
              task: 'Analyze arbitrage opportunities between DEX pools and bridge liquidity.',
              max_depth: 3,
            },
          },
          pitfalls: ['Ensure task description is under 4000 characters.'],
        },
      ],
    },
  },
  finance: {
    label: 'DeFi Liquidity & Risk Oracle',
    data: {
      schema: 1,
      name: 'kite-liquidity-oracle',
      display_name: 'Real-Time DEX Liquidity & Slippage Oracle',
      description: 'Sub-second pool depth, swap impact simulation, and impermanent loss risk metrics across EVM decentralized exchanges.',
      maintainer: {
        github: 'defi-sentinel',
        contact: 'oracle@defisentinel.io',
      },
      status: 'live',
      base_url: 'https://oracle.gokite.ai',
      network: 'eip155:2366',
      pay_to: '0x7aB6f3ed87C42eF0aDb67Ed95090f8bF5240149e',
      upstream: {
        name: 'Sentinel Liquidity Graph Node',
        url: 'https://api.liquidity-node.internal',
        requires_api_key: false,
      },
      categories: ['finance', 'data'],
      tags: ['defi', 'oracle', 'dex', 'slippage'],
      source: 'go-gin',
      endpoints: [
        {
          method: 'GET',
          path: '/v1/pool/depth',
          summary: 'Query instantaneous liquidity orderbook depth and price impact for targeted token pairs.',
          price_usd: '0.002',
          example_request: {
            query: {
              tokenA: '0x7aB6f3ed87C42eF0aDb67Ed95090f8bF5240149e',
              tokenB: '0x0000000000000000000000000000000000000000',
              amountUsd: '50000',
            },
          },
        },
      ],
    },
  },
  blank: {
    label: 'Blank Clean Manifest',
    data: {
      schema: 1,
      name: 'my-custom-service',
      display_name: 'My Custom x402 Service',
      description: 'A dedicated micropayment-enabled HTTP service running on the Kite blockchain with x402 headers.',
      maintainer: {
        github: 'my-github-username',
      },
      status: 'draft',
      network: 'eip155:2368',
      pay_to: '0x0000000000000000000000000000000000000000',
      upstream: {
        name: 'My Upstream API',
        url: 'https://api.example.com',
      },
      categories: ['web'],
      tags: ['api', 'x402'],
      endpoints: [
        {
          method: 'GET',
          path: '/v1/resource',
          summary: 'Retrieve authenticated paid resource response settled via Kite blockchain micropayments.',
          price_usd: '0.001',
        },
      ],
    },
  },
};

export const ManifestBuilderView: React.FC<ManifestBuilderViewProps> = ({
  onTestInPlayground,
  onAddToDirectory,
}) => {
  const [formData, setFormData] = useState<ServiceManifest>(TEMPLATES.ai.data);
  const [copiedYaml, setCopiedYaml] = useState(false);
  const [isPrModalOpen, setIsPrModalOpen] = useState(false);

  // Convert current form data to YAML
  const yamlContent = useMemo(() => {
    try {
      return dumpManifestToYaml(formData);
    } catch {
      return '// YAML serialization error';
    }
  }, [formData]);

  // Live schema validation
  const validationResult = useMemo(() => {
    return validateServiceManifest(formData);
  }, [formData]);

  const handleApplyTemplate = (key: string) => {
    if (TEMPLATES[key]) {
      setFormData(JSON.parse(JSON.stringify(TEMPLATES[key].data)));
    }
  };

  const handleCopyYaml = async () => {
    await navigator.clipboard.writeText(yamlContent);
    setCopiedYaml(true);
    setTimeout(() => setCopiedYaml(false), 2000);
  };

  const handleDownloadYaml = () => {
    const blob = new Blob([yamlContent], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'service.yaml';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Endpoint helpers
  const handleAddEndpoint = () => {
    const newEp: ServiceEndpoint = {
      method: 'GET',
      path: `/v1/endpoint-${formData.endpoints.length + 1}`,
      summary: 'Endpoint summary describing operation output and expected behavior.',
      price_usd: '0.001',
    };
    setFormData((prev) => ({
      ...prev,
      endpoints: [...prev.endpoints, newEp],
    }));
  };

  const handleRemoveEndpoint = (index: number) => {
    if (formData.endpoints.length <= 1) return;
    setFormData((prev) => ({
      ...prev,
      endpoints: prev.endpoints.filter((_, i) => i !== index),
    }));
  };

  const handleUpdateEndpoint = (
    index: number,
    field: keyof ServiceEndpoint,
    value: string | HttpMethod
  ) => {
    setFormData((prev) => {
      const updated = [...prev.endpoints];
      updated[index] = {
        ...updated[index],
        [field]: value,
      };
      return { ...prev, endpoints: updated };
    });
  };

  const handleToggleCategory = (cat: ServiceCategory) => {
    setFormData((prev) => {
      const exists = prev.categories.includes(cat);
      if (exists) {
        if (prev.categories.length <= 1) return prev; // min 1
        return { ...prev, categories: prev.categories.filter((c) => c !== cat) };
      } else {
        if (prev.categories.length >= 3) return prev; // max 3
        return { ...prev, categories: [...prev.categories, cat] };
      }
    });
  };

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
            <FileCode size={13} style={{ marginRight: '6px' }} />
            Kite x402 Registry Tooling
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 800 }}>
            Service Manifest <span>Visual Builder</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', maxWidth: '640px' }}>
            Build, lint, and validate production-ready <code>service.yaml</code> manifests conforming to the official Kite Schema. Export directly to GitHub Pull Requests or test immediately in the interactive playground.
          </p>
        </div>

        {/* Template Selector */}
        <div
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-glass)',
            borderRadius: 'var(--radius-md)',
            padding: '0.6rem 0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
          }}
        >
          <Sparkles size={15} color="var(--accent-cyan)" />
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>PRESETS:</span>
          {Object.entries(TEMPLATES).map(([key, tpl]) => (
            <button
              key={key}
              onClick={() => handleApplyTemplate(key)}
              style={{
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-glass)',
                color: 'var(--text-primary)',
                padding: '4px 10px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.75rem',
                cursor: 'pointer',
              }}
            >
              {tpl.label.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))',
          gap: '1.5rem',
          alignItems: 'start',
        }}
      >
        {/* Left Column: Interactive Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Card 1: Core Identifiers */}
          <div className="glass-card" style={{ padding: '1.25rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Layers size={16} color="var(--accent-cyan)" />
              1. Identity & Metadata
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem', fontWeight: 600 }}>
                  SERVICE SLUG (DIRECTORY NAME) *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      name: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''),
                    })
                  }
                  placeholder="e.g. agent-weather-engine"
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-glass)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.82rem',
                  }}
                />
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  Pattern: ^[a-z0-9][a-z0-9-]{'{1,63}'}$
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem', fontWeight: 600 }}>
                  DISPLAY NAME *
                </label>
                <input
                  type="text"
                  value={formData.display_name}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                  placeholder="e.g. Agent Weather Engine"
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-glass)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    fontSize: '0.82rem',
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  DESCRIPTION * (20 - 500 characters)
                </label>
                <span
                  style={{
                    fontSize: '0.7rem',
                    color: formData.description.length < 20 || formData.description.length > 500 ? 'var(--accent-rose)' : 'var(--text-muted)',
                  }}
                >
                  {formData.description.length}/500 chars
                </span>
              </div>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="High-resolution, real-time data or LLM agent tool tailored for autonomous agents..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-glass)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  fontSize: '0.82rem',
                  resize: 'vertical',
                }}
              />
            </div>

            {/* Categories */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: 600 }}>
                CATEGORIES * (Select 1 to 3)
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {ALL_CATEGORIES.map((cat) => {
                  const selected = formData.categories.includes(cat.id);
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => handleToggleCategory(cat.id)}
                      style={{
                        padding: '3px 8px',
                        borderRadius: 'var(--radius-xl)',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        border: selected ? '1px solid var(--accent-cyan)' : '1px solid var(--border-glass)',
                        background: selected ? 'rgba(0, 245, 255, 0.15)' : 'var(--bg-secondary)',
                        color: selected ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                      }}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Card 2: Network & Settlement Economics */}
          <div className="glass-card" style={{ padding: '1.25rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={16} color="var(--accent-emerald)" />
              2. Blockchain Network & Pay-To Wallet
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem', fontWeight: 600 }}>
                  STATUS
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as ServiceStatus })}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-glass)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    fontSize: '0.82rem',
                  }}
                >
                  <option value="testnet">testnet (Kite Testnet eip155:2368)</option>
                  <option value="live">live (Kite Mainnet eip155:2366)</option>
                  <option value="draft">draft</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem', fontWeight: 600 }}>
                  TARGET NETWORK
                </label>
                <select
                  value={formData.network}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      network: e.target.value as 'eip155:2366' | 'eip155:2368',
                    })
                  }
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-glass)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    fontSize: '0.82rem',
                  }}
                >
                  <option value="eip155:2368">eip155:2368 (Kite Testnet - pieUSD)</option>
                  <option value="eip155:2366">eip155:2366 (Kite Mainnet - USDC.e)</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem', fontWeight: 600 }}>
                PAY-TO ADDRESS * (EVM Address receiving micropayments)
              </label>
              <input
                type="text"
                value={formData.pay_to}
                onChange={(e) => setFormData({ ...formData, pay_to: e.target.value as `0x${string}` })}
                placeholder="0x..."
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-glass)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-code)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.82rem',
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem', fontWeight: 600 }}>
                  MAINTAINER GITHUB USERNAME *
                </label>
                <input
                  type="text"
                  value={formData.maintainer.github}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      maintainer: { ...formData.maintainer, github: e.target.value },
                    })
                  }
                  placeholder="gokite-ai"
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-glass)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    fontSize: '0.82rem',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem', fontWeight: 600 }}>
                  UPSTREAM API URL * (https://...)
                </label>
                <input
                  type="text"
                  value={formData.upstream.url}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      upstream: { ...formData.upstream, url: e.target.value },
                    })
                  }
                  placeholder="https://api.example.com"
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-glass)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    fontSize: '0.82rem',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Card 3: Endpoints Definition */}
          <div className="glass-card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileCode size={16} color="var(--accent-purple)" />
                3. Endpoints ({formData.endpoints.length})
              </h3>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleAddEndpoint}
                style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
              >
                <Plus size={13} /> Add Endpoint
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {formData.endpoints.map((ep, idx) => (
                <div
                  key={idx}
                  style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-glass)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.85rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <select
                        value={ep.method}
                        onChange={(e) => handleUpdateEndpoint(idx, 'method', e.target.value as HttpMethod)}
                        style={{
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border-glass)',
                          color: ep.method === 'GET' ? 'var(--accent-emerald)' : 'var(--accent-amber)',
                          fontWeight: 700,
                          fontSize: '0.78rem',
                          borderRadius: 'var(--radius-sm)',
                          padding: '2px 6px',
                        }}
                      >
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                        <option value="PUT">PUT</option>
                        <option value="PATCH">PATCH</option>
                        <option value="DELETE">DELETE</option>
                      </select>

                      <input
                        type="text"
                        value={ep.path}
                        onChange={(e) => handleUpdateEndpoint(idx, 'path', e.target.value)}
                        placeholder="/v1/resource"
                        style={{
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border-glass)',
                          color: 'var(--text-code)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.82rem',
                          borderRadius: 'var(--radius-sm)',
                          padding: '2px 8px',
                          width: '220px',
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Price USD:</span>
                        <input
                          type="text"
                          value={ep.price_usd}
                          onChange={(e) => handleUpdateEndpoint(idx, 'price_usd', e.target.value)}
                          placeholder="0.001"
                          style={{
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-glass)',
                            color: 'var(--accent-cyan)',
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.78rem',
                            borderRadius: 'var(--radius-sm)',
                            padding: '2px 6px',
                            width: '70px',
                          }}
                        />
                      </div>

                      {formData.endpoints.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveEndpoint(idx)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--accent-rose)',
                            cursor: 'pointer',
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <input
                      type="text"
                      value={ep.summary}
                      onChange={(e) => handleUpdateEndpoint(idx, 'summary', e.target.value)}
                      placeholder="Summary describing what this endpoint returns (10-200 chars)..."
                      style={{
                        width: '100%',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-glass)',
                        color: 'var(--text-primary)',
                        fontSize: '0.78rem',
                        borderRadius: 'var(--radius-sm)',
                        padding: '4px 8px',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Live YAML Preview & Actions */}
        <div style={{ position: 'sticky', top: '5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Validation Status Card */}
          <div
            style={{
              background: validationResult.valid ? 'rgba(16, 185, 129, 0.08)' : 'rgba(244, 63, 94, 0.08)',
              border: validationResult.valid ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(244, 63, 94, 0.3)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {validationResult.valid ? (
                  <CheckCircle2 size={18} color="var(--accent-emerald)" />
                ) : (
                  <AlertTriangle size={18} color="var(--accent-rose)" />
                )}
                <strong style={{ fontSize: '0.9rem', color: validationResult.valid ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
                  {validationResult.valid ? 'Schema Valid (PR Ready)' : 'Validation Discrepancies'}
                </strong>
              </div>

              <span className={`badge ${validationResult.valid ? 'badge-emerald' : 'badge-rose'}`}>
                {validationResult.valid ? 'service.schema.json ✓' : `${validationResult.errors.length} Issue(s)`}
              </span>
            </div>

            {!validationResult.valid && (
              <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {validationResult.errors.map((err, i) => (
                  <div
                    key={i}
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary)',
                      fontFamily: 'var(--font-mono)',
                      background: 'rgba(0,0,0,0.2)',
                      padding: '3px 8px',
                      borderRadius: '4px',
                    }}
                  >
                    <span style={{ color: 'var(--accent-rose)', marginRight: '6px' }}>{err.path || 'root'}:</span>
                    <span>{err.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* YAML Viewer */}
          <div className="glass-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileCode size={16} color="var(--accent-cyan)" />
                <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Generated service.yaml</span>
              </div>

              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button
                  className="btn btn-secondary"
                  onClick={handleCopyYaml}
                  style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                >
                  {copiedYaml ? (
                    <>
                      <Check size={12} color="var(--accent-emerald)" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy size={12} /> Copy
                    </>
                  )}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={handleDownloadYaml}
                  style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                >
                  <Download size={12} /> Download
                </button>
              </div>
            </div>

            <pre
              className="code-block"
              style={{
                fontSize: '0.75rem',
                maxHeight: '440px',
                overflowY: 'auto',
                padding: '1rem',
                margin: 0,
              }}
            >
              {yamlContent}
            </pre>
          </div>

          {/* Action Execution Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <button
              className="btn btn-secondary"
              onClick={() => {
                if (onAddToDirectory) {
                  onAddToDirectory(formData);
                }
                onTestInPlayground(formData);
              }}
              style={{ fontSize: '0.82rem', padding: '0.6rem 1rem' }}
              title="Test this draft manifest in the interactive playground right now"
            >
              <Play size={14} />
              <span>Simulate in Playground</span>
            </button>

            <button
              className="btn btn-primary"
              onClick={() => setIsPrModalOpen(true)}
              style={{ fontSize: '0.82rem', padding: '0.6rem 1rem' }}
            >
              <GitPullRequest size={14} />
              <span>Submit PR to Kite</span>
            </button>
          </div>
        </div>
      </div>

      {/* PR Submission Guide Modal */}
      <PRSubmissionModal
        isOpen={isPrModalOpen}
        onClose={() => setIsPrModalOpen(false)}
        manifest={formData}
        yamlContent={yamlContent}
      />
    </div>
  );
};
