import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createConsensusProposal,
  submitAgentCommitment,
  evaluateConsensus,
} from '../src/lib/multi-agent-consensus-engine.ts';

const client = '0x1111111111111111111111111111111111111111' as const;
const agentA = '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' as const;
const agentB = '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB' as const;
const agentC = '0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC' as const;
const agentD = '0xDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD' as const;
const agentE = '0xEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE' as const;

const validHash1 = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as const;
const rogueHash = '0x9999999999999999999999999999999999999999999999999999999999999999' as const;

test('createConsensusProposal validates constraints strictly', () => {
  assert.throws(
    () =>
      createConsensusProposal({
        proposalId: '',
        clientAddress: client,
        rewardPoolWei: 1000n,
        quorumThreshold: 2,
        minNodes: 2,
        maxNodes: 3,
        durationSeconds: 300,
      }),
    /Proposal ID must not be empty/i
  );

  assert.throws(
    () =>
      createConsensusProposal({
        proposalId: 'prop-1',
        clientAddress: 'invalid-address' as any,
        rewardPoolWei: 1000n,
        quorumThreshold: 2,
        minNodes: 2,
        maxNodes: 3,
        durationSeconds: 300,
      }),
    /Valid client EVM address required/i
  );

  assert.throws(
    () =>
      createConsensusProposal({
        proposalId: 'prop-1',
        clientAddress: client,
        rewardPoolWei: 0n,
        quorumThreshold: 2,
        minNodes: 2,
        maxNodes: 3,
        durationSeconds: 300,
      }),
    /Reward pool must be strictly positive/i
  );

  assert.throws(
    () =>
      createConsensusProposal({
        proposalId: 'prop-1',
        clientAddress: client,
        rewardPoolWei: 1000n,
        quorumThreshold: 4,
        minNodes: 2,
        maxNodes: 3,
        durationSeconds: 300,
      }),
    /Quorum threshold must be between 1 and maxNodes/i
  );
});

test('submitAgentCommitment rejects duplicate submissions from the same agent', () => {
  const proposal = createConsensusProposal({
    proposalId: 'prop-dup',
    clientAddress: client,
    rewardPoolWei: 1000n,
    quorumThreshold: 2,
    minNodes: 2,
    maxNodes: 3,
    durationSeconds: 300,
    currentTimestamp: 1000,
  });

  const updated = submitAgentCommitment(
    proposal,
    {
      agentAddress: agentA,
      resultHash: validHash1,
      signature: '0xsigA',
      computeUnits: 100n,
      submittedAt: 1010,
    },
    1010
  );

  assert.equal(updated.commitments.length, 1);

  assert.throws(
    () =>
      submitAgentCommitment(
        updated,
        {
          agentAddress: agentA,
          resultHash: validHash1,
          signature: '0xsigA_again',
          computeUnits: 100n,
          submittedAt: 1020,
        },
        1020
      ),
    /already committed/i
  );
});

test('submitAgentCommitment enforces maxNodes capacity limit', () => {
  let proposal = createConsensusProposal({
    proposalId: 'prop-cap',
    clientAddress: client,
    rewardPoolWei: 1000n,
    quorumThreshold: 2,
    minNodes: 2,
    maxNodes: 2,
    durationSeconds: 300,
    currentTimestamp: 1000,
  });

  proposal = submitAgentCommitment(
    proposal,
    { agentAddress: agentA, resultHash: validHash1, signature: 'sigA', computeUnits: 10n, submittedAt: 1010 },
    1010
  );
  proposal = submitAgentCommitment(
    proposal,
    { agentAddress: agentB, resultHash: validHash1, signature: 'sigB', computeUnits: 10n, submittedAt: 1020 },
    1020
  );

  assert.throws(
    () =>
      submitAgentCommitment(
        proposal,
        { agentAddress: agentC, resultHash: validHash1, signature: 'sigC', computeUnits: 10n, submittedAt: 1030 },
        1030
      ),
    /Maximum node participation limit/i
  );
});

test('evaluateConsensus establishes 3-of-4 Byzantine quorum with weighted micropayments', () => {
  let proposal = createConsensusProposal({
    proposalId: 'prop-quorum',
    clientAddress: client,
    rewardPoolWei: 1000000n, // 1 USDC.e or equivalent
    quorumThreshold: 3,
    minNodes: 3,
    maxNodes: 5,
    durationSeconds: 600,
    currentTimestamp: 1000,
  });

  // Agent A, B, C agree on validHash1 with varying computeUnits
  proposal = submitAgentCommitment(
    proposal,
    { agentAddress: agentA, resultHash: validHash1, signature: 'sigA', computeUnits: 200n, submittedAt: 1010 },
    1010
  );
  proposal = submitAgentCommitment(
    proposal,
    { agentAddress: agentB, resultHash: validHash1, signature: 'sigB', computeUnits: 300n, submittedAt: 1020 },
    1020
  );
  // Agent D submits a conflicting rogue output
  proposal = submitAgentCommitment(
    proposal,
    { agentAddress: agentD, resultHash: rogueHash, signature: 'sigD', computeUnits: 500n, submittedAt: 1030 },
    1030
  );
  proposal = submitAgentCommitment(
    proposal,
    { agentAddress: agentC, resultHash: validHash1, signature: 'sigC', computeUnits: 500n, submittedAt: 1040 },
    1040
  );

  const { proposal: finalized, result } = evaluateConsensus(proposal, 1050);

  assert.equal(finalized.status, 'consensus_reached');
  assert.equal(result.consensusReached, true);
  assert.equal(result.winningHash, validHash1);
  assert.deepEqual(result.agreeingNodes, [agentA, agentB, agentC]);
  assert.deepEqual(result.dissentingNodes, [agentD]);

  // Total agreeing compute: 200 + 300 + 500 = 1000
  // Payout A (20%): 200,000n
  // Payout B (30%): 300,000n
  // Payout C (50%): 500,000n
  assert.equal(result.payouts[agentA], 200000n);
  assert.equal(result.payouts[agentB], 300000n);
  assert.equal(result.payouts[agentC], 500000n);
  assert.equal(result.payouts[agentD], 0n);

  const totalDistributed =
    result.payouts[agentA] +
    result.payouts[agentB] +
    result.payouts[agentC] +
    result.payouts[agentD];
  assert.equal(totalDistributed, 1000000n);
  assert.equal(result.clientRefundWei, 0n);
});

test('evaluateConsensus refunds client 100% when quorum fails before expiration', () => {
  let proposal = createConsensusProposal({
    proposalId: 'prop-fail',
    clientAddress: client,
    rewardPoolWei: 500000n,
    quorumThreshold: 3,
    minNodes: 3,
    maxNodes: 3,
    durationSeconds: 100,
    currentTimestamp: 1000,
  });

  // All 3 nodes submit conflicting outputs (no majority reaches 3)
  proposal = submitAgentCommitment(
    proposal,
    { agentAddress: agentA, resultHash: '0x1111111111111111111111111111111111111111111111111111111111111111', signature: 'sA', computeUnits: 10n, submittedAt: 1010 },
    1010
  );
  proposal = submitAgentCommitment(
    proposal,
    { agentAddress: agentB, resultHash: '0x2222222222222222222222222222222222222222222222222222222222222222', signature: 'sB', computeUnits: 10n, submittedAt: 1020 },
    1020
  );
  proposal = submitAgentCommitment(
    proposal,
    { agentAddress: agentC, resultHash: '0x3333333333333333333333333333333333333333333333333333333333333333', signature: 'sC', computeUnits: 10n, submittedAt: 1030 },
    1030
  );

  const { proposal: finalized, result } = evaluateConsensus(proposal, 1050);

  assert.equal(finalized.status, 'consensus_failed');
  assert.equal(result.consensusReached, false);
  assert.equal(result.clientRefundWei, 500000n);
  assert.deepEqual(result.agreeingNodes, []);
});
