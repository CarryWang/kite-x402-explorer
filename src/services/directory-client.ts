import { validateServiceManifest } from './schema-validator.js';
import type { ServiceManifest } from '../types/service.js';

export interface DirectoryProvenance {
  source: 'demo' | 'official';
  commit: string | null;
  fetchedAt: string | null;
  stale: boolean;
  error: string | null;
  errors: { path: string; error: string }[];
}

export class DirectoryLoadError extends Error {
  constructor(message: string, readonly registry: DirectoryProvenance | null = null) {
    super(message);
  }
}

function readProvenance(value: unknown): DirectoryProvenance | null {
  if (typeof value !== 'object' || value === null) return null;
  const { source, commit, fetchedAt, stale, error, errors } = value as Record<string, unknown>;
  if (source === 'demo') {
    return {source, commit:null, fetchedAt:null, stale:false, error:null, errors:[]};
  }
  if (source !== 'official') return null;
  const fetchTime = typeof fetchedAt === 'string' ? Date.parse(fetchedAt) : NaN;
  const manifestErrors = Array.isArray(errors)
    ? errors.filter((entry): entry is DirectoryProvenance['errors'][number] =>
        typeof entry?.path === 'string' && typeof entry?.error === 'string')
    : [];
  return {
    source,
    commit: typeof commit === 'string' && /^[a-f0-9]{40}$/i.test(commit) ? commit : null,
    fetchedAt: Number.isFinite(fetchTime) ? new Date(fetchTime).toISOString() : null,
    stale: stale === true,
    error: typeof error === 'string' && error.length > 0 ? error : null,
    errors: manifestErrors,
  };
}

export async function loadDirectory(fetcher: typeof fetch = fetch): Promise<{
  services: ServiceManifest[];
  note: string;
  registry: DirectoryProvenance;
}> {
  const response = await fetcher('/api/services', {signal:AbortSignal.timeout(15000), cache:'no-store'});
  if (!response.ok) {
    // A cold official registry failure can still report why no snapshot is available.
    const data = response.status === 503 ? await response.json().catch(() => null) : null;
    const registry = readProvenance(data?.registry);
    throw new DirectoryLoadError(
      'Service directory unavailable (HTTP ' + response.status + ')',
      registry?.source === 'official' ? registry : null,
    );
  }

  const data = await response.json();
  if (!Array.isArray(data?.services) || data.services.some((service: unknown) => !validateServiceManifest(service).valid)) {
    throw new DirectoryLoadError('Service directory returned invalid manifests');
  }
  const registry = readProvenance(data.registry);
  if (!registry) throw new DirectoryLoadError('Service directory is missing source metadata');
  const note = registry.source === 'demo'
    ? 'Bundled demo directory; addresses and availability are not verified.'
    : registry.error && registry.stale ? 'Official directory · stale: ' + registry.error : 'Official directory.';
  return {services:data.services, note, registry};
}
