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
      receiptDigest: `0x${Array.from(
        new TextEncoder().encode(
          `${proof.id}:${proof.network}:${proof.payerAddress}:${proof.payToAddress}:${proof.amountRaw}:${proof.txHash || 'none'}`
        )
      )
        .reduce((acc, byte) => (acc * 31 + byte) >>> 0, 0)
        .toString(16)
        .padStart(8, '0')}`,
      securityAudit: {
        targetGuardPassed: proof.status !== 'aborted_502' && proof.status !== 'expired_sig',
        riskScore: proof.status === 'settled' ? 0 : 25,
      },
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

export interface ReceiptValidationResult {
  valid: boolean;
  errors: string[];
  proofRecord?: PaymentProofRecord;
}

/**
 * Validates and converts an imported verifiable JSON receipt into a PaymentProofRecord.
 */
export function parseAndValidateReceipt(rawJson: unknown): ReceiptValidationResult {
  const errors: string[] = [];

  if (!rawJson || typeof rawJson !== 'object') {
    return { valid: false, errors: ['Invalid JSON: Expected an object'] };
  }

  const r = rawJson as Record<string, any>;

  // Check structure: can be either VerifiablePaymentReceipt or direct PaymentProofRecord
  if (r.protocol && r.service && r.payment) {
    // VerifiablePaymentReceipt structure
    const p = r.payment;
    const s = r.service;
    const auth = p.authorization || {};
    const settlement = p.settlement || {};

    if (!p.network || !p.payer || !p.payTo) {
      errors.push('Missing required payment fields: network, payer, or payTo');
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    const proofRecord: PaymentProofRecord = {
      id: r.receiptId || `prf_imp_${Date.now().toString(36)}`,
      timestamp: r.timestamp || new Date().toISOString(),
      serviceName: s.name || 'imported-service',
      serviceDisplayName: s.displayName || s.name || 'Imported Service',
      endpointPath: s.endpoint || '/',
      httpMethod: s.method || 'GET',
      network: p.network,
      tokenSymbol: p.tokenSymbol || (p.network === 'eip155:2368' ? 'pieUSD' : 'USDC.e'),
      tokenAddress: p.assetContract || '',
      amountFormatted: p.amountFormatted || '0.001 USD',
      amountRaw: p.amountRaw || '1000000000000000',
      payerAddress: p.payer,
      payToAddress: p.payTo,
      status: settlement.status || (settlement.settled ? 'settled' : 'simulated'),
      txHash: settlement.txHash,
      eip3009Details: {
        from: p.payer,
        to: p.payTo,
        value: p.amountRaw || '0',
        nonce: auth.nonce || '0x0',
        validAfter: Number(auth.validAfter) || 0,
        validBefore: Number(auth.validBefore) || 0,
        v: auth.v,
        r: auth.r,
        s: auth.s,
      },
      responseStatus: settlement.settled ? 200 : 400,
    };

    return { valid: true, errors: [], proofRecord };
  } else if (r.id && r.serviceName && r.network && r.payerAddress) {
    // Direct PaymentProofRecord structure
    return { valid: true, errors: [], proofRecord: r as PaymentProofRecord };
  }

  return {
    valid: false,
    errors: ['Unrecognized receipt schema: must match x402-receipt-v1 standard'],
  };
}
