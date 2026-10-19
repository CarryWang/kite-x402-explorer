import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAgentBond,
  calculateBondTier,
  lockTaskCapacity,
  releaseTaskCapacity,
  slashBond,
  initiateUnbonding,
  finalizeWithdrawal,
  MIN_BOND_AMOUNT_WEI,
  type AgentBondRecord,
} from '../src/lib/agent-bonding-escrow.js';

const AGENT_ADDRESS = '0x1234567890123456789012345678901234567890' as `0x${string}`;
const CLIENT_ADDRESS = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as `0x${string}`;
const DUMMY_HASH = '0x1111111111111111111111111111111111111111111111111111111111111111' as `0x${string}`;

test('createAgentBond validates address format and minimum deposit requirement', () => {
  const bond = createAgentBond({
    agentAddress: AGENT_ADDRESS,
    depositWei: 50_000_000n,
    timestamp: 1700000000000,
  });

  assert.equal(bond.agentAddress, AGENT_ADDRESS);
  assert.equal(bond.stakedAmountWei, 50_000_000n);
  assert.equal(bond.activeLockedWei, 0n);
  assert.equal(bond.status, 'active');
  assert.equal(bond.reputationScore, 500);
  assert.match(bond.bondId, /^bond-[a-f0-9]{12}$/);

  // Rejects invalid address
  assert.throws(
    () => createAgentBond({ agentAddress: '0xnotanaddress' as `0x${string}`, depositWei: 50_000_000n }),
    /Invalid agent address/
  );

  // Rejects deposit below minimum
  assert.throws(
    () => createAgentBond({ agentAddress: AGENT_ADDRESS, depositWei: MIN_BOND_AMOUNT_WEI - 1n }),
    /below minimum requirement/
  );
});

test('calculateBondTier assigns proper tier, concurrency limit and multipliers', () => {
  const baseBond: AgentBondRecord = {
    bondId: 'bond-1',
    agentAddress: AGENT_ADDRESS,
    stakedAmountWei: 20_000_000n,
    activeLockedWei: 0n,
    unbondingAmountWei: 0n,
    unbondingCooldownDeadline: null,
    status: 'active',
    reputationScore: 450,
    registeredAt: 1000,
    lastActivityAt: 1000,
  };

  // Bronze Tier
  const bronze = calculateBondTier(baseBond);
  assert.equal(bronze.tierName, 'bronze');
  assert.equal(bronze.maxConcurrentTasks, 3);
  assert.equal(bronze.creditMultiplier, 0.8);

  // Silver Tier
  const silver = calculateBondTier({
    ...baseBond,
    stakedAmountWei: 60_000_000n,
    reputationScore: 650,
  });
  assert.equal(silver.tierName, 'silver');
  assert.equal(silver.maxConcurrentTasks, 10);
  assert.equal(silver.creditMultiplier, 1.0);

  // Gold Tier
  const gold = calculateBondTier({
    ...baseBond,
    stakedAmountWei: 300_000_000n,
    reputationScore: 800,
  });
  assert.equal(gold.tierName, 'gold');
  assert.equal(gold.maxConcurrentTasks, 30);
  assert.equal(gold.creditMultiplier, 1.5);

  // Sovereign Tier
  const sovereign = calculateBondTier({
    ...baseBond,
    stakedAmountWei: 1_200_000_000n,
    reputationScore: 950,
  });
  assert.equal(sovereign.tierName, 'sovereign');
  assert.equal(sovereign.maxConcurrentTasks, 100);
  assert.equal(sovereign.creditMultiplier, 2.0);

  // Inactive bond drops to unverified with zero capacity
  const inactive = calculateBondTier({ ...baseBond, status: 'unbonding' });
  assert.equal(inactive.tierName, 'unverified');
  assert.equal(inactive.maxConcurrentTasks, 0);
});

test('lockTaskCapacity enforces stake boundaries and rejects over-allocation', () => {
  const bond = createAgentBond({
    agentAddress: AGENT_ADDRESS,
    depositWei: 20_000_000n,
  });

  const locked = lockTaskCapacity(bond, 15_000_000n);
  assert.equal(locked.activeLockedWei, 15_000_000n);

  // Rejects when remaining stake is insufficient
  assert.throws(() => lockTaskCapacity(locked, 10_000_000n), /Insufficient available stake/);

  // Rejects nonpositive allocation
  assert.throws(() => lockTaskCapacity(bond, 0n), /strictly positive/);
  assert.throws(() => lockTaskCapacity(bond, -100n), /strictly positive/);
});

test('releaseTaskCapacity decreases locked amount and rewards reputation', () => {
  const bond = lockTaskCapacity(
    createAgentBond({ agentAddress: AGENT_ADDRESS, depositWei: 20_000_000n }),
    10_000_000n
  );

  // Success path
  const successRelease = releaseTaskCapacity(bond, 5_000_000n, true);
  assert.equal(successRelease.activeLockedWei, 5_000_000n);
  assert.equal(successRelease.reputationScore, 505); // +5

  // Failure path
  const failureRelease = releaseTaskCapacity(successRelease, 5_000_000n, false);
  assert.equal(failureRelease.activeLockedWei, 0n);
  assert.equal(failureRelease.reputationScore, 480); // 505 - 25

  // Rejects releasing more than locked
  assert.throws(() => releaseTaskCapacity(failureRelease, 1n, true), /exceeding active locked amount/);
});

test('slashBond executes penalization and emits verifiable slash event', () => {
  const bond = createAgentBond({
    agentAddress: AGENT_ADDRESS,
    depositWei: 50_000_000n,
  });

  // Slash 20% (2000 bps)
  const { updatedBond, slashEvent } = slashBond(
    bond,
    2000,
    CLIENT_ADDRESS,
    'sla_breach',
    DUMMY_HASH
  );

  assert.equal(slashEvent.slashedWei, 10_000_000n);
  assert.equal(slashEvent.beneficiary, CLIENT_ADDRESS);
  assert.equal(slashEvent.reason, 'sla_breach');
  assert.equal(updatedBond.stakedAmountWei, 40_000_000n);
  assert.equal(updatedBond.status, 'active');

  // Catastrophic slash that brings stake below minimum
  const { updatedBond: catastrophicBond } = slashBond(
    updatedBond,
    9000,
    CLIENT_ADDRESS,
    'byzantine_disagreement',
    DUMMY_HASH
  );
  assert.equal(catastrophicBond.status, 'slashed');
});

test('initiateUnbonding and finalizeWithdrawal enforce cooldown time lock', () => {
  const start = 1700000000000;
  const bond = createAgentBond({
    agentAddress: AGENT_ADDRESS,
    depositWei: 50_000_000n,
    timestamp: start,
  });

  // Cannot unbond if tasks are actively locked
  const locked = lockTaskCapacity(bond, 10_000_000n, start);
  assert.throws(() => initiateUnbonding(locked, 20_000_000n, 3600, start), /actively locked in compute tasks/);

  // Initiate partial unbonding
  const unbonding = initiateUnbonding(bond, 30_000_000n, 3600, start);
  assert.equal(unbonding.status, 'unbonding');
  assert.equal(unbonding.stakedAmountWei, 20_000_000n);
  assert.equal(unbonding.unbondingAmountWei, 30_000_000n);
  assert.equal(unbonding.unbondingCooldownDeadline, start + 3600 * 1000);

  // Early withdrawal attempt before cooldown fails
  assert.throws(
    () => finalizeWithdrawal(unbonding, start + 1800 * 1000),
    /cooldown period has not elapsed yet/
  );

  // Matured withdrawal after cooldown succeeds
  const { updatedBond, withdrawnWei } = finalizeWithdrawal(unbonding, start + 3601 * 1000);
  assert.equal(withdrawnWei, 30_000_000n);
  assert.equal(updatedBond.unbondingAmountWei, 0n);
  assert.equal(updatedBond.unbondingCooldownDeadline, null);
  assert.equal(updatedBond.status, 'active'); // Remaining stake >= min bond => stays active
});
