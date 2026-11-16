import type { PaymentProofRecord, VerifiablePaymentReceipt } from '../types/proof.js';
import { KITE_CHAINS } from '../types/kite.js';
import { keccak256, toHex } from 'viem';
import { proofRecordErrors } from './proof-schema.js';

/**
 * Builds a standardized, verifiable JSON receipt for an x402 payment proof record.
 */
export function buildVerifiableReceipt(proof: PaymentProofRecord): VerifiablePaymentReceipt {
  const chainConfig = KITE_CHAINS[proof.network] || KITE_CHAINS['eip155:2368'];
  const isSettled = proof.status === 'settled' && Boolean(proof.txHash);

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
      clientVerified: false,
      guaranteeNote:
        proof.status === 'simulated'
          ? 'Simulated local payment only. No facilitator or on-chain settlement was verified.'
          : proof.status === 'settled'
          ? 'Settlement is reported by this record; verify the transaction independently on-chain.'
          : 'This record does not verify an on-chain settlement or final token balance.',
      // Content fingerprint for comparison, not an authenticated settlement proof.
      receiptDigest: keccak256(toHex(
        `${proof.id}:${proof.network}:${proof.payerAddress}:${proof.payToAddress}:${proof.amountRaw}:${proof.txHash || 'none'}`
      )),
      securityAudit: {
        targetGuardPassed: false,
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
  if (!rawJson || typeof rawJson !== 'object' || Array.isArray(rawJson))
    return { valid: false, errors: ['Expected a receipt object'] };
  const r = rawJson as Record<string, any>;
  let candidate: unknown = r;
  if (r.protocol || r.payment || r.service) {
    if (r.$schema !== 'https://gokite.ai/schemas/x402-receipt-v1.json' || r.protocol?.version !== 2 ||
        !r.service || typeof r.service !== 'object' || !r.payment || typeof r.payment !== 'object')
      return { valid: false, errors: ['Unsupported or incomplete receipt schema'] };
    const p = r.payment;
    const s = r.service;
    const settlement = p.settlement;
    if (!settlement || typeof settlement.settled !== 'boolean' || !p.authorization || typeof p.authorization !== 'object')
      return { valid: false, errors: ['Missing settlement or authorization metadata'] };
    if (settlement.settled !== (settlement.status === 'settled' && Boolean(settlement.txHash)))
      return { valid: false, errors: ['Inconsistent reported settlement status'] };
    const auth = p.authorization;
    candidate = {
      id: r.receiptId, timestamp: r.timestamp, serviceName: s.name, serviceDisplayName: s.displayName,
      endpointPath: s.endpoint, httpMethod: s.method, network: p.network, tokenSymbol: p.tokenSymbol,
      tokenAddress: p.assetContract, amountFormatted: p.amountFormatted, amountRaw: p.amountRaw,
      payerAddress: p.payer, payToAddress: p.payTo, status: settlement.status, txHash: settlement.txHash,
      responseStatus: settlement.settled || settlement.status === 'simulated' ? 200 : 400,
      ...(auth.nonce !== '0x0' ? { eip3009Details: {
        from: p.payer, to: p.payTo, value: p.amountRaw, nonce: auth.nonce,
        validAfter: auth.validAfter, validBefore: auth.validBefore,
        v: auth.v, r: auth.r, s: auth.s,
      } } : {}),
    };
  }
  const errors = proofRecordErrors(candidate);
  return errors.length ? { valid: false, errors } : {
    valid: true, errors: [], proofRecord: candidate as PaymentProofRecord,
  };
}
