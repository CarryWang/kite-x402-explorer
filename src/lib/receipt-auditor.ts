import type { PaymentProofRecord } from '../types/proof.js';

export interface AuditAnomalyResult {
  hasAnomaly: boolean;
  code:
    | 'REPLAYED_NONCE'
    | 'ABNORMAL_FREQUENCY'
    | 'EXCESSIVE_FAIL_RATIO'
    | 'TIMESTAMP_OUT_OF_BOUNDS'
    | 'NONE';
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  description: string;
}

export interface ReceiptAuditorStats {
  totalAnalyzed: number;
  settledCount: number;
  failureCount: number;
  uniquePayers: number;
  uniqueEndpoints: number;
  anomaliesDetected: number;
}

export class ReceiptAnomalyAuditor {
  private seenNonces: Map<string, string> = new Map(); // nonce -> proofId

  /**
   * Audits an individual proof record for transaction anomalies, nonces reuse, and expiration.
   */
  public auditSingle(proof: PaymentProofRecord): AuditAnomalyResult {
    // 1. Check Replay Attack / Nonce Duplication
    const nonce = proof.eip3009Details?.nonce;
    if (nonce && nonce !== '0x0') {
      const existingProofId = this.seenNonces.get(nonce);
      if (existingProofId && existingProofId !== proof.id) {
        return {
          hasAnomaly: true,
          code: 'REPLAYED_NONCE',
          severity: 'CRITICAL',
          description: `Nonce collision detected! Nonce ${nonce.slice(0, 10)}... was already authorized in record ${existingProofId}. Potential replay attack.`,
        };
      }
      this.seenNonces.set(nonce, proof.id);
    }

    // 2. Timestamp sanity check (cannot be > 5 minutes in future)
    const proofTime = new Date(proof.timestamp).getTime();
    const now = Date.now();
    if (proofTime - now > 5 * 60 * 1000) {
      return {
        hasAnomaly: true,
        code: 'TIMESTAMP_OUT_OF_BOUNDS',
        severity: 'WARNING',
        description: `Proof record has a future timestamp (${proof.timestamp}) differing significantly from local clock.`,
      };
    }

    // 3. Status invariant checks
    if (proof.status === 'aborted_502' && proof.txHash) {
      return {
        hasAnomaly: true,
        code: 'REPLAYED_NONCE',
        severity: 'CRITICAL',
        description: `Protocol violation: 502 aborted request contains an on-chain transaction hash: ${proof.txHash}. Zero-deduction invariant violated.`,
      };
    }

    return {
      hasAnomaly: false,
      code: 'NONE',
      severity: 'INFO',
      description: 'Proof verified without anomalies.',
    };
  }

  /**
   * Performs aggregated batch analysis across multiple proof logs.
   */
  public auditBatch(proofs: PaymentProofRecord[]): {
    stats: ReceiptAuditorStats;
    anomalies: Array<{ proofId: string; result: AuditAnomalyResult }>;
  } {
    this.seenNonces.clear();
    const anomalies: Array<{ proofId: string; result: AuditAnomalyResult }> = [];
    const payers = new Set<string>();
    const endpoints = new Set<string>();
    let settled = 0;
    let failed = 0;

    for (const p of proofs) {
      payers.add(p.payerAddress.toLowerCase());
      endpoints.add(`${p.httpMethod} ${p.endpointPath}`);

      if (p.status === 'settled' || p.status === 'simulated') {
        settled++;
      } else {
        failed++;
      }

      const res = this.auditSingle(p);
      if (res.hasAnomaly) {
        anomalies.push({ proofId: p.id, result: res });
      }
    }

    return {
      stats: {
        totalAnalyzed: proofs.length,
        settledCount: settled,
        failureCount: failed,
        uniquePayers: payers.size,
        uniqueEndpoints: endpoints.size,
        anomaliesDetected: anomalies.length,
      },
      anomalies,
    };
  }
}
