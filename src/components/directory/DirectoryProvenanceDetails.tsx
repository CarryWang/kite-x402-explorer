import type { DirectoryProvenance } from '../../services/directory-client.js';

const registryCommits = 'https://github.com/gokite-ai/kite-x402-services/commit/';

export function DirectoryProvenanceDetails({registry}: {registry: DirectoryProvenance}) {
  const {source, commit, fetchedAt, stale, error, errors} = registry;
  let snapshotStatus = source === 'official' ? 'Current' : 'Bundled';
  if (stale) snapshotStatus = 'Stale';
  if (source === 'official' && !commit) snapshotStatus = 'Unavailable';
  return (
    <details className="glass-card" style={{padding:'0.75rem 1rem', marginBottom:'1rem', overflowWrap:'anywhere'}}>
      <summary style={{cursor:'pointer'}}>
        Directory details{errors.length > 0
          ? ` · ${errors.length} invalid manifest${errors.length === 1 ? '' : 's'} excluded`
          : ''}
      </summary>
      <dl>
        <dt>Source</dt>
        <dd>{source === 'official' ? 'Official registry' : 'Bundled demo directory'}</dd>
        <dt>Source commit</dt>
        <dd>{commit ? <a href={registryCommits + commit}><code>{commit}</code></a> : 'Unavailable'}</dd>
        <dt>Last successful fetch</dt>
        <dd>{fetchedAt ? (
          <time dateTime={fetchedAt}>
            {new Date(fetchedAt).toLocaleString(undefined, {dateStyle:'medium', timeStyle:'long'})}
          </time>
        ) : 'Unavailable'}</dd>
        <dt>Snapshot status</dt>
        <dd>{snapshotStatus}</dd>
      </dl>
      {error && <p><strong>Refresh error</strong> {error}</p>}
      {errors.length > 0 && (
        <>
          <h3>Manifest validation errors</h3>
          <ul>{errors.map(({path, error}, index) => (
            <li key={index}><code>{path}</code> · {error}</li>
          ))}</ul>
        </>
      )}
    </details>
  );
}
