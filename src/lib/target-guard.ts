import type { X402AcceptOption } from '../types/x402.js';
import { KITE_CHAINS } from '../types/kite.js';
import { isAddress } from 'viem';

export interface SecurityPolicyViolation {
  code:
    | 'UNTRUSTED_RECIPIENT'
    | 'AMOUNT_EXCEEDS_CAP'
    | 'UNSUPPORTED_NETWORK'
    | 'INVALID_ASSET_CONTRACT'
    | 'MALFORMED_RECIPIENT_ADDRESS'
    | 'SUSPICIOUS_HIGH_TIMEOUT';
  severity: 'CRITICAL' | 'HIGH' | 'WARNING';
  message: string;
}

export interface SecurityAuditVerdict {
  isSafe: boolean;
  violations: SecurityPolicyViolation[];
  riskScore: number; // 0 (safest) to 100 (dangerous)
  summary: string;
}

export interface TargetGuardPolicy {
  maxAmountCapUnits: bigint;
  allowedNetworks: string[];
  allowedRecipients?: string[];
  blockedRecipients?: string[];
  maxTimeoutSeconds: number;
}

export const DEFAULT_GUARD_POLICY: TargetGuardPolicy = {
  maxAmountCapUnits: 50_000_000_000_000_000_000n, // 50 pieUSD or 50 USDC
  allowedNetworks: ['eip155:2368', 'eip155:2366'],
  maxTimeoutSeconds: 3600,
  blockedRecipients: [
    '0x0000000000000000000000000000000000000000',
    '0xdead000000000000000000000000000000000000',
  ],
};

/**
 * Validates an x402 challenge accept-term against client security policy before signing.
 * Prevents malicious or phishing x402 servers from draining agent balances.
 */
export function auditX402ChallengeTarget(
  accept: X402AcceptOption,
  policy: TargetGuardPolicy = DEFAULT_GUARD_POLICY
): SecurityAuditVerdict {
  const violations: SecurityPolicyViolation[] = [];
  let riskScore = 0;

  // 1. Recipient Address Integrity
  if (!isAddress(accept.payTo)) {
    violations.push({
      code: 'MALFORMED_RECIPIENT_ADDRESS',
      severity: 'CRITICAL',
      message: `Target payTo address is not a valid checksummed EVM address: ${accept.payTo}`,
    });
    riskScore += 60;
  } else {
    const payToNormalized = accept.payTo.toLowerCase();
    if (policy.blockedRecipients?.some((b) => b.toLowerCase() === payToNormalized)) {
      violations.push({
        code: 'UNTRUSTED_RECIPIENT',
        severity: 'CRITICAL',
        message: `Recipient address is explicitly denylisted: ${accept.payTo}`,
      });
      riskScore += 80;
    }
  }

  // 2. Network verification
  if (!policy.allowedNetworks.includes(accept.network)) {
    violations.push({
      code: 'UNSUPPORTED_NETWORK',
      severity: 'HIGH',
      message: `Payment requested for untrusted network: ${accept.network}. Allowed: ${policy.allowedNetworks.join(', ')}`,
    });
    riskScore += 40;
  }

  // 3. Asset contract check against known Kite chain configs
  const kiteConfig = KITE_CHAINS[accept.network];
  if (kiteConfig && accept.asset) {
    if (accept.asset.toLowerCase() !== kiteConfig.assetAddress.toLowerCase()) {
      violations.push({
        code: 'INVALID_ASSET_CONTRACT',
        severity: 'HIGH',
        message: `Asset token contract mismatch. Expected official ${kiteConfig.assetSymbol} (${kiteConfig.assetAddress}), got: ${accept.asset}`,
      });
      riskScore += 40;
    }
  }

  // 4. Amount Cap Inspection
  try {
    const requestedUnits = BigInt(accept.amount);
    if (requestedUnits > policy.maxAmountCapUnits) {
      violations.push({
        code: 'AMOUNT_EXCEEDS_CAP',
        severity: 'HIGH',
        message: `Requested payment amount (${accept.amount} units) exceeds maximum safety policy cap (${policy.maxAmountCapUnits.toString()})`,
      });
      riskScore += 30;
    }
  } catch {
    violations.push({
      code: 'AMOUNT_EXCEEDS_CAP',
      severity: 'CRITICAL',
      message: `Invalid amount format specified in challenge: ${accept.amount}`,
    });
    riskScore += 50;
  }

  // 5. Timeout inspection
  if (accept.maxTimeoutSeconds && accept.maxTimeoutSeconds > policy.maxTimeoutSeconds) {
    violations.push({
      code: 'SUSPICIOUS_HIGH_TIMEOUT',
      severity: 'WARNING',
      message: `Payment challenge specifies abnormally high timeout: ${accept.maxTimeoutSeconds}s (Max recommended: ${policy.maxTimeoutSeconds}s)`,
    });
    riskScore += 15;
  }

  const boundedRisk = Math.min(100, riskScore);
  const isSafe = violations.filter((v) => v.severity === 'CRITICAL' || v.severity === 'HIGH').length === 0;

  return {
    isSafe,
    violations,
    riskScore: boundedRisk,
    summary: isSafe
      ? `Audit Passed: Verified recipient and token contract on ${kiteConfig?.name || accept.network}`
      : `Audit Failed: ${violations.length} safety violation(s) detected. Signer should abort.`,
  };
}
