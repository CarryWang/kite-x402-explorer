import type { ServiceManifest } from '../types/service.js';
import type { ServiceHealthStatus } from '../types/health.js';
import {isProbeResult} from '../types/probe.js';

const HEALTH_CACHE_KEY = 'kite_x402_health_cache_v1';
const MAX_CONCURRENT_PROBES = 4;
const waitingForSlot: (() => void)[] = [];
let activeProbes = 0;
const EXPECTED_ASSETS: Record<string,string> = {
  'eip155:2368':'0x38129cf4CE5E183eFF248F42A7D345Bb1B47621A',
  'eip155:2366':'0x7aB6f3ed87C42eF0aDb67Ed95090f8bF5240149e',
};

/** Failed or unverified probes never become successful simulated observations. */
export async function probeServiceHealth(service: ServiceManifest, signal?: AbortSignal): Promise<ServiceHealthStatus> {
  signal?.throwIfAborted();
  if (activeProbes >= MAX_CONCURRENT_PROBES) {
    await new Promise<void>(resolve => waitingForSlot.push(resolve));
  } else {
    activeProbes++;
  }
  try {
    signal?.throwIfAborted();
    return await requestProbe(service, signal);
  } finally {
    const next = waitingForSlot.shift();
    if (next) next();
    else activeProbes--;
  }
}

async function requestProbe(service: ServiceManifest, signal?: AbortSignal): Promise<ServiceHealthStatus> {
  const started = performance.now();
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, {once:true});
  const timeout = setTimeout(() => controller.abort(), 4500);
  const base = {serviceName:service.name, networkMatched:false, assetMatched:false,
    facilitatorReachable:false, lastCheckedAt:new Date().toISOString(),
    endpointChecked:'/healthz'};
  let failedHttpStatus: number | null = null;
  try {
    if (service.base_url) base.endpointChecked = new URL('/healthz', service.base_url).href;
    const response = await fetch('/api/probe/' + encodeURIComponent(service.name), {
      headers:{Accept:'application/json'}, signal:controller.signal,
    });
    if (!response.ok) {
      failedHttpStatus = response.status;
      const contentType = response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
      if (contentType !== 'application/json' && !contentType?.endsWith('+json')) {
        controller.abort();
        return {...base,status:'down',httpStatus:response.status,
          latencyMs:Math.max(1,Math.round(performance.now()-started)),
          details:'Probe failed with HTTP ' + response.status};
      }
    }
    const data: unknown = await response.json();
    const latencyMs = Math.max(1,Math.round(performance.now()-started));
    if (!isProbeResult(data) || data.serviceName !== service.name ||
        (data.kind === 'observed' && data.endpoint !== base.endpointChecked)) {
      return {...base,status:'down',httpStatus:response.status,latencyMs,
        details:response.ok ? 'Invalid or mismatched probe result' : 'Probe failed with HTTP ' + response.status};
    }
    if (data.kind === 'unavailable') return {...base,status:'down',httpStatus:response.status,latencyMs,
      lastCheckedAt:data.checkedAt,details:'Probe unavailable: ' + data.reason.replaceAll('_',' ')};
    if (!response.ok || data.httpStatus < 200 || data.httpStatus >= 300) {
      const httpStatus = data.httpStatus >= 200 && data.httpStatus < 300 ? response.status : data.httpStatus;
      return {...base,status:'down',httpStatus,latencyMs,lastCheckedAt:data.checkedAt,
        details:'Probe failed with HTTP ' + httpStatus};
    }
    const networkMatched = data.network === service.network && data.networkMatched === true;
    const assetMatched = typeof data.asset === 'string' &&
      data.asset.toLowerCase() === EXPECTED_ASSETS[service.network]?.toLowerCase() && data.assetMatched === true;
    const facilitatorReachable = data.facilitatorReachable === true;
    const healthy = networkMatched && assetMatched && facilitatorReachable;
    return {...base,status:healthy && latencyMs < 750 ? 'healthy' : 'degraded',latencyMs,
      httpStatus:data.httpStatus,lastCheckedAt:data.checkedAt,networkMatched,assetMatched,facilitatorReachable,
      details:healthy ? (latencyMs < 750 ? 'Live service and facilitator checks passed' : 'Live checks passed with high latency')
        : 'Live network, asset or facilitator verification is missing or failed'};
  } catch {
    return {...base,status:'down',httpStatus:failedHttpStatus,latencyMs:Math.max(1,Math.round(performance.now()-started)),
      details:failedHttpStatus === null ? 'Live probe unavailable, invalid or timed out' : 'Probe failed with HTTP ' + failedHttpStatus};
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}

/**
 * Shares the browser limit with individual probes and only schedules one item per worker.
 * Stores results in sessionStorage cache for fast rendering.
 */
export async function batchProbeServices(
  services: ServiceManifest[],
  signal?: AbortSignal,
): Promise<Record<string, ServiceHealthStatus>> {
  const entries = services.entries();
  const results: ServiceHealthStatus[] = [];
  const workers = Array.from({length:Math.min(MAX_CONCURRENT_PROBES, services.length)}, async () => {
    for (const [index, service] of entries) {
      results[index] = await probeServiceHealth(service, signal);
    }
  });
  await Promise.all(workers);
  signal?.throwIfAborted();
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
