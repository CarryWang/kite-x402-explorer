import test from 'node:test';
import assert from 'node:assert/strict';
const A = '0x1111111111111111111111111111111111111111' as const;
const B = '0x2222222222222222222222222222222222222222' as const;
const C = '0x3333333333333333333333333333333333333333' as const;
import { openStreamChannel, allocateStreamTicket, closeOrSettleChannel } from '../src/lib/stream-channel-router.js';

test('settlement cannot reopen or settle a stream after its terminal close', () => {
  const opened = openStreamChannel('local', A, B, 100n);
  const active = allocateStreamTicket(opened, 50n).channel;
  const closed = closeOrSettleChannel(active, true).channel;
  assert.throws(() => closeOrSettleChannel(closed), /closed|open|terminal/i);
  assert.throws(() => closeOrSettleChannel(closed, true), /closed|open|terminal/i);
  assert.equal(closed.isOpen, false);
});

test('a nonterminal checkpoint keeps the stream open and preserves nonce progression', () => {
  const active = allocateStreamTicket(openStreamChannel('local', A, B, 100n), 50n).channel;
  const checkpoint = closeOrSettleChannel(active);
  assert.equal(checkpoint.settlement.totalSettledWei, 50n);
  assert.equal(checkpoint.channel.isOpen, true);
  assert.equal(allocateStreamTicket(checkpoint.channel, 10n).ticket.sequenceNonce, 2);
});
