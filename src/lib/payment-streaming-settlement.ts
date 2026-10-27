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
  private claimsInProgress: Set<string> = new Set();

  constructor(
    private readonly verifyDeposit?: (params: Readonly<{
      id: string; sender: string; recipient: string; tokenAddress: string;
      depositAmount: bigint; durationSeconds: number; now?: number;
    }>) => boolean,
    private readonly verifyClaim?: (stream: Readonly<StreamChannel>, amount: bigint) => boolean
  ) {}

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
    if (!Number.isSafeInteger(startTime) || !Number.isSafeInteger(params.durationSeconds) || startTime > Math.floor(Date.now() / 1000)) {
      throw new Error('Stream time must be valid and cannot be in the future');
    }
    if (!this.verifyDeposit || !this.verifyDeposit({ ...params })) {
      throw new Error('Stream deposit verification failed');
    }
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
    return { ...stream };
  }

  public getStream(id: string): StreamChannel | undefined {
    const stream = this.streams.get(id);
    return stream && { ...stream };
  }

  public calculateAvailableBalance(id: string, nowSeconds?: number): bigint {
    const stream = this.streams.get(id);
    if (!stream || !stream.isActive) return 0n;

    const now = nowSeconds ?? Math.floor(Date.now() / 1000);
    if (!Number.isSafeInteger(now) || now > Math.floor(Date.now() / 1000)) {
      throw new Error('Claim time cannot be in the future');
    }
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
    if (this.claimsInProgress.has(id)) throw new Error('Stream claim already in progress');
    if (amount <= 0n) throw new Error('Claim amount must be positive');

    const available = this.calculateAvailableBalance(id, nowSeconds);
    if (amount > available) {
      throw new Error('Insufficient claimable balance');
    }
    this.claimsInProgress.add(id);
    try {
      if (!this.verifyClaim || !this.verifyClaim({ ...stream }, amount)) {
        throw new Error('Stream claim verification failed');
      }

      stream.claimedAmount += amount;
      const remainingBalance = stream.depositAmount - stream.claimedAmount;

      if (remainingBalance === 0n) {
        stream.isActive = false;
      }

      return { claimed: amount, remainingBalance };
    } finally {
      this.claimsInProgress.delete(id);
    }
  }
}
