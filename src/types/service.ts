/**
 * Manifest definitions for Kite x402 services.
 * Corresponds to kite-x402-services/schema/service.schema.json
 */

export type ServiceStatus = 'draft' | 'testnet' | 'live';
export type ServiceCategory =
  | 'ai'
  | 'data'
  | 'finance'
  | 'geo'
  | 'media'
  | 'messaging'
  | 'search'
  | 'shopping'
  | 'weather'
  | 'web'
  | 'other';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ServiceEndpoint {
  method: HttpMethod;
  path: string;
  summary: string;
  price_usd: string;
  example_request?: {
    query?: Record<string, string>;
    headers?: Record<string, string>;
    body?: unknown;
  };
  pitfalls?: string[];
}

export interface ServiceMaintainer {
  github: string;
  contact?: string;
}

export interface ServiceUpstream {
  name: string;
  url: string;
  requires_api_key?: boolean;
  terms_url?: string;
}

export interface ServiceManifest {
  schema: 1;
  name: string;
  display_name: string;
  description: string;
  maintainer: ServiceMaintainer;
  status: ServiceStatus;
  base_url?: string;
  network: 'eip155:2366' | 'eip155:2368';
  pay_to: `0x${string}`;
  upstream: ServiceUpstream;
  endpoints: ServiceEndpoint[];
  categories: ServiceCategory[];
  tags?: string[];
  source?: 'go-gin' | 'typescript-express' | 'custom';
}
