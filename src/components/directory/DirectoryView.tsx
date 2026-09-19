import React, { useState, useMemo } from 'react';
import type { ServiceManifest, ServiceCategory } from '../../types/service.js';
import { ServiceCard } from './ServiceCard.js';
import { Search, Sparkles } from 'lucide-react';

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
];

export const DirectoryView: React.FC<DirectoryViewProps> = ({
  services,
  selectedNetwork,
  onSelectService,
  onOpenPlayground,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory | 'all'>('all');

  const filteredServices = useMemo(() => {
    return services.filter((srv) => {
      // Network filter
      if (selectedNetwork === 'testnet' && srv.network !== 'eip155:2368') return false;
      if (selectedNetwork === 'mainnet' && srv.network !== 'eip155:2366') return false;

      // Category filter
      if (selectedCategory !== 'all' && !srv.categories.includes(selectedCategory)) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = srv.name.toLowerCase().includes(q) || srv.display_name.toLowerCase().includes(q);
        const matchesDesc = srv.description.toLowerCase().includes(q);
        const matchesTags = srv.tags?.some((t) => t.toLowerCase().includes(q)) ?? false;
        return matchesName || matchesDesc || matchesTags;
      }

      return true;
    });
  }, [services, selectedNetwork, selectedCategory, searchQuery]);

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
            maxWidth: '640px',
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
            placeholder="Search paid services, categories, or keywords..."
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
              }}
            >
              Clear
            </button>
          )}
        </div>
      </section>

      {/* Category Pills & Stats */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.75rem',
          paddingBottom: '1rem',
          borderBottom: '1px solid var(--border-glass)',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              style={{
                padding: '0.4rem 0.9rem',
                borderRadius: 'var(--radius-xl)',
                fontSize: '0.82rem',
                fontWeight: 500,
                border: selectedCategory === cat.id ? '1px solid var(--accent-cyan)' : '1px solid var(--border-glass)',
                background: selectedCategory === cat.id ? 'rgba(0, 245, 255, 0.12)' : 'var(--bg-secondary)',
                color: selectedCategory === cat.id ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Showing <strong style={{ color: 'var(--text-primary)' }}>{filteredServices.length}</strong> services
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
        <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>
          <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>No services match your filters.</p>
          <p style={{ fontSize: '0.9rem' }}>Try clearing your search query or selecting "All Categories".</p>
        </div>
      )}
    </div>
  );
};
