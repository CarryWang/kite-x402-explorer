import assert from 'node:assert/strict';
import test from 'node:test';
import {probeServiceHealth} from '../src/services/health-prober.ts';
import {INITIAL_SERVICES} from '../src/services/sample-services.ts';

test('health probe never substitutes simulated success for failed evidence', async () => {
  const original = globalThis.fetch;
  const service = INITIAL_SERVICES[0];
  try {
    globalThis.fetch = async () => {throw new Error('offline');};
    assert.equal((await probeServiceHealth(service)).status,'down');
    globalThis.fetch = async () => new Response('{}',{status:404});
    assert.equal((await probeServiceHealth(service)).status,'down');
    const live = {kind:'observed',source:'live',serviceName:service.name,
      checkedAt:new Date().toISOString(),endpoint:new URL('/healthz',service.base_url!).href,
      httpStatus:200,network:service.network,asset:'0x38129cf4CE5E183eFF248F42A7D345Bb1B47621A',
      networkMatched:true,assetMatched:true,facilitatorReachable:true};
    for (const change of [{facilitatorReachable:false},{source:'simulated'},{network:undefined}, {asset:undefined}]) {
      globalThis.fetch = async () => Response.json({...live,...change});
      assert.notEqual((await probeServiceHealth(service)).status,'healthy');
    }
    globalThis.fetch = async () => Response.json(live);
    assert.equal((await probeServiceHealth(service)).status,'healthy');
    globalThis.fetch = async () => new Response('invalid JSON');
    assert.equal((await probeServiceHealth(service)).status,'down');
  } finally {globalThis.fetch = original;}
});

test('browser accepts only typed observations for the requested service and endpoint', async () => {
  const original = globalThis.fetch;
  const service = INITIAL_SERVICES[0];
  const observed = {
    kind: 'observed', source: 'live', serviceName: service.name,
    checkedAt: new Date().toISOString(), endpoint: new URL('/healthz', service.base_url!).href,
    httpStatus: 200, network: service.network,
    asset: '0x38129cf4CE5E183eFF248F42A7D345Bb1B47621A',
    networkMatched: true, assetMatched: true, facilitatorReachable: true,
  };
  try {
    globalThis.fetch = async () => Response.json(observed);
    assert.equal((await probeServiceHealth(service)).status, 'healthy');
    for (const change of [
      {kind: undefined}, {serviceName: 'another-service'},
      {endpoint: 'https://different.example/healthz'}, {httpStatus: 503},
      {checkedAt: 'not-a-date'},
    ]) {
      globalThis.fetch = async () => Response.json({...observed, ...change});
      assert.equal((await probeServiceHealth(service)).status, 'down', JSON.stringify(change));
    }
  } finally {
    globalThis.fetch = original;
  }
});
