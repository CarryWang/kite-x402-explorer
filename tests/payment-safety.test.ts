import assert from 'node:assert/strict';
import test from 'node:test';
import { auditX402ChallengeTarget, DEFAULT_GUARD_POLICY } from '../src/lib/target-guard.ts';
import * as targetGuard from '../src/lib/target-guard.ts';
import { createMilestoneTask, releaseMilestonePayout } from '../src/lib/task-milestone-escrow.ts';
import { evaluateAgentCreditLine } from '../src/lib/zk-reputation-credit.ts';
import { openStreamChannel, allocateStreamTicket } from '../src/lib/stream-channel-router.ts';
import { calculateSwarmBountySplit } from '../src/lib/swarm-budget-allocator.ts';
import { calculateWeightedRevenueShare } from '../src/lib/dataset-revenue-share.ts';
import { KITE_CHAINS } from '../src/types/kite.ts';

const payer = '0x0000000000000000000000000000000000000001' as const;
const recipient = '0x0000000000000000000000000000000000000002' as const;

test('target guard rejects a recipient outside an explicit allowlist', () => {
  const verdict = auditX402ChallengeTarget({
    scheme: 'exact', network: 'eip155:2368', asset: KITE_CHAINS['eip155:2368'].assetAddress,
    amount: '100', payTo: recipient, maxTimeoutSeconds: 60,
  }, { ...DEFAULT_GUARD_POLICY, allowedRecipients: [payer] });
  assert.equal(verdict.isSafe, false);
  assert.equal(verdict.violations.some(v => v.code === 'UNTRUSTED_RECIPIENT'), true);
});

for (const amount of ['0', '-1']) {
  test(`target guard rejects nonpositive amount ${amount}`, () => {
    const verdict = auditX402ChallengeTarget({
      scheme: 'exact', network: 'eip155:2368', asset: KITE_CHAINS['eip155:2368'].assetAddress,
      amount, payTo: recipient, maxTimeoutSeconds: 60,
    });
    assert.equal(verdict.isSafe, false);
  });
}

test('signing refuses a server challenge that changes the selected service recipient', () => {
  const accept = {
    scheme: 'exact' as const, network: 'eip155:2368', asset: KITE_CHAINS['eip155:2368'].assetAddress,
    amount: '100', payTo: recipient, maxTimeoutSeconds: 60,
  };
  assert.throws(() => targetGuard.assertSafeSigningTarget(accept, payer, 'eip155:2368', 'sandbox', 'server'), /recipient/i);
});

test('browser wallet cannot sign any mock challenge', () => {
  const accept = {
    scheme: 'exact' as const, network: 'eip155:2368', asset: KITE_CHAINS['eip155:2368'].assetAddress,
    amount: '100', payTo: recipient, maxTimeoutSeconds: 60,
  };
  assert.throws(() => targetGuard.assertSafeSigningTarget(accept, recipient, 'eip155:2368', 'injected', 'fallback'), /browser wallet/i);
  assert.throws(() => targetGuard.assertSafeSigningTarget(accept, recipient, 'eip155:2368', 'injected', 'server'), /browser wallet/i);
  assert.doesNotThrow(() => targetGuard.assertSafeSigningTarget(accept, recipient, 'eip155:2368', 'sandbox', 'fallback'));
});

test('target guard uses the correct 50-token cap for each asset precision', () => {
  for (const [network, accepted, rejected] of [
    ['eip155:2366', '50000000', '50000001'],
    ['eip155:2368', '50000000000000000000', '50000000000000000001'],
  ]) {
    const accept = { scheme: 'exact' as const, network, asset: KITE_CHAINS[network].assetAddress, amount: accepted, payTo: recipient };
    assert.equal(auditX402ChallengeTarget(accept).isSafe, true);
    assert.equal(auditX402ChallengeTarget({ ...accept, amount: rejected }).isSafe, false);
  }
});

test('milestone payout requires the configured deliverable hash', () => {
  const vault = createMilestoneTask('task', payer, recipient, 100n, [
    { milestoneId: 'm1', title: 'Deliver', percentageBps: 10000, deliverableHash: '0xdeadbeef' },
  ]);
  assert.throws(() => releaseMilestonePayout(vault, 'm1'), /deliverable hash/i);
  assert.equal(releaseMilestonePayout(vault, 'm1', '0xdeadbeef').releasedAmountWei, 100n);
});

test('milestone payout is blocked after vault expiry', () => {
  const vault = createMilestoneTask('task', payer, recipient, 100n, [
    { milestoneId: 'm1', title: 'Deliver', percentageBps: 10000 },
  ]);
  vault.expiryTimestamp = 0;
  assert.throws(() => releaseMilestonePayout(vault, 'm1'), /expired/i);
});

test('escrow rejects invalid allocations and nonpositive deposits', () => {
  const milestones = [
    { milestoneId: 'm1', title: 'One', percentageBps: 20000 },
    { milestoneId: 'm2', title: 'Two', percentageBps: -10000 },
  ];
  assert.throws(() => createMilestoneTask('task', payer, recipient, 100n, milestones), /basis points/i);
  assert.throws(() => createMilestoneTask('task', payer, recipient, 0n, [{ milestoneId: 'm1', title: 'One', percentageBps: 10000 }]), /positive/i);
  assert.throws(() => createMilestoneTask('task', payer, recipient, 100n, [
    { milestoneId: 'm1', title: 'One', percentageBps: 5000 },
    { milestoneId: 'm1', title: 'Two', percentageBps: 5000 },
  ]), /duplicate/i);
});

test('a fabricated reputation score cannot grant credit without trusted verification', () => {
  const now = Math.floor(Date.now() / 1000);
  const proof = {
    agentAddress: payer, reputationScore: 1000,
    nullifierHash: '0x0' as const, attestationDigest: '0x0' as const,
    issuedAtTimestamp: now - 1, expiresAtTimestamp: now + 60,
  };
  assert.equal(evaluateAgentCreditLine(proof).isEligibleForPostSettlement, false);
  assert.equal(evaluateAgentCreditLine(proof, { verifyAttestation: () => false }).isEligibleForPostSettlement, false);
  assert.equal(evaluateAgentCreditLine(proof, { verifyAttestation: () => true }).maxCreditLimitWei, 5_000_000_000_000_000_000n);
});

test('a reputation score outside the supported range cannot grant credit', () => {
  const now = Math.floor(Date.now() / 1000);
  const proof = {
    agentAddress: payer, reputationScore: 1001,
    nullifierHash: '0x0' as const, attestationDigest: '0x0' as const,
    issuedAtTimestamp: now - 1, expiresAtTimestamp: now + 60,
  };
  assert.equal(evaluateAgentCreditLine(proof, { verifyAttestation: () => true }).isEligibleForPostSettlement, false);
});

test('stream channel rejects a negative ticket cost', () => {
  const channel = openStreamChannel('channel', payer, recipient, 100n);
  assert.throws(() => allocateStreamTicket(channel, -1n), /positive/i);
});

test('stream channel rejects nonpositive capacity', () => {
  assert.throws(() => openStreamChannel('channel', payer, recipient, 0n), /positive/i);
});

test('swarm bounty split rejects a negative bounty', () => {
  const result = calculateSwarmBountySplit(-100n, [
    { agentRole: 'coordinator', weightBps: 10000, assignedAddress: recipient },
  ]);
  assert.equal(result.isValid, false);
});

test('swarm bounty split rejects out-of-range weights even when their sum is 10000', () => {
  const result = calculateSwarmBountySplit(100n, [
    { agentRole: 'coordinator', weightBps: 20000, assignedAddress: payer },
    { agentRole: 'auditor', weightBps: -10000, assignedAddress: recipient },
  ]);
  assert.equal(result.isValid, false);
});

test('dataset revenue share rejects an out-of-range quality score', () => {
  assert.throws(() => calculateWeightedRevenueShare(100n, [
    { contributorAddress: recipient, acceptedTokensCount: 1, qualityScoreBps: 20000 },
  ]), /quality/i);
});
