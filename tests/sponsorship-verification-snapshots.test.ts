import test from 'node:test';
import assert from 'node:assert/strict';
const A = '0x1111111111111111111111111111111111111111' as const;
const B = '0x2222222222222222222222222222222222222222' as const;
const C = '0x3333333333333333333333333333333333333333' as const;
import { createPaymasterPool, depositGasToPool, executeSponsoredRelay } from '../src/lib/gasless-paymaster-relay.js';

function params() { return { poolId: 'local', sponsor: A, initialDepositWei: 100n,
  policy: { maxGasLimitPerTx: 100n, allowedTokens: [C], dailyAgentGasCapWei: 1000n } }; }
function pool() { return createPaymasterPool(params(), () => true); }

test('pool funding installs the verified amount rather than a callback replacement', () => {
  const input = params();
  const created = createPaymasterPool(input, () => { input.initialDepositWei = 999n; return true; });
  assert.equal(created.balanceWei, 100n);
});

test('relay verification cannot increase checked gas cost or replace its nonce', () => {
  const before = pool();
  const request = { agent: B, token: C, amount: 1n, estimatedGas: 10n, nonce: 'original', signature: 'local-unverified' };
  const { updatedPool, receipt } = executeSponsoredRelay(before, request, 1n, (checkedPool, checkedRequest) => {
    checkedPool.balanceWei = 0n;
    checkedRequest.estimatedGas = 1000n;
    checkedRequest.nonce = 'replaced';
    return true;
  });
  assert.equal(receipt.totalCostWei, 10n);
  assert.equal(updatedPool.balanceWei, 90n);
  assert.equal(before.balanceWei, 100n);
  assert.equal(updatedPool.consumedNonces.has(B + ':original'), true);
});

test('deposit verification does not mutate the prior pool or change its credited base', () => {
  const before = pool();
  const next = depositGasToPool(before, 10n, (checked) => { checked.balanceWei = 999n; return true; });
  assert.equal(before.balanceWei, 100n);
  assert.equal(next.balanceWei, 110n);
});
