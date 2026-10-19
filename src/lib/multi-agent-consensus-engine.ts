/**
 * Multi-Agent Quorum Consensus & Verification Engine for Kite AI.
 *
 * Coordinates decentralized, redundant AI agent execution across independent nodes.
 * Aggregates signed output hashes, establishes M-of-N Byzantine quorum, and distributes
 * conditional x402 micropayments to consensus-aligned compute providers.
 */

export type ConsensusStatus =
  | 'open'
  | 'evaluating'
  | 'consensus_reached'
  | 'consensus_failed'
  | 'expired';

export interface AgentCommitment {
  agentAddress: `0x${string}`;
  resultHash: `0x${string}`;
  signature: string;
  computeUnits: bigint;
  submittedAt: number;
}

export interface ConsensusProposal {
  proposalId: string;
  clientAddress: `0x${string}`;
  rewardPoolWei: bigint;
  quorumThreshold: number;
  minNodes: number;
  maxNodes: number;
  deadlineTimestamp: number;
  createdAt: number;
  status: ConsensusStatus;
  commitments: AgentCommitment[];
  winningHash?: `0x${string}`;
}

export interface ConsensusResult {
  proposalId: string;
  consensusReached: boolean;
  winningHash?: `0x${string}`;
  agreeingNodes: `0x${string}`[];
  dissentingNodes: `0x${string}`[];
  payouts: Record<`0x${string}`, bigint>;
  clientRefundWei: bigint;
  evaluatedAt: number;
}

export interface CreateProposalParams {
  proposalId: string;
  clientAddress: `0x${string}`;
  rewardPoolWei: bigint;
  quorumThreshold: number;
  minNodes: number;
  maxNodes: number;
  durationSeconds: number;
  currentTimestamp?: number;
}

/**
 * Creates and initializes a new Multi-Agent Consensus proposal.
 */
export function createConsensusProposal(params: CreateProposalParams): ConsensusProposal {
  const {
    proposalId,
    clientAddress,
    rewardPoolWei,
    quorumThreshold,
    minNodes,
    maxNodes,
    durationSeconds,
    currentTimestamp = Math.floor(Date.now() / 1000),
  } = params;

  if (!proposalId || proposalId.trim().length === 0) {
    throw new Error('Proposal ID must not be empty');
  }

  if (!clientAddress || !clientAddress.startsWith('0x')) {
    throw new Error('Valid client EVM address required');
  }

  if (rewardPoolWei <= 0n) {
    throw new Error('Reward pool must be strictly positive');
  }

  if (minNodes <= 0 || maxNodes < minNodes) {
    throw new Error('Invalid node bounds: minNodes must be >= 1 and maxNodes >= minNodes');
  }

  if (quorumThreshold <= 0 || quorumThreshold > maxNodes) {
    throw new Error('Quorum threshold must be between 1 and maxNodes');
  }

  if (durationSeconds <= 0) {
    throw new Error('Duration must be positive');
  }

  return {
    proposalId,
    clientAddress,
    rewardPoolWei,
    quorumThreshold,
    minNodes,
    maxNodes,
    deadlineTimestamp: currentTimestamp + durationSeconds,
    createdAt: currentTimestamp,
    status: 'open',
    commitments: [],
  };
}
