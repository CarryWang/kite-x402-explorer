import test from 'node:test';
import assert from 'node:assert/strict';
const A = '0x1111111111111111111111111111111111111111' as const;
const B = '0x2222222222222222222222222222222222222222' as const;
const C = '0x3333333333333333333333333333333333333333' as const;
import { evaluateEndpointProbe } from '../src/lib/multicall-health-aggregator.js';
const target = { serviceName: 'local', endpointPath: '/v1/task', url: 'https://service.example/v1/task' };

test('an explicit expected HTTP status cannot be replaced by a different successful status', () => {
  for (const expectedStatus of [204, 402]) {
    assert.notEqual(evaluateEndpointProbe({ ...target, expectedStatus }, 10, 200, true).status, 'healthy');
  }
});

test('matching 402 still requires its payment header and default success behavior remains', () => {
  assert.equal(evaluateEndpointProbe({ ...target, expectedStatus: 204 }, 10, 204, false).status, 'healthy');
  assert.equal(evaluateEndpointProbe({ ...target, expectedStatus: 402 }, 10, 402, true).status, 'healthy');
  assert.notEqual(evaluateEndpointProbe({ ...target, expectedStatus: 402 }, 10, 402, false).status, 'healthy');
  assert.equal(evaluateEndpointProbe(target, 10, 200, false).status, 'healthy');
});
