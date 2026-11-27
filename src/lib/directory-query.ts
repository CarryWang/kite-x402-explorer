import type { ServiceCategory, ServiceManifest, ServiceStatus } from '../types/service.js';
import type { HealthStatusType, ServiceHealthStatus } from '../types/health.js';

export type DirectorySort = 'price-asc' | 'price-desc' | 'endpoints' | 'latency-asc' | 'name';

export interface DirectoryQuery {
  network: 'all' | 'testnet' | 'mainnet';
  status: ServiceStatus | 'all';
  category: ServiceCategory | 'all';
  health: HealthStatusType | 'all';
  search: string;
  sortBy: DirectorySort;
}

const minPrice = (srv: ServiceManifest) =>
  srv.endpoints.reduce((min, ep) => Math.min(min, parseFloat(ep.price_usd)), Infinity);

/**
 * Order for "Fastest Latency": services that answered come first by latency,
 * then services that are down (their latency is how fast they failed, not how
 * fast they serve), then services that were never probed.
 */
function latencyRank(health: ServiceHealthStatus | undefined): [number, number] {
  if (!health || health.status === 'unprobed') return [2, 0];
  if (health.status === 'down') return [1, 0];
  return [0, health.latencyMs];
}

function matchesSearch(srv: ServiceManifest, search: string): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  return (
    srv.name.toLowerCase().includes(q) ||
    srv.display_name.toLowerCase().includes(q) ||
    srv.description.toLowerCase().includes(q) ||
    (srv.tags?.some((t) => t.toLowerCase().includes(q)) ?? false)
  );
}

/** The directory's filters and sort order, as a pure function of its inputs. */
export function queryDirectory(
  services: readonly ServiceManifest[],
  healthMap: Record<string, ServiceHealthStatus>,
  query: DirectoryQuery,
): ServiceManifest[] {
  return services
    .filter((srv) => {
      if (query.network === 'testnet' && srv.network !== 'eip155:2368') return false;
      if (query.network === 'mainnet' && srv.network !== 'eip155:2366') return false;
      if (query.status !== 'all' && srv.status !== query.status) return false;
      if (query.category !== 'all' && !srv.categories.includes(query.category)) return false;
      if (query.health !== 'all') {
        const h = healthMap[srv.name];
        if (!h && query.health !== 'unprobed') return false;
        if (h && h.status !== query.health) return false;
      }
      return matchesSearch(srv, query.search);
    })
    .sort((a, b) => {
      switch (query.sortBy) {
        case 'price-asc':
          return minPrice(a) - minPrice(b);
        case 'price-desc':
          return minPrice(b) - minPrice(a);
        case 'endpoints':
          return b.endpoints.length - a.endpoints.length;
        case 'latency-asc': {
          const [groupA, latA] = latencyRank(healthMap[a.name]);
          const [groupB, latB] = latencyRank(healthMap[b.name]);
          return groupA - groupB || latA - latB;
        }
        case 'name':
          return a.display_name.localeCompare(b.display_name);
      }
    });
}
