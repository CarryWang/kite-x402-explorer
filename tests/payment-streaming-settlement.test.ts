import { describe, it, expect } from './vitest-compat.js';
import { PaymentStreamingSettlement } from '../src/lib/payment-streaming-settlement';

describe('PaymentStreamingSettlement', () => {
  const engine = new PaymentStreamingSettlement(() => true, () => true);

  it('creates active streaming channel and computes vesting linearly', () => {
    const stream = engine.createStream({
      id: 'stream-1',
      sender: '0xSender',
      recipient: '0xRecipient',
      tokenAddress: '0xUSDT',
      depositAmount: 1000n,
      durationSeconds: 100,
      now: 1000,
    });

    expect(stream.isActive).toBe(true);
    expect(engine.calculateAvailableBalance('stream-1', 1050)).toBe(500n);
    expect(engine.calculateAvailableBalance('stream-1', 1100)).toBe(1000n);
  });

  it('allows recipient to claim accrued balance', () => {
    const res = engine.claim('stream-1', 400n, 1050);
    expect(res.claimed).toBe(400n);
    expect(res.remainingBalance).toBe(600n);
  });

  it('rejects negative claims that would increase escrow balance', () => {
    expect(() => engine.claim('stream-1', -1n, 1100)).toThrow(/positive/);
    expect(engine.calculateAvailableBalance('stream-1', 1100)).toBe(600n);
  });

  it('rejects a future time supplied to accelerate vesting', () => {
    const future = Math.floor(Date.now() / 1000) + 3600;
    expect(() => engine.claim('stream-1', 1n, future)).toThrow(/future/);
  });

  it('requires explicit deposit and claim verification', () => {
    const unverified = new PaymentStreamingSettlement();
    expect(() => unverified.createStream({ id: 'unverified', sender: 'a', recipient: 'b', tokenAddress: 't', depositAmount: 10n, durationSeconds: 10, now: 1000 })).toThrow(/verification/);
    const noClaimVerifier = new PaymentStreamingSettlement(() => true);
    noClaimVerifier.createStream({ id: 'unverified', sender: 'a', recipient: 'b', tokenAddress: 't', depositAmount: 10n, durationSeconds: 10, now: 1000 });
    expect(() => noClaimVerifier.claim('unverified', 1n, 1010)).toThrow(/verification/);
  });

  it('blocks a reentrant claim from the verification callback', () => {
    let entered = false;
    const guarded = new PaymentStreamingSettlement(() => true, (stream) => {
      if (!entered) {
        entered = true;
        expect(() => guarded.claim(stream.id, 10n, 1010)).toThrow(/progress/);
      }
      return true;
    });
    guarded.createStream({ id: 'reentrant', sender: 'a', recipient: 'b', tokenAddress: 't', depositAmount: 10n, durationSeconds: 10, now: 1000 });
    guarded.claim('reentrant', 10n, 1010);
    expect(guarded.getStream('reentrant')?.claimedAmount).toBe(10n);
  });
});
