import assert from 'node:assert/strict';
export { describe, it } from 'node:test';

// Run contributed Vitest-style assertions with this repository's Node test runner.
export function expect(actual: unknown) {
  return {
    toBe(expected: unknown) { assert.strictEqual(actual, expected); },
    toBeDefined() { assert.notStrictEqual(actual, undefined); },
    toBeUndefined() { assert.strictEqual(actual, undefined); },
    toMatch(pattern: RegExp) { assert.match(String(actual), pattern); },
    toContain(expected: unknown) {
      assert.ok(typeof actual === 'string' ? actual.includes(String(expected)) : Array.isArray(actual) && actual.includes(expected));
    },
    toBeGreaterThan(expected: number | bigint) { assert.ok((actual as number | bigint) > expected); },
    toBeGreaterThanOrEqual(expected: number | bigint) { assert.ok((actual as number | bigint) >= expected); },
    toBeLessThan(expected: number | bigint) { assert.ok((actual as number | bigint) < expected); },
    toBeLessThanOrEqual(expected: number | bigint) { assert.ok((actual as number | bigint) <= expected); },
    toThrow(expected?: string | RegExp) {
      assert.equal(typeof actual, 'function');
      assert.throws(actual as () => unknown, expected instanceof RegExp ? expected : expected ? new RegExp(expected) : undefined);
    },
  };
}
