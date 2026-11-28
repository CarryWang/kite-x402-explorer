import { INITIAL_SERVICES } from '../src/services/sample-services.js';

export const FACILITATOR_URL = 'https://facilitator.pieverse.io/v2';

export type ServerConfig = {
  registrySource: 'demo' | 'official';
  registryCommit: string | undefined;
  allowedOrigins: string[];
  officialProbeAllowedOrigins: string[];
};

function parseOrigin(value: string, setting: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(setting + ' must contain only HTTPS origins');
  }
  if (url.protocol !== 'https:' || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash) {
    throw new Error(setting + ' must contain only HTTPS origins');
  }
  return url.origin;
}

function readOrigins(env: NodeJS.ProcessEnv, setting: string): string[] {
  const values = (env[setting] ?? '').split(',').map(value => value.trim()).filter(Boolean);
  return [...new Set(values.map(value => parseOrigin(value, setting)))];
}

export function parseServerConfig(
  env: NodeJS.ProcessEnv,
  registeredUrls = INITIAL_SERVICES.flatMap(service => service.base_url ? [service.base_url] : []),
): ServerConfig {
  const source = env.REGISTRY_SOURCE ?? 'demo';
  if (source !== 'demo' && source !== 'official') {
    throw new Error('REGISTRY_SOURCE must be demo or official');
  }
  const commit = env.REGISTRY_COMMIT;
  if (commit !== undefined && !/^[a-f0-9]{40}$/i.test(commit)) {
    throw new Error('REGISTRY_COMMIT must be a full Git commit SHA');
  }
  return {
    registrySource: source,
    registryCommit: commit,
    officialProbeAllowedOrigins: readOrigins(env, 'OFFICIAL_PROBE_ALLOWED_ORIGINS'),
    allowedOrigins: [...new Set([
      ...registeredUrls.map(value => new URL(value).origin),
      new URL(FACILITATOR_URL).origin,
      ...readOrigins(env, 'OUTBOUND_ALLOWED_ORIGINS'),
    ])],
  };
}
