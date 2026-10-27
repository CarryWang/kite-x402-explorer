import { describe, expect, it } from 'vitest';
import {
  openStateChannel,
  updateChannelState,
  generateCloseProof,
  initiateChannelClose,
} from '../src/lib/p2p-state-channel';

describe('p2p-state-channel', () => {
  const sender = '0x1111111111111111111111111111111111111111' as const;
  const receiver = '0x2222222222222222222222222222222222222222' as const;

  it('opens a state channel with initial deposit', () => {
    const channel = openStateChannel({
      sender,
      receiver,
      depositAmountWei: 1_000_000_000n, // 1000 USDC
      challengePeriodSeconds: 3600,
      timestamp: 1000,
    });

    expect(channel.channelId).toMatch(/^channel-[a-f0-9]{12}$/);
    expect(channel.status).toBe('open');
    expect(channel.depositAmountWei).toBe(1_000_000_000n);
    expect(channel.currentNonce).toBe(0n);
    expect(channel.settledAmountWei).toBe(0n);
  });

  it('updates channel state monotonically', () => {
    let channel = openStateChannel({
      sender,
      receiver,
      depositAmountWei: 500_000_000n,
    });

    // 1st micropayment: 50 USDC
    const res1 = updateChannelState(channel, 50_000_000n);
    channel = res1.channel;
    expect(channel.currentNonce).toBe(1n);
    expect(channel.settledAmountWei).toBe(50_000_000n);
    expect(res1.update.digest).toMatch(/^0x[a-f0-9]{64}$/);

    // 2nd micropayment: cumulative 120 USDC
    const res2 = updateChannelState(channel, 120_000_000n);
    channel = res2.channel;
    expect(channel.currentNonce).toBe(2n);
    expect(channel.settledAmountWei).toBe(120_000_000n);

    // Decreasing transfer amount should throw
    expect(() => updateChannelState(channel, 100_000_000n)).toThrow(
      /monotonically increasing/,
    );
  });

  it('generates accurate closing proof and splits collateral', () => {
    let channel = openStateChannel({
      sender,
      receiver,
      depositAmountWei: 1_000_000_000n, // 1000 USDC
    });

    const { channel: updatedChannel, update } = updateChannelState(channel, 400_000_000n);
    const proof = generateCloseProof(updatedChannel, update);

    expect(proof.finalNonce).toBe(1n);
    expect(proof.paymentToReceiverWei).toBe(400_000_000n); // 400 USDC to receiver
    expect(proof.refundToSenderWei).toBe(600_000_000n); // 600 USDC refund to sender
    expect(proof.stateDigest).toBe(update.digest);
  });

  it('initiates challenge period closure', () => {
    const channel = openStateChannel({
      sender,
      receiver,
      depositAmountWei: 100_000_000n,
      challengePeriodSeconds: 1800,
      timestamp: 1000,
    });

    const closing = initiateChannelClose(channel, 1500);
    expect(closing.status).toBe('closing');
    expect(closing.closingDeadline).toBe(1500 + 1800 * 1000);
  });
});
