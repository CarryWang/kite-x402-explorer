import type { Hex } from 'viem';

/**
 * Delegated Session Allowance & Agent Sub-Account Manager for Kite Chain.
 *
 * Enables master agents or wallet owners to grant bounded, scoped micropayment allowances
 * to worker/sub-agents for autonomous x402 task execution.
 */

export interface DelegatedAllowanceConfig {
  sessionId: string;
  granter: `0x${string}`;
  delegateAgent: `0x${string}`;
  totalAllowanceUnits: bigint;
  spentUnits: bigint;
  validAfter: number;
  validBefore: number;
  allowedRecipients?: `0x${string}`[];
  isRevoked: boolean;
  createdAt: number;
}

export interface SessionSpendRequest {
  sessionId: string;
  amountUnits: bigint;
  recipient: `0x${string}`;
  timestamp: number;
}

export interface SessionVerificationResult {
  isAuthorized: boolean;
  sessionId: string;
  remainingUnits: bigint;
  rejectionReason?: string;
  receiptHash?: Hex;
}

/**
 * Validates standard 20-byte EVM address format.
 */
export function isValidAddress(address: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(address) && !/^0x0{40}$/i.test(address);
}

/**
 * Computes deterministic receipt hash for an approved session spend.
 */
export function hashSpendReceipt(
  sessionId: string,
  amount: bigint,
  recipient: string,
  timestamp: number
): Hex {
  const input = `${sessionId}:${amount.toString()}:${recipient.toLowerCase()}:${timestamp}`;
  let h1 = 0x12345678 ^ input.length;
  let h2 = 0x87654321 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 0x5bd1e995);
    h2 = Math.imul(h2 ^ ch, 0x27d4eb2f);
  }
  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return `0xrcpt_${hex1}${hex2}` as Hex;
}

/**
 * Initializes a new delegated allowance contract record.
 */
export function createSessionAllowance(
  sessionId: string,
  granter: `0x${string}`,
  delegateAgent: `0x${string}`,
  totalAllowanceUnits: bigint,
  validAfter: number,
  validBefore: number,
  allowedRecipients?: `0x${string}`[]
): DelegatedAllowanceConfig {
  if (!sessionId || sessionId.trim().length === 0) {
    throw new Error('Session ID cannot be empty');
  }
  if (!isValidAddress(granter)) {
    throw new Error('Granter must be a valid non-zero EVM address');
  }
  if (!isValidAddress(delegateAgent)) {
    throw new Error('Delegate agent must be a valid non-zero EVM address');
  }
  if (granter.toLowerCase() === delegateAgent.toLowerCase()) {
    throw new Error('Granter and delegate agent cannot be the same address');
  }
  if (totalAllowanceUnits <= 0n) {
    throw new Error('Total allowance must be strictly positive');
  }
  if (validBefore <= validAfter) {
    throw new Error('Expiration (validBefore) must be strictly greater than validAfter');
  }

  if (allowedRecipients) {
    for (const r of allowedRecipients) {
      if (!isValidAddress(r)) {
        throw new Error(`Invalid allowed recipient address: ${r}`);
      }
    }
  }

  return {
    sessionId,
    granter,
    delegateAgent,
    totalAllowanceUnits,
    spentUnits: 0n,
    validAfter,
    validBefore,
    allowedRecipients: allowedRecipients ? [...allowedRecipients] : undefined,
    isRevoked: false,
    createdAt: Date.now(),
  };
}

/**
 * Validates an autonomous spend attempt against the delegated allowance limits.
 */
export function authorizeSessionSpend(
  allowance: DelegatedAllowanceConfig,
  spend: SessionSpendRequest
): SessionVerificationResult {
  if (allowance.isRevoked) {
    return {
      isAuthorized: false,
      sessionId: allowance.sessionId,
      remainingUnits: allowance.totalAllowanceUnits - allowance.spentUnits,
      rejectionReason: 'Session allowance has been revoked by the granter',
    };
  }

  if (spend.amountUnits <= 0n) {
    return {
      isAuthorized: false,
      sessionId: allowance.sessionId,
      remainingUnits: allowance.totalAllowanceUnits - allowance.spentUnits,
      rejectionReason: 'Spend amount must be strictly positive',
    };
  }

  if (spend.timestamp < allowance.validAfter) {
    return {
      isAuthorized: false,
      sessionId: allowance.sessionId,
      remainingUnits: allowance.totalAllowanceUnits - allowance.spentUnits,
      rejectionReason: 'Session allowance is not yet active (timestamp < validAfter)',
    };
  }

  if (spend.timestamp > allowance.validBefore) {
    return {
      isAuthorized: false,
      sessionId: allowance.sessionId,
      remainingUnits: allowance.totalAllowanceUnits - allowance.spentUnits,
      rejectionReason: 'Session allowance has expired (timestamp > validBefore)',
    };
  }

  if (!isValidAddress(spend.recipient)) {
    return {
      isAuthorized: false,
      sessionId: allowance.sessionId,
      remainingUnits: allowance.totalAllowanceUnits - allowance.spentUnits,
      rejectionReason: 'Recipient must be a valid non-zero EVM address',
    };
  }

  if (allowance.allowedRecipients && allowance.allowedRecipients.length > 0) {
    const isAllowed = allowance.allowedRecipients.some(
      (r) => r.toLowerCase() === spend.recipient.toLowerCase()
    );
    if (!isAllowed) {
      return {
        isAuthorized: false,
        sessionId: allowance.sessionId,
        remainingUnits: allowance.totalAllowanceUnits - allowance.spentUnits,
        rejectionReason: 'Recipient address is not in the delegated allowlist',
      };
    }
  }

  const remaining = allowance.totalAllowanceUnits - allowance.spentUnits;
  if (spend.amountUnits > remaining) {
    return {
      isAuthorized: false,
      sessionId: allowance.sessionId,
      remainingUnits: remaining,
      rejectionReason: `Spend amount (${spend.amountUnits}) exceeds remaining session allowance (${remaining})`,
    };
  }

  const receiptHash = hashSpendReceipt(
    allowance.sessionId,
    spend.amountUnits,
    spend.recipient,
    spend.timestamp
  );

  return {
    isAuthorized: true,
    sessionId: allowance.sessionId,
    remainingUnits: remaining - spend.amountUnits,
    receiptHash,
  };
}
