import test from 'node:test';
import assert from 'node:assert/strict';
const A = '0x1111111111111111111111111111111111111111' as const;
const B = '0x2222222222222222222222222222222222222222' as const;
const C = '0x3333333333333333333333333333333333333333' as const;
import { createBridgeIntent, attestBridgeFulfillment } from '../src/lib/cross-chain-settlement-bridge.js';

test('verified bridge settlement retains the destination evidence checked before the callback', () => {
  const intent = createBridgeIntent({ sourceChainId: 1, sourceToken: C, sourceAmountWei: 1000n,
    destinationRecipient: B, timestamp: 1000 });
  const tx = ('0x' + 'ab'.repeat(32)) as `0x${string}`;
  const proof = { relayerAddress: A, destinationTxHash: tx, destinationChainId: 2368,
    destinationRecipient: B, destinationAmountWei: 1000n, timestamp: 1001 };
  const settled = attestBridgeFulfillment(intent, proof, (checkedIntent, checkedProof) => {
    checkedIntent.destinationRecipient = A;
    checkedProof.destinationTxHash = '0x00';
    return true;
  });
  assert.equal(settled.status, 'settled');
  assert.equal(settled.destinationRecipient, B);
  assert.equal(settled.destinationTxHash, tx);
  assert.equal(intent.status, 'pending');
});

test('closure mutation cannot replace the original fulfilled intent identity', () => {
  const intent = createBridgeIntent({ sourceChainId: 1, sourceToken: C, sourceAmountWei: 1000n,
    destinationRecipient: B, timestamp: 1000 });
  const id = intent.intentId;
  const settled = attestBridgeFulfillment(intent, { relayerAddress: A,
    destinationTxHash: ('0x' + 'ab'.repeat(32)) as `0x${string}`, destinationChainId: 2368,
    destinationRecipient: B, destinationAmountWei: 1000n, timestamp: 1001 }, () => {
      intent.intentId = 'replacement'; return true;
    });
  assert.equal(settled.intentId, id);
});
