import assert from 'node:assert/strict';
import test from 'node:test';
import { parseServerConfig } from '../server/config.ts';
import type { RegistrySnapshot } from '../server/official-registry.ts';
import type { OutboundOptions } from '../server/outbound.ts';
import { probeRegisteredService } from '../server/service-probe.ts';
import { INITIAL_SERVICES } from '../src/services/sample-services.ts';
import { isProbeResult } from '../src/types/probe.ts';

const serviceOrigin = 'https://service.example';
const facilitatorOrigin = 'https://facilitator.pieverse.io';
const approvedOrigins = serviceOrigin + ',' + facilitatorOrigin;
const service = {...INITIAL_SERVICES[0], base_url:serviceOrigin};

function snapshot(overrides: Partial<RegistrySnapshot['registry']> = {}): RegistrySnapshot {
  return {
    services:[service],
    registry:{
      source:'official', commit:'a'.repeat(40), fetchedAt:'2026-11-23T02:00:00.000Z',
      stale:false, errors:[], sources:[], ...overrides,
    },
  };
}

test('official probes send GET only to the approved service and facilitator endpoints', async () => {
  const config = parseServerConfig({
    REGISTRY_SOURCE:'official',
    OFFICIAL_PROBE_ALLOWED_ORIGINS:approvedOrigins,
    OUTBOUND_ALLOWED_ORIGINS:'https://relay.example',
  });
  const requests: {url: string; options: OutboundOptions}[] = [];
  const {status, result} = await probeRegisteredService(service.name, config, async () => snapshot(), async (url, options) => {
    requests.push({url, options});
    const body = url === serviceOrigin + '/healthz'
      ? {network:'eip155:2368', asset:'0x38129cf4CE5E183eFF248F42A7D345Bb1B47621A'}
      : {kinds:[{network:'eip155:2368', scheme:'exact', x402Version:2}]};
    return {status:200, headers:{}, body:Buffer.from(JSON.stringify(body))};
  });
  assert.deepEqual(requests, [
    {url:'https://service.example/healthz', options:{method:'GET', allowedOrigins:[serviceOrigin, facilitatorOrigin]}},
    {url:'https://facilitator.pieverse.io/v2/supported', options:{method:'GET', allowedOrigins:[serviceOrigin, facilitatorOrigin]}},
  ]);
  assert.equal(status, 200);
  assert.ok(isProbeResult(result) && result.kind === 'observed');
  assert.equal(result.endpoint, 'https://service.example/healthz');
  assert.equal(result.httpStatus, 200);
  assert.equal(result.networkMatched, true);
  assert.equal(result.assetMatched, true);
  assert.equal(result.facilitatorReachable, true);
});

test('official probes stay disabled unless their dedicated origins are configured', async () => {
  const config = parseServerConfig({REGISTRY_SOURCE:'official', OUTBOUND_ALLOWED_ORIGINS:approvedOrigins});
  let registryReads = 0;
  let requests = 0;
  const {status, result} = await probeRegisteredService(service.name, config, async () => {
    registryReads++;
    return snapshot();
  }, async () => {
    requests++;
    throw new Error('Unexpected request');
  });
  assert.equal(status, 503);
  assert.ok(isProbeResult(result) && result.kind === 'unavailable');
  assert.equal(result.reason, 'official_disabled');
  assert.equal(registryReads, 0);
  assert.equal(requests, 0);
});

test('official probes reject unknown or stale services and incomplete approvals before network requests', async () => {
  for (const {origins, registry, expectedStatus, reason} of [
    {origins:facilitatorOrigin, registry:snapshot(), expectedStatus:403, reason:'origin_not_approved'},
    {origins:serviceOrigin, registry:snapshot(), expectedStatus:403, reason:'origin_not_approved'},
    {origins:approvedOrigins, registry:snapshot({stale:true}), expectedStatus:503, reason:'registry_unavailable'},
    {origins:approvedOrigins, registry:snapshot({commit:null}), expectedStatus:503, reason:'registry_unavailable'},
    {origins:approvedOrigins, registry:{...snapshot(), services:[]}, expectedStatus:404, reason:'target_missing'},
  ]) {
    const config = parseServerConfig({REGISTRY_SOURCE:'official', OFFICIAL_PROBE_ALLOWED_ORIGINS:origins});
    let requests = 0;
    const {status, result} = await probeRegisteredService(service.name, config, async () => registry, async () => {
      requests++;
      throw new Error('Unexpected request');
    });
    assert.equal(status, expectedStatus);
    assert.ok(isProbeResult(result) && result.kind === 'unavailable');
    assert.equal(result.reason, reason);
    assert.equal(requests, 0);
  }
});

test('server probe slots stay occupied until both upstream requests settle', async () => {
  const config = parseServerConfig({REGISTRY_SOURCE:'official', OFFICIAL_PROBE_ALLOWED_ORIGINS:approvedOrigins});
  let release = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  let failHealth = true;
  let requests = 0;
  const probe = () => probeRegisteredService(service.name, config, async () => snapshot(), async url => {
    requests++;
    if (url === serviceOrigin + '/healthz' && failHealth) throw new Error('Health request failed');
    await gate;
    return {status:200, headers:{}, body:Buffer.from('{}')};
  });
  const pending = Array.from({length:4}, probe);
  try {
    await new Promise<void>(resolve => setImmediate(resolve));
    const overflow = await probe();
    assert.equal(overflow.status, 503);
    assert.ok(isProbeResult(overflow.result) && overflow.result.kind === 'unavailable');
    assert.equal(overflow.result.reason, 'probe_busy');
    assert.equal(requests, 8);
  } finally {
    release();
    await Promise.all(pending);
  }
  failHealth = false;
  assert.equal((await probe()).status, 200);
  assert.equal(requests, 10);
});
