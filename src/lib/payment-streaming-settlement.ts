/**
 * Payment Streaming Settlement Engine
 * Handles continuous micro-payment streams, linear token release, and escrow settlement.
 */

export interface StreamChannel {
  id: string;
  sender: string;
  recipient: string;
  tokenAddress: string;
  depositAmount: bigint;
  startTime: number;
  stopTime: number;
  claimedAmount: bigint;
  isActive: boolean;
}

export class PaymentStreamingSettlement {
  private streams: Map<string, StreamChannel> = new Map();

  public createStream(params: {
    id: string;
    sender: string;
    recipient: string;
    tokenAddress: string;
    depositAmount: bigint;
    durationSeconds: number;
    now?: number;
  }): StreamChannel {
    if (this.streams.has(params.id)) {
      throw new Error('Stream channel already exists');
    }
    if (params.depositAmount <= 0n) {
      throw new Error('Deposit amount must be positive');
    }
    if (params.durationSeconds <= 0) {
      throw new Error('Duration must be positive');
    }

    const startTime = params.now ?? Math.floor(Date.now() / 1000);
    const stopTime = startTime + params.durationSeconds;

    const stream: StreamChannel = {
      id: params.id,
      sender: params.sender.toLowerCase(),
      recipient: params.recipient.toLowerCase(),
      tokenAddress: params.tokenAddress.toLowerCase(),
      depositAmount: params.depositAmount,
      startTime,
      stopTime,
      claimedAmount: 0n,
      isActive: true,
    };

    this.streams.set(stream.id, stream);
    return stream;
  }

  public getStream(id: string): StreamChannel | undefined {
    return this.streams.get(id);
  }

  public calculateAvailableBalance(id: string, nowSeconds?: number): bigint {
    const stream = this.streams.get(id);
    if (!stream || !stream.isActive) return 0n;

    const now = nowSeconds ?? Math.floor(Date.now() / 1000);
    if (now <= stream.startTime) return 0n;

    if (now >= stream.stopTime) {
      return stream.depositAmount - stream.claimedAmount;
    }

    const elapsed = BigInt(now - stream.startTime);
    const totalDuration = BigInt(stream.stopTime - stream.startTime);
    const totalVested = (stream.depositAmount * elapsed) / totalDuration;

    return totalVested > stream.claimedAmount ? totalVested - stream.claimedAmount : 0n;
  }

  public claim(id: string, amount: bigint, nowSeconds?: number): { claimed: bigint; remainingBalance: bigint } {
    const stream = this.streams.get(id);
    if (!stream) throw new Error('Stream not found');
    if (!stream.isActive) throw new Error('Stream is closed');

    const available = this.calculateAvailableBalance(id, nowSeconds);
    if (amount > available) {
      throw new Error('Insufficient claimable balance');
    }

    stream.claimedAmount += amount;
    const remainingBalance = stream.depositAmount - stream.claimedAmount;

    if (remainingBalance === 0n) {
      stream.isActive = false;
    }

    return { claimed: amount, remainingBalance };
  }
}
