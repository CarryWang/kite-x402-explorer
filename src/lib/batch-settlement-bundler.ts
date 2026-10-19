import { keccak256, stringToHex, isAddress } from 'viem';

export interface BundledReceipt {
  receiptId: string;
  payer: `0x${string}`;
  recipient: `0x${string}`;
  tokenAddress: `0x${string}`;
  amount: bigint;
  nonce: `0x${string}`;
  signature: `0x${string}`;
  timestamp: number;
}

export interface NetBalanceSummary {
  agent: `0x${string}`;
  tokenAddress: `0x${string}`;
  netAmount: bigint; // positive: net recipient (+), negative: net payer (-)
  totalSent: bigint;
  totalReceived: bigint;
}

export interface BilateralNetTransfer {
  payer: `0x${string}`;
  recipient: `0x${string}`;
  amount: bigint;
}

export interface GasSavingsEstimate {
  individualTxEstimatedGas: bigint;
  bundledTxEstimatedGas: bigint;
  gasSavedWei: bigint;
  savingsPercentage: number;
}

export interface SettlementBundle {
  bundleId: string;
  tokenAddress: `0x${string}`;
  receipts: BundledReceipt[];
  receiptCount: number;
  totalVolume: bigint;
  merkleRoot: `0x${string}`;
  netTransfers: BilateralNetTransfer[];
  gasSavings: GasSavingsEstimate;
  status: 'pending' | 'settled' | 'rejected';
  createdAt: number;
  settledAt?: number;
  settlementTxHash?: `0x${string}`;
}

export interface ReceiptInclusionProof {
  receiptId: string;
  receiptHash: `0x${string}`;
  leafIndex: number;
  auditPath: `0x${string}`[];
  merkleRoot: `0x${string}`;
}

/**
 * Computes deterministic cryptographic hash for an individual x402 payment receipt.
 */
export function hashReceipt(receipt: BundledReceipt): `0x${string}` {
  if (!isAddress(receipt.payer)) {
    throw new Error(`Invalid payer address: ${receipt.payer}`);
  }
  if (!isAddress(receipt.recipient)) {
    throw new Error(`Invalid recipient address: ${receipt.recipient}`);
  }
  if (!isAddress(receipt.tokenAddress)) {
    throw new Error(`Invalid token contract address: ${receipt.tokenAddress}`);
  }
  if (receipt.amount <= 0n) {
    throw new Error(`Payment amount must be strictly positive, received ${receipt.amount.toString()}`);
  }
  if (!receipt.nonce || !receipt.nonce.startsWith('0x')) {
    throw new Error(`Invalid receipt nonce format: ${receipt.nonce}`);
  }

  // Canonical payload serialization: payer:recipient:tokenAddress:amount:nonce:timestamp
  const payload = [
    receipt.payer.toLowerCase(),
    receipt.recipient.toLowerCase(),
    receipt.tokenAddress.toLowerCase(),
    receipt.amount.toString(),
    receipt.nonce.toLowerCase(),
    receipt.timestamp.toString(),
  ].join(':');

  return keccak256(stringToHex(payload));
}

/**
 * Combines two 32-byte hashes into a parent Merkle node with lexicographical ordering.
 */
export function combineMerklePair(a: `0x${string}`, b: `0x${string}`): `0x${string}` {
  const [first, second] = a.toLowerCase() < b.toLowerCase() ? [a, b] : [b, a];
  return keccak256(stringToHex(`${first}:${second}`));
}

/**
 * Computes the Merkle root of a sequence of receipt hashes.
 */
export function computeReceiptMerkleRoot(receiptHashes: `0x${string}`[]): `0x${string}` {
  if (receiptHashes.length === 0) {
    throw new Error('Cannot compute Merkle root of an empty receipt list');
  }

  let layer = [...receiptHashes];
  while (layer.length > 1) {
    const nextLayer: `0x${string}`[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      if (i + 1 < layer.length) {
        nextLayer.push(combineMerklePair(layer[i], layer[i + 1]));
      } else {
        // Odd node duplicated to balance the tree
        nextLayer.push(combineMerklePair(layer[i], layer[i]));
      }
    }
    layer = nextLayer;
  }

  return layer[0];
}
