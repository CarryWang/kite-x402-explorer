import { isAddress, keccak256, stringToHex } from 'viem';

export type EscrowStatus = 'funded' | 'released' | 'disputed' | 'resolved' | 'refunded';
export type VoteVerdict = 'release_to_provider' | 'refund_to_buyer';

export interface EscrowContract {
  escrowId: string;
  buyer: `0x${string}`;
  provider: `0x${string}`;
  arbiters: `0x${string}`[];
  thresholdVotes: number;
  escrowAmountWei: bigint;
  taskSpecHash: `0x${string}`;
  timeoutDeadline: number;
  status: EscrowStatus;
  createdAt: number;
}

export interface DisputeRecord {
  disputeId: string;
  escrowId: string;
  initiator: `0x${string}`;
  disputeReason: string;
  evidenceHash: `0x${string}`;
  votes: Map<string, VoteVerdict>;
  resolvedVerdict?: VoteVerdict;
  createdAt: number;
}

/**
 * Derives a deterministic escrow identifier.
 */
export function deriveEscrowId(
  buyer: `0x${string}`,
  provider: `0x${string}`,
  taskSpecHash: `0x${string}`,
  timestamp: number,
): string {
  const hash = keccak256(
    stringToHex(`escrow:${buyer.toLowerCase()}:${provider.toLowerCase()}:${taskSpecHash}:${timestamp}`),
  );
  return `escrow-${hash.slice(2, 14)}`;
}

/**
 * Creates a new arbitrated milestone escrow for multi-agent tasks.
 */
export function createEscrowContract(params: {
  buyer: `0x${string}`;
  provider: `0x${string}`;
  arbiters: `0x${string}`[];
  thresholdVotes?: number;
  escrowAmountWei: bigint;
  taskSpecHash: `0x${string}`;
  timeoutSeconds?: number;
  timestamp?: number;
}, verifyFunding?: (params: { buyer: `0x${string}`; escrowAmountWei: bigint; taskSpecHash: `0x${string}` }) => boolean): EscrowContract {
  if (!isAddress(params.buyer)) {
    throw new Error(`Invalid buyer address: ${params.buyer}`);
  }
  if (!isAddress(params.provider)) {
    throw new Error(`Invalid provider address: ${params.provider}`);
  }
  if (params.arbiters.length === 0) {
    throw new Error('At least one arbiter must be specified');
  }
  for (const arb of params.arbiters) {
    if (!isAddress(arb)) {
      throw new Error(`Invalid arbiter address: ${arb}`);
    }
  }
  if (new Set(params.arbiters.map((arb) => arb.toLowerCase())).size !== params.arbiters.length) {
    throw new Error('Duplicate arbiters are not allowed');
  }
  if (params.escrowAmountWei <= 0n) {
    throw new Error('Escrow amount must be positive');
  }
  if (!verifyFunding?.(params)) {
    throw new Error('Verified escrow funding required');
  }

  const threshold = params.thresholdVotes ?? Math.floor(params.arbiters.length / 2) + 1;
  if (threshold < 1 || threshold > params.arbiters.length) {
    throw new Error(`Invalid threshold votes: ${threshold} for ${params.arbiters.length} arbiters`);
  }

  const createdAt = params.timestamp ?? Date.now();
  const timeout = params.timeoutSeconds ?? 86400 * 3; // 3 days default
  const timeoutDeadline = createdAt + timeout * 1000;
  const escrowId = deriveEscrowId(params.buyer, params.provider, params.taskSpecHash, createdAt);

  return {
    escrowId,
    buyer: params.buyer,
    provider: params.provider,
    arbiters: params.arbiters,
    thresholdVotes: threshold,
    escrowAmountWei: params.escrowAmountWei,
    taskSpecHash: params.taskSpecHash,
    timeoutDeadline,
    status: 'funded',
    createdAt,
  };
}

/**
 * Initiates a formal dispute when buyer or provider fails to agree on task deliverables.
 */
export function openEscrowDispute(
  escrow: EscrowContract,
  params: {
    initiator: `0x${string}`;
    disputeReason: string;
    evidenceHash: `0x${string}`;
    timestamp?: number;
  },
  verifyInitiator?: (escrow: EscrowContract, initiator: `0x${string}`) => boolean,
): { escrow: EscrowContract; dispute: DisputeRecord } {
  if (escrow.status !== 'funded') {
    throw new Error(`Cannot dispute escrow in status: ${escrow.status}`);
  }
  const isParty =
    escrow.buyer.toLowerCase() === params.initiator.toLowerCase() ||
    escrow.provider.toLowerCase() === params.initiator.toLowerCase();

  if (!isParty) {
    throw new Error('Only buyer or provider can initiate an escrow dispute');
  }
  if (!verifyInitiator?.(escrow, params.initiator)) {
    throw new Error('Verified dispute initiator required');
  }

  const now = params.timestamp ?? Date.now();
  const disputeId = `disp-${keccak256(stringToHex(`dispute:${escrow.escrowId}:${now}`)).slice(2, 14)}`;

  const dispute: DisputeRecord = {
    disputeId,
    escrowId: escrow.escrowId,
    initiator: params.initiator,
    disputeReason: params.disputeReason,
    evidenceHash: params.evidenceHash,
    votes: new Map(),
    createdAt: now,
  };

  const updatedEscrow: EscrowContract = {
    ...escrow,
    status: 'disputed',
  };

  return { escrow: updatedEscrow, dispute };
}

/**
 * Casts a vote from an authorized arbiter agent.
 */
export function castArbitrationVote(
  escrow: EscrowContract,
  dispute: DisputeRecord,
  arbiter: `0x${string}`,
  verdict: VoteVerdict,
  verifyVote?: (escrow: EscrowContract, dispute: DisputeRecord, arbiter: `0x${string}`, verdict: VoteVerdict) => boolean,
): { dispute: DisputeRecord; resolution?: VoteVerdict } {
  if (escrow.status !== 'disputed') {
    throw new Error('Escrow is not in disputed state');
  }
  const isAuthorized = escrow.arbiters.some((a) => a.toLowerCase() === arbiter.toLowerCase());
  if (!isAuthorized) {
    throw new Error(`Address ${arbiter} is not an authorized arbiter for this escrow`);
  }
  if (dispute.escrowId !== escrow.escrowId || dispute.resolvedVerdict) {
    throw new Error('Dispute does not match escrow or is already resolved');
  }
  if (!verifyVote?.(escrow, dispute, arbiter, verdict)) {
    throw new Error('Verified arbiter vote required');
  }
  if (dispute.votes.has(arbiter.toLowerCase())) {
    throw new Error('Arbiter has already voted');
  }

  dispute.votes.set(arbiter.toLowerCase(), verdict);

  // Check consensus count
  let releaseVotes = 0;
  let refundVotes = 0;

  for (const v of dispute.votes.values()) {
    if (v === 'release_to_provider') releaseVotes++;
    if (v === 'refund_to_buyer') refundVotes++;
  }

  let resolution: VoteVerdict | undefined;
  if (releaseVotes >= escrow.thresholdVotes) {
    resolution = 'release_to_provider';
  } else if (refundVotes >= escrow.thresholdVotes) {
    resolution = 'refund_to_buyer';
  }

  if (resolution) {
    dispute.resolvedVerdict = resolution;
  }

  return { dispute, resolution };
}
