import test from 'node:test';
import assert from 'node:assert/strict';
const A = '0x1111111111111111111111111111111111111111' as const;
const B = '0x2222222222222222222222222222222222222222' as const;
const C = '0x3333333333333333333333333333333333333333' as const;
import { routeComputeRequest } from '../src/lib/compute-tier-router.js';

function request(promptTokens: number, maxCompletionTokens: number) { return {
  requestId: 'local', payer: A, promptTokens, maxCompletionTokens,
  maxBudgetUnits: 1000000000000000n, preferredTier: 'nano' as const, network: 'eip155:2368' as const,
}; }

test('completion tokens must fit alongside the prompt in the selected model context', () => {
  assert.equal(routeComputeRequest(request(8192, 1)).isRoutable, false);
  assert.equal(routeComputeRequest(request(8191, 2)).isRoutable, false);
});

test('exact context capacity and zero-completion requests retain compatible nano routing', () => {
  for (const [prompt, completion] of [[8191, 1], [8192, 0]]) {
    const result = routeComputeRequest(request(prompt, completion));
    assert.equal(result.isRoutable, true);
    assert.equal(result.selectedTier, 'nano');
  }
});
