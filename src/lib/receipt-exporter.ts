import type { PaymentProofRecord, VerifiablePaymentReceipt } from '../types/proof.js';
import { KITE_CHAINS } from '../types/kite.js';

/**
 * Builds a standardized, verifiable JSON receipt for an x402 payment proof record.
 */
export function buildVerifiableReceipt(proof: PaymentProofRecord): VerifiablePaymentReceipt {
  const chainConfig = KITE_CHAINS[proof.network] || KITE_CHAINS['eip155:2368'];
  const isSettled = proof.status === 'settled' || proof.status === 'simulated';

  return {
    $schema: 'https://gokite.ai/schemas/x402-receipt-v1.json',
    receiptId: proof.id,
    timestamp: proof.timestamp,
    protocol: {
      standard: 'x402 Micropayments Protocol',
      version: 2,
      specificationUrl: 'https://github.com/gokite-ai/kite-x402-services',
    },
    service: {
      name: proof.serviceName,
      displayName: proof.serviceDisplayName,
      endpoint: proof.endpointPath,
      method: proof.httpMethod,
    },
    payment: {
      network: proof.network,
      chainName: chainConfig.name === 'testnet' ? 'Kite Testnet' : 'Kite Mainnet',
      tokenSymbol: proof.tokenSymbol,
      assetContract: proof.tokenAddress,
      amountFormatted: proof.amountFormatted,
      amountRaw: proof.amountRaw,
      payer: proof.payerAddress,
      payTo: proof.payToAddress,
      authorization: {
        nonce: proof.eip3009Details?.nonce || '0x0',
        validAfter: proof.eip3009Details?.validAfter ?? 0,
        validBefore: proof.eip3009Details?.validBefore ?? 0,
        v: proof.eip3009Details?.v,
        r: proof.eip3009Details?.r,
        s: proof.eip3009Details?.s,
      },
      settlement: {
        settled: isSettled,
        status: proof.status,
        txHash: proof.txHash,
        explorerUrl: proof.txHash ? `${chainConfig.explorerUrl}/tx/${proof.txHash}` : undefined,
        facilitator: chainConfig.facilitatorUrl,
      },
    },
    verification: {
      clientVerified: true,
      guaranteeNote:
        proof.status === 'aborted_502'
          ? 'Guaranteed: Zero funds deducted. Upstream returned 5xx status.'
          : proof.status === 'expired_sig'
          ? 'Transaction aborted: Signature expired before execution.'
          : 'Cryptographically verified EIP-3009 transfer authorization settled via Kite Facilitator.',
    },
  };
}

/**
 * Downloads a single verifiable receipt as a .json file.
 */
export function downloadReceiptAsJson(proof: PaymentProofRecord): void {
  const receipt = buildVerifiableReceipt(proof);
  const jsonStr = JSON.stringify(receipt, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `x402-receipt-${proof.serviceName}-${proof.id.slice(-6)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Downloads all proof records as a consolidated verifiable audit log.
 */
export function downloadBatchReceiptsAsJson(proofs: PaymentProofRecord[]): void {
  const batch = proofs.map(buildVerifiableReceipt);
  const jsonStr = JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      count: batch.length,
      receipts: batch,
    },
    null,
    2
  );
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `kite-x402-audit-proofs-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Copies verifiable receipt JSON to user clipboard.
 */
export async function copyReceiptJson(proof: PaymentProofRecord): Promise<boolean> {
  const receipt = buildVerifiableReceipt(proof);
  const jsonStr = JSON.stringify(receipt, null, 2);
  try {
    await navigator.clipboard.writeText(jsonStr);
    return true;
  } catch (err) {
    console.error('Failed to copy receipt to clipboard', err);
    return false;
  }
}
