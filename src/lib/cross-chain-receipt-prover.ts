/**
 * Cross-Chain Payment Receipt Prover
 * Validates cryptographic receipts, transaction proofs, and multi-network settlement states.
 */

export interface PaymentReceipt {
  chainId: number;
  txHash: string;
  blockNumber: number;
  payer: string;
  recipient: string;
  amount: bigint;
  tokenAddress: string;
  timestamp: number;
}

export interface VerificationResult {
  isValid: boolean;
  receiptId: string;
  chainId: number;
  settlementAgeSeconds: number;
  reason?: string;
}

/** Implement with an authenticated chain RPC and finalized transaction/log lookup. */
export interface TrustedReceiptReader {
  readConfirmedReceipt(receipt: PaymentReceipt): Promise<PaymentReceipt | null>;
}

/** claim must atomically persist the ID and return false if already claimed. */
export interface ReceiptReplayStore {
  claim(receiptId: string): Promise<boolean>;
}

export class CrossChainReceiptProver {
  constructor(
    private readonly reader: TrustedReceiptReader,
    private readonly replayStore: ReceiptReplayStore
  ) {}

  public generateReceiptId(receipt: PaymentReceipt): string {
    return `${receipt.chainId}:${receipt.txHash.toLowerCase()}`;
  }

  public async verifyReceipt(
    receipt: PaymentReceipt,
    supportedChains: number[],
    maxAgeSeconds: number = 86400,
    nowSeconds?: number
  ): Promise<VerificationResult> {
    const receiptId = this.generateReceiptId(receipt);
    const now = nowSeconds ?? Math.floor(Date.now() / 1000);

    if (!supportedChains.includes(receipt.chainId)) {
      return {
        isValid: false,
        receiptId,
        chainId: receipt.chainId,
        settlementAgeSeconds: 0,
        reason: `Unsupported chain ID: ${receipt.chainId}`,
      };
    }

    if (!/^0x[0-9a-fA-F]{64}$/.test(receipt.txHash)) {
      return {
        isValid: false,
        receiptId,
        chainId: receipt.chainId,
        settlementAgeSeconds: 0,
        reason: 'Invalid transaction hash format',
      };
    }

    if (receipt.amount <= 0n) {
      return {
        isValid: false,
        receiptId,
        chainId: receipt.chainId,
        settlementAgeSeconds: 0,
        reason: 'Payment amount must be greater than zero',
      };
    }

    const age = now - receipt.timestamp;
    if (!Number.isSafeInteger(receipt.blockNumber) || receipt.blockNumber < 0 ||
      !Number.isSafeInteger(receipt.timestamp) || age < 0 || age > maxAgeSeconds ||
      !Number.isFinite(maxAgeSeconds) || maxAgeSeconds < 0) {
      return {
        isValid: false,
        receiptId,
        chainId: receipt.chainId,
        settlementAgeSeconds: age,
        reason: 'Receipt timestamp or age is invalid',
      };
    }

    let confirmed: PaymentReceipt | null = null;
    try {
      confirmed = await this.reader?.readConfirmedReceipt(receipt);
    } catch {
      // A failed chain query cannot establish settlement.
    }
    const same = confirmed && confirmed.chainId === receipt.chainId &&
      confirmed.txHash.toLowerCase() === receipt.txHash.toLowerCase() &&
      confirmed.blockNumber === receipt.blockNumber && confirmed.timestamp === receipt.timestamp &&
      confirmed.payer.toLowerCase() === receipt.payer.toLowerCase() &&
      confirmed.recipient.toLowerCase() === receipt.recipient.toLowerCase() &&
      confirmed.tokenAddress.toLowerCase() === receipt.tokenAddress.toLowerCase() &&
      confirmed.amount === receipt.amount;
    if (!same) {
      return {
        isValid: false,
        receiptId,
        chainId: receipt.chainId,
        settlementAgeSeconds: age,
        reason: 'No matching confirmed on-chain payment',
      };
    }

    let claimed = false;
    try {
      claimed = await this.replayStore?.claim(receiptId) === true;
    } catch {
      // A failed replay store cannot establish uniqueness.
    }
    if (!claimed) {
      return {
        isValid: false, receiptId, chainId: receipt.chainId,
        settlementAgeSeconds: age, reason: 'Duplicate receipt or replay store unavailable',
      };
    }
    return {
      isValid: true,
      receiptId,
      chainId: receipt.chainId,
      settlementAgeSeconds: age,
    };
  }
}
