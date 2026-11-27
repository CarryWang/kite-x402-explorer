import React, { useState, useMemo } from 'react';
import type { ServiceManifest, ServiceCategory, ServiceStatus } from '../../types/service.js';
import type { ServiceHealthStatus, HealthAutoRefreshInterval, HealthStatusType } from '../../types/health.js';
import { ServiceCard } from './ServiceCard.js';
import { queryDirectory, type DirectorySort } from '../../lib/directory-query.js';
import { Search, Sparkles, ArrowUpDown, X, Layers, Activity, RefreshCw } from 'lucide-react';

interface DirectoryViewProps {
  services: ServiceManifest[];
  healthMap: Record<string, ServiceHealthStatus>;
  isProbing: boolean;
  onRunBatchProbe: () => Promise<void>;
  autoRefreshInterval: HealthAutoRefreshInterval;
  onChangeAutoRefresh: (sec: HealthAutoRefreshInterval) => void;
  selectedNetwork: 'all' | 'testnet' | 'mainnet';
  onSelectService: (service: ServiceManifest) => void;
  onOpenPlayground: (service: ServiceManifest) => void;
}

const CATEGORIES: { id: ServiceCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'All Categories' },
  { id: 'ai', label: 'AI & ML' },
  { id: 'search', label: 'Search & Scrape' },
  { id: 'finance', label: 'DeFi & Security' },
  { id: 'weather', label: 'Weather & Geo' },
  { id: 'data', label: 'Datasets' },
  { id: 'web', label: 'Web Services' },
];

type SortOption = DirectorySort;

export const DirectoryView: React.FC<DirectoryViewProps> = ({
  services,
  healthMap,
  isProbing,
  onRunBatchProbe,
  autoRefreshInterval,
  onChangeAutoRefresh,
  selectedNetwork,
  onSelectService,
  onOpenPlayground,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<ServiceStatus | 'all'>('all');
  const [selectedHealth, setSelectedHealth] = useState<HealthStatusType | 'all'>('all');
  const [sortBy, setSortBy] = useState<SortOption>('price-asc');

  // Compute telemetry metrics across loaded services
  const { healthyCount, degradedCount, downCount, avgLatency } = useMemo(() => {
    let healthy = 0;
    let degraded = 0;
    let down = 0;
    let totalLatency = 0;
    let countWithLatency = 0;

    for (const srv of services) {
      const h = healthMap[srv.name];
      if (h) {
        if (h.status === 'healthy') healthy++;
        else if (h.status === 'degraded') degraded++;
        else if (h.status === 'down') down++;

        if (h.latencyMs > 0) {
          totalLatency += h.latencyMs;
          countWithLatency++;
        }
      }
    }

    const avg = countWithLatency > 0 ? Math.round(totalLatency / countWithLatency) : 0;
    return {
      healthyCount: healthy,
      degradedCount: degraded,
      downCount: down,
      avgLatency: avg,
    };
  }, [services, healthMap]);

  const filteredServices = useMemo(
    () =>
      queryDirectory(services, healthMap, {
        network: selectedNetwork,
        status: selectedStatus,
        category: selectedCategory,
        health: selectedHealth,
        search: searchQuery,
        sortBy,
      }),
    [services, selectedNetwork, selectedStatus, selectedCategory, selectedHealth, searchQuery, sortBy, healthMap],
  );

  const hasActiveFilters =
    selectedCategory !== 'all' ||
    selectedStatus !== 'all' ||
    selectedHealth !== 'all' ||
    searchQuery.trim().length > 0;

  const handleClearFilters = () => {
    setSelectedCategory('all');
    setSelectedStatus('all');
    setSelectedHealth('all');
    setSearchQuery('');
  };

  return (
    <div>
      {/* Hero Header */}
      <section className="hero">
        <div className="hero-tag">
          <Sparkles size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
          Kite x402 Micropayments Standard
        </div>
        <h1 className="hero-title">
          Autonomous Agent <span>Service Hub</span>
        </h1>
        <p className="hero-desc">
          Discover, inspect, and test HTTP APIs monetized with HTTP 402 and settled via EIP-3009 transfer authorizations on the Kite blockchain.
        </p>

        {/* Search & Filter Bar */}
        <div
          style={{
            maxWidth: '680px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-glass)',
            borderRadius: 'var(--radius-lg)',
            padding: '0.4rem 0.6rem 0.4rem 1rem',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <Search size={18} color="var(--text-muted)" style={{ marginRight: '0.75rem' }} />
          <input
            type="text"
            placeholder="Search paid services, categories, endpoints, or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              fontSize: '0.92rem',
              outline: 'none',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '0.8rem',
                marginRight: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
              }}
            >
              <X size={14} /> Clear
            </button>
          )}
        </div>
      </section>

      {/* Global Probing & Telemetry Bar */}
      <div
        style={{
          background: 'rgba(7, 9, 14, 0.6)',
          border: '1px solid var(--border-glass)',
          borderRadius: 'var(--radius-md)',
          padding: '0.75rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        {/* Left: Summary Metrics */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Activity size={16} color="var(--accent-cyan)" />
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Live Telemetry
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.78rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-emerald)' }}>
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: 'var(--accent-emerald)',
                  display: 'inline-block',
                }}
              />
              {healthyCount} Healthy
            </span>
            {degradedCount > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-amber)' }}>
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: 'var(--accent-amber)',
                    display: 'inline-block',
                  }}
                />
                {degradedCount} Degraded
              </span>
            )}
            {downCount > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-rose)' }}>
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: 'var(--accent-rose)',
                    display: 'inline-block',
                  }}
                />
                {downCount} Offline
              </span>
            )}
            <span style={{ color: 'var(--text-muted)' }}>•</span>
            <span style={{ color: 'var(--text-secondary)' }}>
              Avg Latency:{' '}
              <strong style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
                {avgLatency > 0 ? `${avgLatency}ms` : '--'}
              </strong>
            </span>
          </div>
        </div>

        {/* Right: Probing Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Auto-refresh interval */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <span>Auto-refresh:</span>
            <select
              value={autoRefreshInterval}
              onChange={(e) => onChangeAutoRefresh(Number(e.target.value) as HealthAutoRefreshInterval)}
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-glass)',
                color: 'var(--text-primary)',
                borderRadius: 'var(--radius-sm)',
                padding: '2px 6px',
                fontSize: '0.75rem',
                outline: 'none',
              }}
            >
              <option value={0}>Off</option>
              <option value={15}>15s</option>
              <option value={30}>30s</option>
              <option value={60}>60s</option>
            </select>
          </div>

          {/* Run Probes Button */}
          <button
            className="btn btn-secondary"
            onClick={onRunBatchProbe}
            disabled={isProbing}
            style={{
              fontSize: '0.78rem',
              padding: '0.35rem 0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            title="Ping /healthz on all registered services"
          >
            <RefreshCw
              size={13}
              style={{ animation: isProbing ? 'spin 1s linear infinite' : 'none' }}
            />
            <span>{isProbing ? 'Probing Endpoints...' : 'Probe All Healthz'}</span>
          </button>
        </div>
      </div>

      {/* Control Bar: Categories, Status & Sorting */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          marginBottom: '2rem',
          paddingBottom: '1.25rem',
          borderBottom: '1px solid var(--border-glass)',
        }}
      >
        {/* Row 1: Categories */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, marginRight: '0.5rem' }}>
            CATEGORY:
          </span>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              style={{
                padding: '0.35rem 0.85rem',
                borderRadius: 'var(--radius-xl)',
                fontSize: '0.8rem',
                fontWeight: 500,
                border:
                  selectedCategory === cat.id
                    ? '1px solid var(--accent-cyan)'
                    : '1px solid var(--border-glass)',
                background:
                  selectedCategory === cat.id ? 'rgba(0, 245, 255, 0.12)' : 'var(--bg-secondary)',
                color: selectedCategory === cat.id ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Row 2: Status, Health, Sorting & Results */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            {/* Status pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>STATUS:</span>
              {(['all', 'live', 'testnet', 'draft'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setSelectedStatus(st)}
                  style={{
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    border: selectedStatus === st ? '1px solid var(--text-primary)' : '1px solid var(--border-glass)',
                    background: selectedStatus === st ? 'var(--bg-tertiary)' : 'transparent',
                    color: selectedStatus === st ? 'var(--text-primary)' : 'var(--text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  {st}
                </button>
              ))}
            </div>

            {/* Health filter pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>HEALTH:</span>
              {(['all', 'healthy', 'degraded', 'down'] as const).map((hl) => (
                <button
                  key={hl}
                  onClick={() => setSelectedHealth(hl)}
                  style={{
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    textTransform: 'capitalize',
                    border: selectedHealth === hl ? '1px solid var(--accent-cyan)' : '1px solid var(--border-glass)',
                    background: selectedHealth === hl ? 'rgba(0, 245, 255, 0.15)' : 'transparent',
                    color: selectedHealth === hl ? 'var(--accent-cyan)' : 'var(--text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  {hl}
                </button>
              ))}
            </div>

            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--accent-rose)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Reset all filters
              </button>
            )}
          </div>

          {/* Sort Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <ArrowUpDown size={14} />
              <span>Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-glass)',
                  color: 'var(--text-primary)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '3px 8px',
                  fontSize: '0.8rem',
                  outline: 'none',
                }}
              >
                <option value="price-asc">Lowest Price</option>
                <option value="price-desc">Highest Price</option>
                <option value="latency-asc">Fastest Latency</option>
                <option value="endpoints">Most Endpoints</option>
                <option value="name">Service Name (A-Z)</option>
              </select>
            </div>

            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Found <strong style={{ color: 'var(--text-primary)' }}>{filteredServices.length}</strong> services
            </div>
          </div>
        </div>
      </div>

      {/* Services Grid */}
      {filteredServices.length > 0 ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
            gap: '1.5rem',
          }}
        >
          {filteredServices.map((srv) => (
            <ServiceCard
              key={srv.name}
              service={srv}
              health={healthMap[srv.name]}
              onSelectService={onSelectService}
              onOpenPlayground={onOpenPlayground}
            />
          ))}
        </div>
      ) : (
        <div
          className="glass-card"
          style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)' }}
        >
          <Layers size={40} style={{ margin: '0 auto 1rem', opacity: 0.4 }} />
          <p style={{ fontSize: '1.15rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            No x402 services found matching your filters.
          </p>
          <p style={{ fontSize: '0.9rem', maxWidth: '420px', margin: '0 auto 1.5rem' }}>
            Try resetting your category, network, or health filters, or search with different keywords.
          </p>
          <button className="btn btn-secondary" onClick={handleClearFilters}>
            Clear All Filters
          </button>
        </div>
      )}
    </div>
  );
};
