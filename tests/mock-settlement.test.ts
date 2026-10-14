import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMockSettlement } from '../server/mock-settlement.ts';

test('mock settlement data never claims an on-chain transaction', () => {
  const settlement = buildMockSettlement();
  assert.equal(settlement.settledOnChain, false);
  assert.equal(settlement.simulated, true);
  assert.equal('txHash' in settlement, false);
});
