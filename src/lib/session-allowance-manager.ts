import { keccak256, toHex, type Hex } from 'viem';

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
  delegateAgent: `0x${string}`;
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

export interface SessionAuthorizationPolicy {
  /** Verify the grant against trusted storage or a grant signature. */
  verifyGrant: (allowance: DelegatedAllowanceConfig) => boolean;
  /** Authenticate the delegate's spend request using trusted external state. */
  verifySpend: (allowance: DelegatedAllowanceConfig, spend: SessionSpendRequest) => boolean;
  /** Server-controlled clock; defaults to the current Unix time. */
  currentTimestamp?: number;
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
  // Content fingerprint only; possession of this hash does not prove a payment.
  return keccak256(toHex(JSON.stringify([sessionId, amount.toString(), recipient.toLowerCase(), timestamp])));
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
  spend: SessionSpendRequest,
  policy?: SessionAuthorizationPolicy
): SessionVerificationResult {
  const now = policy?.currentTimestamp ?? Math.floor(Date.now() / 1000);
  let trusted = false;
  try {
    trusted = policy !== undefined && Number.isSafeInteger(now) &&
      policy.verifyGrant(allowance) === true && policy.verifySpend(allowance, spend) === true;
  } catch {
    trusted = false;
  }
  if (!trusted) {
    return {
      isAuthorized: false,
      sessionId: allowance.sessionId,
      remainingUnits: allowance.totalAllowanceUnits - allowance.spentUnits,
      rejectionReason: 'Trusted grant and delegate-spend verification is required',
    };
  }

  if (spend.sessionId !== allowance.sessionId ||
      !isValidAddress(spend.delegateAgent) ||
      spend.delegateAgent.toLowerCase() !== allowance.delegateAgent.toLowerCase()) {
    return {
      isAuthorized: false,
      sessionId: allowance.sessionId,
      remainingUnits: allowance.totalAllowanceUnits - allowance.spentUnits,
      rejectionReason: 'Session ID or delegate agent does not match this allowance',
    };
  }

  if (allowance.spentUnits < 0n || allowance.spentUnits > allowance.totalAllowanceUnits) {
    return {
      isAuthorized: false,
      sessionId: allowance.sessionId,
      remainingUnits: 0n,
      rejectionReason: 'Allowance spent balance is invalid',
    };
  }
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

  if (now < allowance.validAfter) {
    return {
      isAuthorized: false,
      sessionId: allowance.sessionId,
      remainingUnits: allowance.totalAllowanceUnits - allowance.spentUnits,
      rejectionReason: 'Session allowance is not yet active (timestamp < validAfter)',
    };
  }

  if (now > allowance.validBefore) {
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

  if (allowance.allowedRecipients !== undefined) {
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
    now
  );

  // Synchronously consume the shared record so sequential approvals cannot
  // reuse the same remaining balance. Distributed callers must persist this
  // update atomically; this local helper does not grant on-chain authority.
  allowance.spentUnits += spend.amountUnits;

  return {
    isAuthorized: true,
    sessionId: allowance.sessionId,
    remainingUnits: remaining - spend.amountUnits,
    receiptHash,
  };
}
