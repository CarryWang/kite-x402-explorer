import React, { useState, useMemo } from 'react';
import type { ServiceManifest, ServiceCategory, ServiceStatus } from '../../types/service.js';
import { ServiceCard } from './ServiceCard.js';
import { Search, Sparkles, ArrowUpDown, X, Layers } from 'lucide-react';

interface DirectoryViewProps {
  services: ServiceManifest[];
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

type SortOption = 'price-asc' | 'price-desc' | 'endpoints' | 'name';

export const DirectoryView: React.FC<DirectoryViewProps> = ({
  services,
  selectedNetwork,
  onSelectService,
  onOpenPlayground,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<ServiceStatus | 'all'>('all');
  const [sortBy, setSortBy] = useState<SortOption>('price-asc');

  const filteredServices = useMemo(() => {
    return services
      .filter((srv) => {
        // Network filter
        if (selectedNetwork === 'testnet' && srv.network !== 'eip155:2368') return false;
        if (selectedNetwork === 'mainnet' && srv.network !== 'eip155:2366') return false;

        // Status filter
        if (selectedStatus !== 'all' && srv.status !== selectedStatus) return false;

        // Category filter
        if (selectedCategory !== 'all' && !srv.categories.includes(selectedCategory)) return false;

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchesName =
            srv.name.toLowerCase().includes(q) || srv.display_name.toLowerCase().includes(q);
          const matchesDesc = srv.description.toLowerCase().includes(q);
          const matchesTags = srv.tags?.some((t) => t.toLowerCase().includes(q)) ?? false;
          return matchesName || matchesDesc || matchesTags;
        }

        return true;
      })
      .sort((a, b) => {
        const getMinPrice = (srv: ServiceManifest) =>
          srv.endpoints.reduce((min, ep) => Math.min(min, parseFloat(ep.price_usd)), Infinity);

        if (sortBy === 'price-asc') return getMinPrice(a) - getMinPrice(b);
        if (sortBy === 'price-desc') return getMinPrice(b) - getMinPrice(a);
        if (sortBy === 'endpoints') return b.endpoints.length - a.endpoints.length;
        if (sortBy === 'name') return a.display_name.localeCompare(b.display_name);
        return 0;
      });
  }, [services, selectedNetwork, selectedStatus, selectedCategory, searchQuery, sortBy]);

  const hasActiveFilters =
    selectedCategory !== 'all' || selectedStatus !== 'all' || searchQuery.trim().length > 0;

  const handleClearFilters = () => {
    setSelectedCategory('all');
    setSelectedStatus('all');
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

        {/* Row 2: Status, Sorting & Results */}
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
            Try resetting your category or network filters, or search with different keywords.
          </p>
          <button className="btn btn-secondary" onClick={handleClearFilters}>
            Clear All Filters
          </button>
        </div>
      )}
    </div>
  );
};
