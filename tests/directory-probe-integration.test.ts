import assert from 'node:assert/strict';
import test from 'node:test';
import { FACILITATOR_URL, parseServerConfig, type ServerConfig } from '../server/config.ts';
import { OfficialRegistry } from '../server/official-registry.ts';
import type { OutboundOptions } from '../server/outbound.ts';
import { probeRegisteredService } from '../server/service-probe.ts';
import { loadDirectory } from '../src/services/directory-client.ts';
import { batchProbeServices, getCachedHealthMap, probeServiceHealth } from '../src/services/health-prober.ts';
import { INITIAL_SERVICES } from '../src/services/sample-services.ts';
import { KITE_TESTNET } from '../src/types/kite.ts';

const demoService = INITIAL_SERVICES[0];
const manifestPath = `services/${demoService.name}/service.yaml`;
const probePath = '/api/probe/' + encodeURIComponent(demoService.name);
const firstOrigin = 'https://first-weather.example';
const nextOrigin = 'https://next-weather.example';
const firstCommit = 'a'.repeat(40);
const nextCommit = 'b'.repeat(40);
const facilitatorEndpoint = FACILITATOR_URL + '/supported';

function directoryFixture() {
  const state = {
    source: 'official' as ServerConfig['registrySource'],
    commit: firstCommit,
    origin: firstOrigin,
    offline: false,
    now: 1_000_000,
  };
  const configs = {
    demo: parseServerConfig({REGISTRY_SOURCE: 'demo'}),
    official: parseServerConfig({
      REGISTRY_SOURCE: 'official',
      OFFICIAL_PROBE_ALLOWED_ORIGINS: [firstOrigin, nextOrigin, new URL(FACILITATOR_URL).origin].join(','),
    }),
  };
  const registry = new OfficialRegistry({
    ttlMs: 1000,
    now: () => state.now,
    fetcher: async (input) => {
      const url = String(input);
      if (state.offline) return new Response('offline', {status: 503});
      if (url.endsWith('/git/ref/heads/main')) {
        return Response.json({object: {type: 'commit', sha: state.commit}});
      }
      if (url.endsWith(`/git/trees/${state.commit}?recursive=1`)) {
        return Response.json({tree: [{type: 'blob', path: manifestPath}]});
      }
      assert.ok(url.endsWith(`/${state.commit}/${manifestPath}`), url);
      return Response.json({...demoService, base_url: state.origin});
    },
  });
  const outbound: string[] = [];
  const request = async (url: string, options: OutboundOptions) => {
    outbound.push(url);
    assert.equal(options.method, 'GET');
    const {network, assetAddress} = KITE_TESTNET;
    const data = url === facilitatorEndpoint
      ? {kinds: [{network, scheme: 'exact', x402Version: 2}]}
      : {network, asset: assetAddress};
    return {status: 200, headers: {}, body: Buffer.from(JSON.stringify(data))};
  };
  // Route browser requests in process so registry refresh and probes use the same snapshot.
  const fetcher: typeof fetch = async (input) => {
    const path = String(input);
    const config = configs[state.source];
    if (path === '/api/services') {
      if (config.registrySource === 'demo') {
        return Response.json({services: INITIAL_SERVICES, registry: {source: 'demo'}});
      }
      const snapshot = await registry.get();
      return Response.json(snapshot, {status: snapshot.registry.commit ? 200 : 503});
    }
    assert.equal(path, probePath);
    const {status, result} = await probeRegisteredService(demoService.name, config, () => registry.get(), request);
    return Response.json(result, {status});
  };
  return {state, outbound, fetcher};
}

test('refresh rebinds official probes to the recovered snapshot and skips stale targets', async (t) => {
  const {state, outbound, fetcher} = directoryFixture();
  t.mock.method(globalThis, 'fetch', fetcher);

  const first = await loadDirectory();
  assert.equal(first.registry.commit, firstCommit);
  const observed = await probeServiceHealth(first.services[0]);
  assert.equal(observed.endpointChecked, firstOrigin + '/healthz');
  assert.equal(observed.httpStatus, 200);
  assert.equal(observed.networkMatched, true);
  assert.deepEqual(outbound.splice(0), [firstOrigin + '/healthz', facilitatorEndpoint]);

  state.now += 1000;
  state.offline = true;
  const stale = await loadDirectory();
  assert.equal(stale.registry.stale, true);
  assert.equal(stale.registry.commit, firstCommit);
  assert.deepEqual(stale.services, first.services);
  const unavailable = await probeServiceHealth(stale.services[0]);
  assert.equal(unavailable.httpStatus, 503);
  assert.equal(unavailable.details, 'Probe unavailable: registry unavailable');
  assert.deepEqual(outbound, []);

  Object.assign(state, {now: state.now + 30_000, offline: false, commit: nextCommit, origin: nextOrigin});
  const mismatch = await probeServiceHealth(stale.services[0]);
  assert.equal(mismatch.details, 'Invalid or mismatched probe result');
  assert.equal(mismatch.networkMatched, false);
  assert.deepEqual(outbound.splice(0), [nextOrigin + '/healthz', facilitatorEndpoint]);

  const recovered = await loadDirectory();
  assert.equal(recovered.registry.stale, false);
  assert.equal(recovered.registry.commit, nextCommit);
  const refreshed = await probeServiceHealth(recovered.services[0]);
  assert.equal(refreshed.endpointChecked, nextOrigin + '/healthz');
  assert.equal(refreshed.networkMatched, true);
  assert.equal(refreshed.assetMatched, true);
  assert.equal(refreshed.facilitatorReachable, true);
  assert.deepEqual(outbound, [nextOrigin + '/healthz', facilitatorEndpoint]);
});

test('a cancelled demo batch cannot replace official cached evidence for the same service', async (t) => {
  const {state, fetcher} = directoryFixture();
  state.source = 'demo';
  const storage = new Map<string, string>();
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: {getItem: (key: string) => storage.get(key) ?? null, setItem: storage.set.bind(storage)},
  });
  t.after(() => {
    if (originalStorage) Object.defineProperty(globalThis, 'sessionStorage', originalStorage);
    else Reflect.deleteProperty(globalThis, 'sessionStorage');
  });

  let releaseDemo!: () => void;
  const delayed = new Promise<void>(resolve => { releaseDemo = resolve; });
  let demoProbeReady!: () => void;
  const started = new Promise<void>(resolve => { demoProbeReady = resolve; });
  const browserFetch: typeof fetch = async (input) => {
    const isDemoProbe = state.source === 'demo' && String(input) === probePath;
    const response = await fetcher(input);
    if (isDemoProbe) {
      // Model a response already received by the transport when its caller aborts.
      demoProbeReady();
      await delayed;
    }
    return response;
  };
  t.mock.method(globalThis, 'fetch', browserFetch);

  const demo = await loadDirectory();
  assert.equal(demo.registry.source, 'demo');
  const service = demo.services.find(service => service.name === demoService.name);
  assert.ok(service);
  const controller = new AbortController();
  const previousBatch = batchProbeServices([service], controller.signal);
  const cancelled = assert.rejects(previousBatch, {name: 'AbortError'});
  // Attach both failure paths immediately so a broken fixture fails instead of waiting for its gate.
  const finishedEarly = previousBatch.then(() => assert.fail('Demo probe finished before its response was released'));
  try {
    await Promise.race([started, finishedEarly]);
    state.source = 'official';
    const official = await loadDirectory();
    assert.equal(official.registry.source, 'official');
    controller.abort();
    const current = await batchProbeServices(official.services);
    assert.equal(current[demoService.name].endpointChecked, firstOrigin + '/healthz');
    assert.equal(current[demoService.name].networkMatched, true);
    releaseDemo();
    await cancelled;
    assert.deepEqual(getCachedHealthMap(), current);
  } finally {
    controller.abort();
    releaseDemo();
    await cancelled;
  }
});
