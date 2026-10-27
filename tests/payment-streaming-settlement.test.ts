import { describe, it, expect } from 'vitest';
import { PaymentStreamingSettlement } from '../src/lib/payment-streaming-settlement';

describe('PaymentStreamingSettlement', () => {
  const engine = new PaymentStreamingSettlement();

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
});
