import assert from 'node:assert/strict';
import test from 'node:test';
import { createSettlementBundle, executeSettlementBundle, generateReceiptProof, verifyReceiptInclusionProof, type BundledReceipt } from '../src/lib/batch-settlement-bundler.js';
import { createAgentBond, finalizeWithdrawal, initiateUnbonding, lockTaskCapacity, slashBond } from '../src/lib/agent-bonding-escrow.js';
import { createMarketOracle } from '../src/lib/dynamic-fee-market-oracle.js';
import { AgentCapabilityRegistry, type CapabilityRegistrationInput } from '../src/lib/agent-capability-registry.js';

const a = '0x1111111111111111111111111111111111111111' as const;
const b = '0x2222222222222222222222222222222222222222' as const;
const c = '0x3333333333333333333333333333333333333333' as const;
const token = '0x4444444444444444444444444444444444444444' as const;
const tx = `0x${'a'.repeat(64)}` as `0x${string}`;
const receipt = (id: string, payer: `0x${string}`, recipient: `0x${string}`): BundledReceipt => ({
  receiptId: id, payer, recipient, tokenAddress: token, amount: 10n,
  nonce: `0x${id.padStart(64, '0')}`, signature: '0x1234', timestamp: 1,
});

test('settlement bundle never invents an unsigned payer-recipient edge', () => {
  const bundle = createSettlementBundle({ bundleId: 'chain', tokenAddress: token,
    receipts: [receipt('1', a, b), receipt('2', b, c)], verifyReceiptAuthorization: () => true });
  assert.deepEqual(bundle.netTransfers.map(t => `${t.payer}:${t.recipient}`), [`${a}:${b}`, `${b}:${c}`]);
});

test('settlement requires verified authorization and independently confirmed transaction', () => {
  const r = receipt('1', a, b);
  assert.throws(() => createSettlementBundle({ bundleId: 'invalid', tokenAddress: token,
    receipts: [r], verifyReceiptAuthorization: () => false }), /authorization/i);
  const bundle = createSettlementBundle({ bundleId: 'valid', tokenAddress: token,
    receipts: [r], verifyReceiptAuthorization: () => true });
  const nonces = new Set<string>();
  assert.throws(() => executeSettlementBundle(bundle, tx, nonces, () => false), /confirm/i);
  assert.equal(nonces.size, 0);
  executeSettlementBundle(bundle, tx, nonces, () => true);
  assert.equal(nonces.size, 1);
  assert.throws(() => executeSettlementBundle(bundle, tx, nonces, () => true), /replay/i);
});

test('receipt proof must match a separately trusted root', () => {
  const bundle = createSettlementBundle({ bundleId: 'proof', tokenAddress: token,
    receipts: [receipt('1', a, b)], verifyReceiptAuthorization: () => true });
  const proof = generateReceiptProof('1', bundle);
  assert.equal(verifyReceiptInclusionProof(proof, bundle.merkleRoot), true);
  assert.equal(verifyReceiptInclusionProof(proof, `0x${'f'.repeat(64)}` as `0x${string}`), false);
  assert.equal(verifyReceiptInclusionProof({ ...proof, receiptId: 'not-the-receipt' }, bundle.merkleRoot), false);
});

test('slashing reaches unbonding funds and preserves active task locks', () => {
  const bond = createAgentBond({ agentAddress: a, depositWei: 100_000_000n, timestamp: 0 });
  const unbonding = initiateUnbonding(bond, 80_000_000n, 3600, 0);
  const { updatedBond } = slashBond(unbonding, 5000, b, 'sla_breach', tx, 1);
  assert.equal(updatedBond.stakedAmountWei + updatedBond.unbondingAmountWei, 50_000_000n);
  assert.ok(updatedBond.unbondingAmountWei < 80_000_000n);
  const locked = lockTaskCapacity(bond, 30_000_000n, 0);
  const partial = slashBond(locked, 100, b, 'sla_breach', tx, 1).updatedBond;
  assert.equal(partial.activeLockedWei, 30_000_000n);
  assert.throws(() => initiateUnbonding(partial, 1n, 3600, 2), /actively locked/i);
  assert.throws(() => initiateUnbonding(bond, 1n, 0, 0), /cooldown/i);
});

test('slash suspends an undercollateralized bond and residual funds can enter cooldown', () => {
  const bond = createAgentBond({ agentAddress: a, depositWei: 100_000_000n, timestamp: 0 });
  const locked = lockTaskCapacity(bond, 90_000_000n, 0);
  const afterSlash = slashBond(locked, 5000, b, 'sla_breach', tx, 1).updatedBond;
  assert.equal(afterSlash.status, 'slashed');
  assert.equal(afterSlash.activeLockedWei, 90_000_000n);
  assert.throws(() => lockTaskCapacity(afterSlash, 1n, 2), /status/i);
  const small = createAgentBond({ agentAddress: a, depositWei: 10_000_000n, timestamp: 0 });
  const residual = slashBond(small, 5000, b, 'sla_breach', tx, 1).updatedBond;
  assert.equal(residual.status, 'slashed');
  assert.equal(initiateUnbonding(residual, 5_000_000n, 3600, 2).status, 'unbonding');
  const cooling = initiateUnbonding(bond, 95_000_000n, 3600, 0);
  const reduced = slashBond(cooling, 5000, b, 'sla_breach', tx, 1).updatedBond;
  const finalized = finalizeWithdrawal(reduced, 3_600_001).updatedBond;
  assert.equal(finalized.status, 'slashed');
  assert.throws(() => lockTaskCapacity(finalized, 1n), /status/i);
});

test('payable fee oracle requires an issuer-held signing secret', () => {
  assert.throws(() => createMarketOracle(), /signing secret/i);
});

test('registry requires trusted registration and returns independent records', () => {
  assert.throws(() => new AgentCapabilityRegistry(), /verif/i);
  const registry = new AgentCapabilityRegistry(() => true);
  const input: CapabilityRegistrationInput = { provider: a, name: 'test', version: '1.0.0',
    category: 'llm-inference', toolSchema: { name: 'run', description: 'test', parameters: [] },
    costPerCallUsd: 0.1, avgLatencyMs: 100, reputationScore: 80 };
  const cap = registry.registerCapability(input);
  cap.costPerCallUsd = 0.00001;
  cap.toolSchema.name = 'tampered';
  assert.equal(registry.getCapability(cap.capabilityId)?.costPerCallUsd, 0.1);
  assert.equal(registry.getCapability(cap.capabilityId)?.toolSchema.name, 'run');
  const samePrefix = `0x111111${'f'.repeat(34)}`;
  const other = registry.registerCapability({ ...input, provider: samePrefix });
  assert.notEqual(cap.capabilityId, other.capabilityId);
  const otherRegistry = new AgentCapabilityRegistry(() => true);
  const changedSchema = otherRegistry.registerCapability({ ...input,
    toolSchema: { ...input.toolSchema, name: 'another-tool' } });
  assert.notEqual(cap.hash, changedSchema.hash);
});
