import test from 'node:test';
import assert from 'node:assert/strict';
const A = '0x1111111111111111111111111111111111111111' as const;
const B = '0x2222222222222222222222222222222222222222' as const;
const C = '0x3333333333333333333333333333333333333333' as const;
import { PaymentStreamingSettlement } from '../src/lib/payment-streaming-settlement.js';

test('stream terms installed after funding are the same terms the verifier checked', () => {
  const params = { id: 'original', sender: A, recipient: B, tokenAddress: C,
    depositAmount: 100n, durationSeconds: 100, now: 1000 };
  const engine = new PaymentStreamingSettlement((checked) => {
    assert.equal(checked.depositAmount, 100n);
    params.id = 'replaced'; params.depositAmount = 900n; params.durationSeconds = 900;
    return true;
  });
  const stream = engine.createStream(params);
  assert.equal(stream.id, 'original');
  assert.equal(stream.depositAmount, 100n);
  assert.equal(stream.stopTime, 1100);
  assert.equal(engine.getStream('original')?.depositAmount, 100n);
});

test('mutating the verifier argument cannot rewrite a valid funded stream', () => {
  const engine = new PaymentStreamingSettlement((checked) => {
    (checked as { depositAmount: bigint }).depositAmount = 999n; return true;
  }, () => true);
  const stream = engine.createStream({ id: 'valid', sender: A, recipient: B, tokenAddress: C,
    depositAmount: 100n, durationSeconds: 100, now: 1000 });
  assert.equal(stream.depositAmount, 100n);
  assert.deepEqual(engine.claim('valid', 50n, 1100), { claimed: 50n, remainingBalance: 50n });
});
