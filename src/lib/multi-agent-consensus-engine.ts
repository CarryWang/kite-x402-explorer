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

/**
 * Registers an autonomous agent commitment to a consensus proposal.
 */
export function submitAgentCommitment(
  proposal: ConsensusProposal,
  commitment: AgentCommitment,
  currentTimestamp: number = Math.floor(Date.now() / 1000)
): ConsensusProposal {
  if (proposal.status !== 'open' && proposal.status !== 'evaluating') {
    throw new Error(`Cannot submit commitment: proposal is in '${proposal.status}' state`);
  }

  if (currentTimestamp > proposal.deadlineTimestamp) {
    proposal.status = 'expired';
    throw new Error('Consensus proposal deadline has expired');
  }

  if (proposal.commitments.length >= proposal.maxNodes) {
    throw new Error(`Maximum node participation limit (${proposal.maxNodes}) reached`);
  }

  if (!commitment.agentAddress || !commitment.agentAddress.startsWith('0x')) {
    throw new Error('Invalid agent EVM address');
  }

  if (!commitment.resultHash || !commitment.resultHash.startsWith('0x')) {
    throw new Error('Invalid cryptographic result hash');
  }

  if (!commitment.signature || commitment.signature.trim().length === 0) {
    throw new Error('Agent cryptographic signature required');
  }

  if (commitment.computeUnits <= 0n) {
    throw new Error('Compute units must be positive');
  }

  const existing = proposal.commitments.find(
    (c) => c.agentAddress.toLowerCase() === commitment.agentAddress.toLowerCase()
  );
  if (existing) {
    throw new Error(`Agent ${commitment.agentAddress} has already committed to this proposal`);
  }

  const updatedCommitments = [...proposal.commitments, commitment];
  const newStatus: ConsensusStatus =
    updatedCommitments.length >= proposal.minNodes ? 'evaluating' : 'open';

  return {
    ...proposal,
    status: newStatus,
    commitments: updatedCommitments,
  };
}

/**
 * Evaluates quorum consensus across all submitted commitments, allocates micropayments,
 * and penalizes dissenting/faulty compute nodes.
 */
export function evaluateConsensus(
  proposal: ConsensusProposal,
  currentTimestamp: number = Math.floor(Date.now() / 1000)
): { proposal: ConsensusProposal; result: ConsensusResult } {
  if (proposal.status === 'consensus_reached' || proposal.status === 'consensus_failed') {
    throw new Error(`Proposal has already been finalized with status '${proposal.status}'`);
  }

  const isExpired = currentTimestamp > proposal.deadlineTimestamp;
  const isFull = proposal.commitments.length >= proposal.maxNodes;

  if (proposal.commitments.length < proposal.minNodes && !isExpired) {
    throw new Error(
      `Insufficient nodes for evaluation: ${proposal.commitments.length}/${proposal.minNodes} commitments received`
    );
  }

  // Group commitments by resultHash
  const votes = new Map<`0x${string}`, AgentCommitment[]>();
  for (const c of proposal.commitments) {
    const list = votes.get(c.resultHash) ?? [];
    list.push(c);
    votes.set(c.resultHash, list);
  }

  // Find majority hash
  let winningHash: `0x${string}` | undefined;
  let winningList: AgentCommitment[] = [];
  for (const [hash, list] of votes.entries()) {
    if (list.length >= proposal.quorumThreshold) {
      if (list.length > winningList.length) {
        winningHash = hash;
        winningList = list;
      }
    }
  }

  const payouts: Record<`0x${string}`, bigint> = {};

  if (winningHash && winningList.length >= proposal.quorumThreshold) {
    const agreeingNodes = winningList.map((c) => c.agentAddress);
    const dissentingNodes = proposal.commitments
      .filter((c) => c.resultHash !== winningHash)
      .map((c) => c.agentAddress);

    // Compute total compute units among agreeing nodes for weighted distribution
    const totalAgreeingCompute = winningList.reduce(
      (acc, c) => acc + c.computeUnits,
      0n
    );

    let allocatedTotal = 0n;
    for (let i = 0; i < winningList.length; i++) {
      const c = winningList[i];
      if (i === winningList.length - 1) {
        // Last node absorbs rounding residue so exact rewardPoolWei is distributed
        payouts[c.agentAddress] = proposal.rewardPoolWei - allocatedTotal;
      } else {
        const share = (proposal.rewardPoolWei * c.computeUnits) / totalAgreeingCompute;
        payouts[c.agentAddress] = share;
        allocatedTotal += share;
      }
    }

    // Dissenting nodes get 0
    for (const d of dissentingNodes) {
      payouts[d] = 0n;
    }

    const updatedProposal: ConsensusProposal = {
      ...proposal,
      status: 'consensus_reached',
      winningHash,
    };

    return {
      proposal: updatedProposal,
      result: {
        proposalId: proposal.proposalId,
        consensusReached: true,
        winningHash,
        agreeingNodes,
        dissentingNodes,
        payouts,
        clientRefundWei: 0n,
        evaluatedAt: currentTimestamp,
      },
    };
  }

  // Quorum was NOT reached
  // Can only finalize as failure if expired or all maxNodes committed
  if (isExpired || isFull) {
    const updatedProposal: ConsensusProposal = {
      ...proposal,
      status: 'consensus_failed',
    };

    return {
      proposal: updatedProposal,
      result: {
        proposalId: proposal.proposalId,
        consensusReached: false,
        agreeingNodes: [],
        dissentingNodes: proposal.commitments.map((c) => c.agentAddress),
        payouts: {},
        clientRefundWei: proposal.rewardPoolWei,
        evaluatedAt: currentTimestamp,
      },
    };
  }

  // Quorum not yet reached, but deadline has not passed and more nodes can still join
  throw new Error('Consensus not yet reached; waiting for additional nodes or expiration');
}


