import test from 'node:test';
import assert from 'node:assert/strict';
const A = '0x1111111111111111111111111111111111111111' as const;
const B = '0x2222222222222222222222222222222222222222' as const;
const C = '0x3333333333333333333333333333333333333333' as const;
import { createConsensusProposal, submitAgentCommitment, evaluateConsensus } from '../src/lib/multi-agent-consensus-engine.js';

function proposal(maxNodes = 2) { return createConsensusProposal({ proposalId: 'local', clientAddress: C,
  rewardPoolWei: 10n, quorumThreshold: 2, minNodes: 2, maxNodes, durationSeconds: 100, currentTimestamp: 1000 }); }
function commitment(agentAddress: typeof A | typeof B | typeof C, resultHash: `0x${string}`) {
  return { agentAddress, resultHash, signature: 'local-unverified', computeUnits: 1n, submittedAt: 1000 };
}

test('equivalent mixed-case result bytes count toward the same quorum', () => {
  const lower = ('0x' + 'ab'.repeat(32)) as `0x${string}`;
  const upper = ('0x' + 'AB'.repeat(32)) as `0x${string}`;
  const first = submitAgentCommitment(proposal(), commitment(A, lower), 1000);
  const second = submitAgentCommitment(first, commitment(B, upper), 1000);
  const { result } = evaluateConsensus(second, 1000);
  assert.equal(result.consensusReached, true);
  assert.equal(result.winningHash, lower);
  assert.equal(result.agreeingNodes.length, 2);
  assert.equal(result.dissentingNodes.length, 0);
  assert.equal(Object.values(result.payouts).reduce((sum, n) => sum + n, 0n), 10n);
  assert.equal(second.commitments[1].resultHash, upper);
});

test('genuinely different result bytes still fail quorum and return the full pool', () => {
  let value = submitAgentCommitment(proposal(), commitment(A, '0xaaaa'), 1000);
  value = submitAgentCommitment(value, commitment(B, '0xbbbb'), 1000);
  const { result } = evaluateConsensus(value, 1000);
  assert.equal(result.consensusReached, false);
  assert.equal(result.clientRefundWei, 10n);
});
