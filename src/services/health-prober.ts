import type { ServiceManifest } from '../types/service.js';
import type { ServiceHealthStatus } from '../types/health.js';

const HEALTH_CACHE_KEY = 'kite_x402_health_cache_v1';
const EXPECTED_ASSETS: Record<string,string> = {
  'eip155:2368':'0x38129cf4CE5E183eFF248F42A7D345Bb1B47621A',
  'eip155:2366':'0x7aB6f3ed87C42eF0aDb67Ed95090f8bF5240149e',
};

/** Failed or unverified probes never become successful simulated observations. */
export async function probeServiceHealth(service: ServiceManifest): Promise<ServiceHealthStatus> {
  const started = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);
  const base = {serviceName:service.name, networkMatched:false, assetMatched:false,
    facilitatorReachable:false, lastCheckedAt:new Date().toISOString(),
    endpointChecked:service.base_url ? new URL('/healthz',service.base_url).href : '/healthz'};
  try {
    const response = await fetch('/api/probe/' + encodeURIComponent(service.name), {
      headers:{Accept:'application/json'}, signal:controller.signal,
    });
    const data = await response.json();
    const latencyMs = Math.max(1,Math.round(performance.now()-started));
    if (!response.ok) return {...base,status:'down',httpStatus:response.status,latencyMs,
      details:'Probe failed with HTTP ' + response.status};
    const observed = data?.source === 'live';
    const networkMatched = observed && data.network === service.network && data.networkMatched === true;
    const assetMatched = observed && typeof data.asset === 'string' &&
      data.asset.toLowerCase() === EXPECTED_ASSETS[service.network]?.toLowerCase() && data.assetMatched === true;
    const facilitatorReachable = observed && data.facilitatorReachable === true;
    const healthy = networkMatched && assetMatched && facilitatorReachable;
    return {...base,status:healthy && latencyMs < 750 ? 'healthy' : 'degraded',latencyMs,
      httpStatus:response.status,networkMatched,assetMatched,facilitatorReachable,
      details:healthy ? (latencyMs < 750 ? 'Live service and facilitator checks passed' : 'Live checks passed with high latency')
        : 'Live network, asset or facilitator verification is missing or failed'};
  } catch {
    return {...base,status:'down',httpStatus:null,latencyMs:Math.max(1,Math.round(performance.now()-started)),
      details:'Live probe unavailable, invalid or timed out'};
  } finally {clearTimeout(timeout);}
}

/**
 * Concurrently batch-probes an array of services.
 * Stores results in sessionStorage cache for fast rendering.
 */
export async function batchProbeServices(
  services: ServiceManifest[]
): Promise<Record<string, ServiceHealthStatus>> {
  const results = await Promise.all(services.map((s) => probeServiceHealth(s)));
  const healthMap: Record<string, ServiceHealthStatus> = {};

  for (const item of results) {
    healthMap[item.serviceName] = item;
  }

  try {
    sessionStorage.setItem(HEALTH_CACHE_KEY, JSON.stringify(healthMap));
  } catch {
    // ignore sessionStorage errors
  }

  return healthMap;
}

/**
 * Retrieves cached health probe results from sessionStorage.
 */
export function getCachedHealthMap(): Record<string, ServiceHealthStatus> {
  try {
    const raw = sessionStorage.getItem(HEALTH_CACHE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // ignore
  }
  return {};
}
