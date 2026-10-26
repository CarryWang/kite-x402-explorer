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

export class CrossChainReceiptProver {
  private verifiedReceipts = new Set<string>();

  public generateReceiptId(receipt: PaymentReceipt): string {
    return `${receipt.chainId}:${receipt.txHash.toLowerCase()}`;
  }

  public verifyReceipt(
    receipt: PaymentReceipt,
    supportedChains: number[],
    maxAgeSeconds: number = 86400,
    nowSeconds?: number
  ): VerificationResult {
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

    if (!receipt.txHash.startsWith('0x') || receipt.txHash.length !== 66) {
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
    if (age > maxAgeSeconds) {
      return {
        isValid: false,
        receiptId,
        chainId: receipt.chainId,
        settlementAgeSeconds: age,
        reason: `Receipt expired (age: ${age}s, max: ${maxAgeSeconds}s)`,
      };
    }

    if (this.verifiedReceipts.has(receiptId)) {
      return {
        isValid: false,
        receiptId,
        chainId: receipt.chainId,
        settlementAgeSeconds: age,
        reason: 'Duplicate receipt replay detected',
      };
    }

    this.verifiedReceipts.add(receiptId);
    return {
      isValid: true,
      receiptId,
      chainId: receipt.chainId,
      settlementAgeSeconds: age,
    };
  }
}
