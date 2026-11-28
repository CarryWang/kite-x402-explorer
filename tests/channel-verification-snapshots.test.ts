import test from 'node:test';
import assert from 'node:assert/strict';
const A = '0x1111111111111111111111111111111111111111' as const;
const B = '0x2222222222222222222222222222222222222222' as const;
const C = '0x3333333333333333333333333333333333333333' as const;
import { openStateChannel, updateChannelState, generateCloseProof } from '../src/lib/p2p-state-channel.js';

test('funding verification cannot install a later-mutated deposit', () => {
  const params = { sender: A, receiver: B, depositAmountWei: 100n, timestamp: 1000 };
  const channel = openStateChannel(params, () => { params.depositAmountWei = 900n; return true; });
  assert.equal(channel.depositAmountWei, 100n);
});

test('a close verifier cannot replace the amount used for the final payment and refund', () => {
  const opened = openStateChannel({ sender: A, receiver: B, depositAmountWei: 100n }, () => true);
  const { channel, update } = updateChannelState(opened, 40n);
  const closed = generateCloseProof(channel, update, (checkedChannel, checkedUpdate) => {
    checkedChannel.depositAmountWei = 1n;
    checkedUpdate.transferredAmountWei = 999n;
    return true;
  });
  assert.equal(closed.paymentToReceiverWei, 40n);
  assert.equal(closed.refundToSenderWei, 60n);
  assert.equal(closed.stateDigest, update.digest);
});
