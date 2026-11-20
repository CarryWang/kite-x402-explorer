import assert from 'node:assert/strict';
import test from 'node:test';
import {batchProbeServices, probeServiceHealth} from '../src/services/health-prober.ts';
import {INITIAL_SERVICES} from '../src/services/sample-services.ts';

test('health probe never substitutes simulated success for failed evidence', async () => {
  const original = globalThis.fetch;
  const service = INITIAL_SERVICES[0];
  try {
    globalThis.fetch = async () => {throw new Error('offline');};
    assert.equal((await probeServiceHealth(service)).status,'down');
    globalThis.fetch = async () => new Response('{}',{status:404});
    assert.equal((await probeServiceHealth(service)).status,'down');
    const live = {source:'live',network:service.network,asset:'0x38129cf4CE5E183eFF248F42A7D345Bb1B47621A',
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

test('HTTP probe failures preserve status without requiring a JSON body', async () => {
  const original = globalThis.fetch;
  try {
    for (const [status, body] of [[502, '<html>Bad Gateway</html>'], [503, '']] as const) {
      globalThis.fetch = async () => new Response(body, {status});
      const result = await probeServiceHealth(INITIAL_SERVICES[0]);
      assert.equal(result.status, 'down');
      assert.equal(result.httpStatus, status);
      assert.equal(result.details, 'Probe failed with HTTP ' + status);
      assert.equal(result.facilitatorReachable, false);
    }
  } finally {globalThis.fetch = original;}
});

test('an invalid service URL does not discard other batch probe results', async () => {
  const original = globalThis.fetch;
  const valid = INITIAL_SERVICES[0];
  const invalid = {...valid, name: 'invalid-url-service', base_url: 'not a URL'};
  const calls: string[] = [];
  try {
    globalThis.fetch = async (input) => {
      calls.push(String(input));
      return new Response('', {status: 503});
    };
    const results = await batchProbeServices([invalid, valid]);
    assert.deepEqual(Object.keys(results).sort(), [invalid.name, valid.name].sort());
    assert.equal(results[invalid.name].status, 'down');
    assert.equal(results[invalid.name].httpStatus, null);
    assert.equal(results[valid.name].httpStatus, 503);
    assert.deepEqual(calls, ['/api/probe/' + encodeURIComponent(valid.name)]);
  } finally {globalThis.fetch = original;}
});
