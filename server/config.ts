import { INITIAL_SERVICES } from '../src/services/sample-services.js';

export const FACILITATOR_URL = 'https://facilitator.pieverse.io/v2';

export type ServerConfig = {
  registrySource: 'demo' | 'official';
  registryCommit: string | undefined;
  allowedOrigins: string[];
};

function parseOrigin(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('OUTBOUND_ALLOWED_ORIGINS must contain only HTTPS origins');
  }
  if (url.protocol !== 'https:' || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash) {
    throw new Error('OUTBOUND_ALLOWED_ORIGINS must contain only HTTPS origins');
  }
  return url.origin;
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
  const operatorOrigins = (env.OUTBOUND_ALLOWED_ORIGINS ?? '')
    .split(',').map(value => value.trim()).filter(Boolean).map(parseOrigin);
  return {
    registrySource: source,
    registryCommit: commit,
    allowedOrigins: [...new Set([
      ...registeredUrls.map(value => new URL(value).origin),
      new URL(FACILITATOR_URL).origin,
      ...operatorOrigins,
    ])],
  };
}
