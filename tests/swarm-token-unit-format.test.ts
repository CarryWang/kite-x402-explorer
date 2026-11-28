import test from 'node:test';
import assert from 'node:assert/strict';
const A = '0x1111111111111111111111111111111111111111' as const;
const B = '0x2222222222222222222222222222222222222222' as const;
const C = '0x3333333333333333333333333333333333333333' as const;
import { calculateSwarmBountySplit } from '../src/lib/swarm-budget-allocator.js';
const allocations = [{ agentRole: 'coordinator' as const, weightBps: 10000, assignedAddress: A }];

test('high-decimal token formatting uses an exact denominator rather than a rounded Number', () => {
  const result = calculateSwarmBountySplit(10n ** 24n - 1n, allocations, 24);
  assert.equal(result.isValid, true);
  assert.equal(result.shares[0].shareFormatted, '0.9999');
  assert.equal(result.shares[0].shareUnits, 10n ** 24n - 1n);
});

test('invalid ERC-20 decimal metadata returns an invalid result without throwing', () => {
  for (const decimals of [NaN, Infinity, -1, 0.5, 256]) {
    let result: ReturnType<typeof calculateSwarmBountySplit>;
    assert.doesNotThrow(() => { result = calculateSwarmBountySplit(100n, allocations, decimals); });
    assert.equal(result!.isValid, false);
    assert.deepEqual(result!.shares, []);
  }
});

test('zero, six and eighteen decimals preserve exact displayed units', () => {
  assert.equal(calculateSwarmBountySplit(123n, allocations, 0).shares[0].shareFormatted, '123');
  for (const decimals of [6, 18]) assert.equal(calculateSwarmBountySplit(10n ** BigInt(decimals), allocations, decimals).shares[0].shareFormatted, '1.0000');
});
