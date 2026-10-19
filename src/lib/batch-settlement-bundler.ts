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
  if (!isAddress(receipt.payer, { strict: false })) {
    throw new Error(`Invalid payer address: ${receipt.payer}`);
  }
  if (!isAddress(receipt.recipient, { strict: false })) {
    throw new Error(`Invalid recipient address: ${receipt.recipient}`);
  }
  if (!isAddress(receipt.tokenAddress, { strict: false })) {
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

/**
 * Calculates net debit/credit balance for each participating agent across all receipts.
 */
export function calculateNetBalances(receipts: BundledReceipt[]): Map<string, NetBalanceSummary> {
  const summaries = new Map<string, NetBalanceSummary>();

  for (const receipt of receipts) {
    const payerKey = receipt.payer.toLowerCase();
    const recipientKey = receipt.recipient.toLowerCase();

    // Initialize payer entry if missing
    if (!summaries.has(payerKey)) {
      summaries.set(payerKey, {
        agent: receipt.payer,
        tokenAddress: receipt.tokenAddress,
        netAmount: 0n,
        totalSent: 0n,
        totalReceived: 0n,
      });
    }

    // Initialize recipient entry if missing
    if (!summaries.has(recipientKey)) {
      summaries.set(recipientKey, {
        agent: receipt.recipient,
        tokenAddress: receipt.tokenAddress,
        netAmount: 0n,
        totalSent: 0n,
        totalReceived: 0n,
      });
    }

    const payer = summaries.get(payerKey)!;
    payer.netAmount -= receipt.amount;
    payer.totalSent += receipt.amount;

    const recipient = summaries.get(recipientKey)!;
    recipient.netAmount += receipt.amount;
    recipient.totalReceived += receipt.amount;
  }

  return summaries;
}

/**
 * Resolves net debit/credit balances into a minimal set of bilateral on-chain transfers.
 * Uses a greedy matching algorithm between debtors and creditors.
 */
export function resolveBilateralNetTransfers(
  netBalances: Map<string, NetBalanceSummary>
): BilateralNetTransfer[] {
  const debtors: { agent: `0x${string}`; balance: bigint }[] = [];
  const creditors: { agent: `0x${string}`; balance: bigint }[] = [];

  for (const summary of netBalances.values()) {
    if (summary.netAmount < 0n) {
      debtors.push({ agent: summary.agent, balance: -summary.netAmount });
    } else if (summary.netAmount > 0n) {
      creditors.push({ agent: summary.agent, balance: summary.netAmount });
    }
  }

  debtors.sort((a, b) => (b.balance > a.balance ? 1 : b.balance < a.balance ? -1 : 0));
  creditors.sort((a, b) => (b.balance > a.balance ? 1 : b.balance < a.balance ? -1 : 0));

  const transfers: BilateralNetTransfer[] = [];
  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];

    const transferAmount = debtor.balance < creditor.balance ? debtor.balance : creditor.balance;
    if (transferAmount > 0n) {
      transfers.push({
        payer: debtor.agent,
        recipient: creditor.agent,
        amount: transferAmount,
      });
    }

    debtor.balance -= transferAmount;
    creditor.balance -= transferAmount;

    if (debtor.balance === 0n) dIdx++;
    if (creditor.balance === 0n) cIdx++;
  }

  return transfers;
}

/**
 * Calculates estimated gas overhead reduction by aggregating receipts into a single batch.
 */
export function computeAmortizedGasSavings(
  receiptCount: number,
  netTransferCount: number,
  baseTxGas: bigint = 21000n,
  perTransferGas: bigint = 65000n
): GasSavingsEstimate {
  // Individual execution: each receipt requires a distinct standard on-chain transfer
  const individualTxEstimatedGas = BigInt(receiptCount) * (baseTxGas + perTransferGas);

  // Bundled execution: single transaction overhead + batched transfer calls + Merkle root commitment
  const merkleRootCommitGas = 20000n;
  const bundledTxEstimatedGas =
    baseTxGas + merkleRootCommitGas + BigInt(netTransferCount) * (perTransferGas / 2n + 5000n);

  const gasSavedWei =
    individualTxEstimatedGas > bundledTxEstimatedGas
      ? individualTxEstimatedGas - bundledTxEstimatedGas
      : 0n;

  const savingsPercentage =
    individualTxEstimatedGas > 0n
      ? Number((gasSavedWei * 10000n) / individualTxEstimatedGas) / 100
      : 0;

  return {
    individualTxEstimatedGas,
    bundledTxEstimatedGas,
    gasSavedWei,
    savingsPercentage,
  };
}

/**
 * Creates and validates an aggregated settlement bundle from individual x402 payment receipts.
 */
export function createSettlementBundle(params: {
  bundleId: string;
  receipts: BundledReceipt[];
  tokenAddress: `0x${string}`;
  baseTxGas?: bigint;
  perTransferGas?: bigint;
}): SettlementBundle {
  const { bundleId, receipts, tokenAddress, baseTxGas, perTransferGas } = params;

  if (!bundleId || bundleId.trim().length === 0) {
    throw new Error('Bundle ID must be a non-empty string');
  }
  if (!isAddress(tokenAddress, { strict: false })) {
    throw new Error(`Invalid bundle token address: ${tokenAddress}`);
  }
  if (!receipts || receipts.length === 0) {
    throw new Error('Cannot create an empty settlement bundle');
  }

  const seenNonces = new Set<string>();
  let totalVolume = 0n;
  const receiptHashes: `0x${string}`[] = [];

  for (const receipt of receipts) {
    if (receipt.tokenAddress.toLowerCase() !== tokenAddress.toLowerCase()) {
      throw new Error(
        `Token mismatch: receipt ${receipt.receiptId} has token ${receipt.tokenAddress}, expected ${tokenAddress}`
      );
    }

    const nonceKey = `${receipt.payer.toLowerCase()}:${receipt.nonce.toLowerCase()}`;
    if (seenNonces.has(nonceKey)) {
      throw new Error(`Duplicate nonce detected within bundle: ${receipt.nonce} for ${receipt.payer}`);
    }
    seenNonces.add(nonceKey);

    const hash = hashReceipt(receipt);
    receiptHashes.push(hash);
    totalVolume += receipt.amount;
  }

  const merkleRoot = computeReceiptMerkleRoot(receiptHashes);
  const netBalances = calculateNetBalances(receipts);
  const netTransfers = resolveBilateralNetTransfers(netBalances);
  const gasSavings = computeAmortizedGasSavings(
    receipts.length,
    netTransfers.length,
    baseTxGas,
    perTransferGas
  );

  return {
    bundleId,
    tokenAddress,
    receipts: [...receipts],
    receiptCount: receipts.length,
    totalVolume,
    merkleRoot,
    netTransfers,
    gasSavings,
    status: 'pending',
    createdAt: Date.now(),
  };
}

/**
 * Generates an inclusion audit proof for a specific receipt within a settlement bundle.
 */
export function generateReceiptProof(
  receiptId: string,
  bundle: SettlementBundle
): ReceiptInclusionProof {
  const targetIndex = bundle.receipts.findIndex((r) => r.receiptId === receiptId);
  if (targetIndex === -1) {
    throw new Error(`Receipt ${receiptId} not found in bundle ${bundle.bundleId}`);
  }

  const receiptHashes = bundle.receipts.map((r) => hashReceipt(r));
  const targetHash = receiptHashes[targetIndex];

  let currentLayer = [...receiptHashes];
  let currentIndex = targetIndex;
  const auditPath: `0x${string}`[] = [];

  while (currentLayer.length > 1) {
    const nextLayer: `0x${string}`[] = [];
    const isOddIndex = currentIndex % 2 === 1;
    const siblingIndex = isOddIndex ? currentIndex - 1 : currentIndex + 1;

    if (siblingIndex < currentLayer.length) {
      auditPath.push(currentLayer[siblingIndex]);
    } else {
      // Duplicated odd leaf
      auditPath.push(currentLayer[currentIndex]);
    }

    for (let i = 0; i < currentLayer.length; i += 2) {
      if (i + 1 < currentLayer.length) {
        nextLayer.push(combineMerklePair(currentLayer[i], currentLayer[i + 1]));
      } else {
        nextLayer.push(combineMerklePair(currentLayer[i], currentLayer[i]));
      }
    }

    currentIndex = Math.floor(currentIndex / 2);
    currentLayer = nextLayer;
  }

  return {
    receiptId,
    receiptHash: targetHash,
    leafIndex: targetIndex,
    auditPath,
    merkleRoot: bundle.merkleRoot,
  };
}

/**
 * Verifies cryptographic Merkle inclusion of a receipt proof against the recorded root.
 */
export function verifyReceiptInclusionProof(proof: ReceiptInclusionProof): boolean {
  let current = proof.receiptHash;

  for (const sibling of proof.auditPath) {
    current = combineMerklePair(current, sibling);
  }

  return current.toLowerCase() === proof.merkleRoot.toLowerCase();
}

/**
 * Executes on-chain settlement transition for a bundle, asserting zero replay against existing settled nonces.
 */
export function executeSettlementBundle(
  bundle: SettlementBundle,
  txHash: `0x${string}`,
  settledNonceRegistry: Set<string>
): { settledBundle: SettlementBundle; newlySettledNonces: string[] } {
  if (bundle.status !== 'pending') {
    throw new Error(`Cannot settle bundle ${bundle.bundleId} with current status: ${bundle.status}`);
  }
  if (!txHash || !txHash.startsWith('0x') || txHash.length !== 66) {
    throw new Error(`Invalid settlement transaction hash: ${txHash}`);
  }

  const newlySettledNonces: string[] = [];

  for (const receipt of bundle.receipts) {
    const scopedKey = `${receipt.payer.toLowerCase()}:${receipt.tokenAddress.toLowerCase()}:${receipt.nonce.toLowerCase()}`;
    if (settledNonceRegistry.has(scopedKey)) {
      throw new Error(
        `Settlement replay detected: nonce ${receipt.nonce} already finalized on-chain for payer ${receipt.payer}`
      );
    }
    newlySettledNonces.push(scopedKey);
  }

  const settledBundle: SettlementBundle = {
    ...bundle,
    status: 'settled',
    settlementTxHash: txHash,
    settledAt: Date.now(),
  };

  return {
    settledBundle,
    newlySettledNonces,
  };
}


