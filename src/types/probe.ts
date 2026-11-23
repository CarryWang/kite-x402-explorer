/** The server reports observed evidence separately from an unavailable probe. */
export interface ObservedProbeResult {
  kind: 'observed';
  source: 'live';
  serviceName: string;
  checkedAt: string;
  endpoint: string;
  httpStatus: number;
  network: string | null;
  asset: string | null;
  networkMatched: boolean;
  assetMatched: boolean;
  facilitatorReachable: boolean;
}

const probeUnavailableReasons = [
  'official_disabled', 'registry_unavailable', 'origin_not_approved', 'target_missing', 'upstream_error',
] as const;

export type ProbeUnavailableReason = typeof probeUnavailableReasons[number];

export interface UnavailableProbeResult {
  kind: 'unavailable';
  source: 'none';
  serviceName: string;
  checkedAt: string;
  reason: ProbeUnavailableReason;
}

export type ProbeResult = ObservedProbeResult | UnavailableProbeResult;

export function isProbeResult(value: unknown): value is ProbeResult {
  if (typeof value !== 'object' || value === null) return false;
  const result = value as Record<string, unknown>;
  if (typeof result.serviceName !== 'string' || !result.serviceName ||
      typeof result.checkedAt !== 'string' || !Number.isFinite(Date.parse(result.checkedAt))) return false;
  if (result.kind === 'unavailable') {
    return result.source === 'none' && typeof result.reason === 'string' &&
      probeUnavailableReasons.some(reason => reason === result.reason);
  }
  return result.kind === 'observed' && result.source === 'live' &&
    typeof result.endpoint === 'string' &&
    Number.isInteger(result.httpStatus) && (result.httpStatus as number) >= 100 &&
    (result.httpStatus as number) <= 599 &&
    (result.network === null || typeof result.network === 'string') &&
    (result.asset === null || typeof result.asset === 'string') &&
    typeof result.networkMatched === 'boolean' && typeof result.assetMatched === 'boolean' &&
    typeof result.facilitatorReachable === 'boolean';
}
