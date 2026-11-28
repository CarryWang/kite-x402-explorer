import { INITIAL_SERVICES } from '../src/services/sample-services.js';
import { KITE_CHAINS } from '../src/types/kite.js';
import type { ProbeResult, ProbeUnavailableReason } from '../src/types/probe.js';
import { FACILITATOR_URL, type ServerConfig } from './config.js';
import type { RegistrySnapshot } from './official-registry.js';
import { requestPublic, validateTarget } from './outbound.js';

const facilitatorEndpoint = FACILITATOR_URL + '/supported';
const MAX_CONCURRENT_PROBES = 4;
let activeProbes = 0;

export async function probeRegisteredService(
  serviceName: string,
  config: ServerConfig,
  loadOfficialSnapshot: () => Promise<RegistrySnapshot>,
  request = requestPublic,
): Promise<{status: number; result: ProbeResult}> {
  const unavailable = (status: number, reason: ProbeUnavailableReason) => ({
    status,
    result: {
      kind:'unavailable' as const, source:'none' as const, serviceName,
      checkedAt:new Date().toISOString(), reason,
    },
  });

  const official = config.registrySource === 'official';
  const allowedOrigins = official ? config.officialProbeAllowedOrigins : config.allowedOrigins;
  if (official && allowedOrigins.length === 0) return unavailable(503, 'official_disabled');
  if (activeProbes >= MAX_CONCURRENT_PROBES) return unavailable(503, 'probe_busy');

  activeProbes++;
  try {
    let services = INITIAL_SERVICES;
    if (official) {
      const snapshot = await loadOfficialSnapshot();
      if (!snapshot.registry.commit || snapshot.registry.stale) return unavailable(503, 'registry_unavailable');
      services = snapshot.services;
    }

    const service = services.find(entry => entry.name === serviceName);
    if (!service?.base_url) return unavailable(404, 'target_missing');
    const endpoint = new URL('/healthz', service.base_url).href;
    if (official) {
      try {
        // Verify both origins before starting either outbound request.
        validateTarget(endpoint, allowedOrigins);
        validateTarget(facilitatorEndpoint, allowedOrigins);
      } catch {
        return unavailable(403, 'origin_not_approved');
      }
    }

    const options = {allowedOrigins, method:'GET'};
    // Keep the slot until the sibling request finishes, even if one request fails early.
    const [healthRequest, facilitatorRequest] = await Promise.allSettled(
      [endpoint, facilitatorEndpoint].map(async url => request(url, options)),
    );
    if (healthRequest.status === 'rejected' || facilitatorRequest.status === 'rejected') {
      return unavailable(502, 'upstream_error');
    }
    const health = healthRequest.value;
    const supported = facilitatorRequest.value;
    const data = JSON.parse(health.body.toString());
    const capabilities = JSON.parse(supported.body.toString());
    const expectedAsset = KITE_CHAINS[service.network].assetAddress;
    const networkMatched = data.network === service.network;
    const assetMatched = typeof data.asset === 'string' && data.asset.toLowerCase() === expectedAsset.toLowerCase();
    const facilitatorReachable = supported.status === 200 && Array.isArray(capabilities.kinds) && capabilities.kinds.some(
      (kind: {network?: string; scheme?: string; x402Version?: number}) =>
        kind.network === service.network && kind.scheme === 'exact' && kind.x402Version === 2);
    return {
      status: health.status >= 200 && health.status < 300 ? 200 : 502,
      result: {
        kind:'observed', source:'live', serviceName, checkedAt:new Date().toISOString(), endpoint,
        httpStatus:health.status,
        network:typeof data.network === 'string' ? data.network : null,
        asset:typeof data.asset === 'string' ? data.asset : null,
        networkMatched, assetMatched, facilitatorReachable,
      },
    };
  } catch {
    return unavailable(502, 'upstream_error');
  } finally {
    activeProbes--;
  }
}
