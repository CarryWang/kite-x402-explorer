/**
 * Type definitions for Service Health Probing & Latency Monitoring.
 */

export type HealthStatusType = 'healthy' | 'degraded' | 'down' | 'unprobed';

export interface ServiceHealthStatus {
  serviceName: string;
  status: HealthStatusType;
  latencyMs: number;
  httpStatus: number | null;
  networkMatched: boolean;
  assetMatched: boolean;
  facilitatorReachable: boolean;
  lastCheckedAt: string;
  endpointChecked: string;
  details?: string;
}

export type HealthAutoRefreshInterval = 0 | 15 | 30 | 60; // seconds, 0 = off
