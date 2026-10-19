import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createSessionAllowance,
  authorizeSessionSpend,
  type DelegatedAllowanceConfig,
  type SessionSpendRequest,
} from '../src/lib/session-allowance-manager.ts';

const granter = '0x1111111111111111111111111111111111111111' as const;
const delegate = '0x2222222222222222222222222222222222222222' as const;
const merchantA = '0x3333333333333333333333333333333333333333' as const;
const merchantB = '0x4444444444444444444444444444444444444444' as const;
const verifiedAt = (currentTimestamp: number) => ({
  verifyGrant: () => true,
  verifySpend: () => true,
  currentTimestamp,
});

test('creation of valid delegated session allowance record', () => {
  const allowance = createSessionAllowance(
    'sess_01',
    granter,
    delegate,
    1_000_000_000_000_000_000n, // 1 token
    1000,
    2000,
    [merchantA]
  );

  assert.equal(allowance.sessionId, 'sess_01');
  assert.equal(allowance.granter, granter);
  assert.equal(allowance.delegateAgent, delegate);
  assert.equal(allowance.totalAllowanceUnits, 1_000_000_000_000_000_000n);
  assert.equal(allowance.spentUnits, 0n);
  assert.equal(allowance.isRevoked, false);
});

test('rejection of self-delegation where granter equals delegate', () => {
  assert.throws(
    () => createSessionAllowance('sess_bad', granter, granter, 100n, 1000, 2000),
    /same address/i
  );
});

test('rejection of invalid budget or timestamp window', () => {
  assert.throws(
    () => createSessionAllowance('sess_bad', granter, delegate, 0n, 1000, 2000),
    /positive/i
  );
  assert.throws(
    () => createSessionAllowance('sess_bad', granter, delegate, 100n, 2000, 1000),
    /expiration/i
  );
});

test('authorized spend reduces remaining units and returns deterministic receipt', () => {
  const allowance = createSessionAllowance(
    'sess_02',
    granter,
    delegate,
    500_000n,
    1000,
    2000,
    [merchantA]
  );

  const spend: SessionSpendRequest = {
    sessionId: 'sess_02',
    delegateAgent: delegate,
    amountUnits: 150_000n,
    recipient: merchantA,
    timestamp: 1500,
  };

  const result = authorizeSessionSpend(allowance, spend, verifiedAt(1500));
  assert.equal(result.isAuthorized, true);
  assert.equal(result.remainingUnits, 350_000n);
  assert.match(result.receiptHash ?? '', /^0x[0-9a-f]{64}$/);
});

test('repeated approved spends consume the shared allowance and cannot exceed it', () => {
  const allowance = createSessionAllowance('sess_repeat', granter, delegate, 100n, 1000, 2000, [merchantA]);
  const spend = { sessionId: 'sess_repeat', delegateAgent: delegate, amountUnits: 60n, recipient: merchantA, timestamp: 1500 } as SessionSpendRequest;
  assert.equal(authorizeSessionSpend(allowance, spend, verifiedAt(1500)).isAuthorized, true);
  assert.equal(allowance.spentUnits, 60n);
  assert.equal(authorizeSessionSpend(allowance, spend, verifiedAt(1500)).isAuthorized, false);
});

test('session allowance rejects wrong session or delegate identity', () => {
  const allowance = createSessionAllowance('sess_identity', granter, delegate, 100n, 1000, 2000);
  const spend = { sessionId: 'wrong', delegateAgent: delegate, amountUnits: 10n, recipient: merchantA, timestamp: 1500 } as SessionSpendRequest;
  assert.equal(authorizeSessionSpend(allowance, spend, verifiedAt(1500)).isAuthorized, false);
  assert.equal(authorizeSessionSpend(allowance, { ...spend, sessionId: 'sess_identity', delegateAgent: merchantB } as SessionSpendRequest, verifiedAt(1500)).isAuthorized, false);
});

test('unverified grants and delegate requests cannot authorize a spend', () => {
  const allowance = createSessionAllowance('sess_untrusted', granter, delegate, 100n, 1000, 2000);
  const spend: SessionSpendRequest = { sessionId: 'sess_untrusted', delegateAgent: delegate, amountUnits: 10n, recipient: merchantA, timestamp: 1500 };
  assert.equal(authorizeSessionSpend(allowance, spend).isAuthorized, false);
  assert.equal(authorizeSessionSpend(allowance, spend, { verifyGrant: () => true, verifySpend: () => false, currentTimestamp: 1500 }).isAuthorized, false);
});

test('caller-supplied timestamp cannot bypass a trusted expired clock', () => {
  const allowance = createSessionAllowance('sess_clock', granter, delegate, 100n, 1000, 2000);
  const spend: SessionSpendRequest = { sessionId: 'sess_clock', delegateAgent: delegate, amountUnits: 10n, recipient: merchantA, timestamp: 1500 };
  assert.equal(authorizeSessionSpend(allowance, spend, { verifyGrant: () => true, verifySpend: () => true, currentTimestamp: 2001 }).isAuthorized, false);
});

test('an empty explicit recipient allowlist denies all spends', () => {
  const allowance = createSessionAllowance('sess_empty', granter, delegate, 100n, 1000, 2000, []);
  const spend: SessionSpendRequest = { sessionId: 'sess_empty', delegateAgent: delegate, amountUnits: 10n, recipient: merchantA, timestamp: 1500 };
  assert.equal(authorizeSessionSpend(allowance, spend, { verifyGrant: () => true, verifySpend: () => true, currentTimestamp: 1500 }).isAuthorized, false);
});

test('rejection of spend exceeding remaining session budget', () => {
  const allowance: DelegatedAllowanceConfig = {
    sessionId: 'sess_budget_cap',
    granter,
    delegateAgent: delegate,
    totalAllowanceUnits: 100n,
    spentUnits: 80n,
    validAfter: 1000,
    validBefore: 2000,
    isRevoked: false,
    createdAt: 1000,
  };

  const spend: SessionSpendRequest = {
    sessionId: 'sess_budget_cap',
    delegateAgent: delegate,
    amountUnits: 30n, // only 20 remaining
    recipient: merchantA,
    timestamp: 1500,
  };

  const result = authorizeSessionSpend(allowance, spend, verifiedAt(1500));
  assert.equal(result.isAuthorized, false);
  assert.match(result.rejectionReason ?? '', /exceeds/i);
});

test('rejection of spend outside validity window', () => {
  const allowance = createSessionAllowance(
    'sess_time',
    granter,
    delegate,
    1000n,
    1000,
    2000
  );

  // Premature spend
  const early = authorizeSessionSpend(allowance, {
    sessionId: 'sess_time',
    delegateAgent: delegate,
    amountUnits: 50n,
    recipient: merchantA,
    timestamp: 999,
  }, verifiedAt(999));
  assert.equal(early.isAuthorized, false);
  assert.match(early.rejectionReason ?? '', /not yet active/i);

  // Expired spend
  const late = authorizeSessionSpend(allowance, {
    sessionId: 'sess_time',
    delegateAgent: delegate,
    amountUnits: 50n,
    recipient: merchantA,
    timestamp: 2001,
  }, verifiedAt(2001));
  assert.equal(late.isAuthorized, false);
  assert.match(late.rejectionReason ?? '', /expired/i);
});

test('enforcement of allowedRecipients allowlist', () => {
  const allowance = createSessionAllowance(
    'sess_allowlist',
    granter,
    delegate,
    1000n,
    1000,
    2000,
    [merchantA]
  );

  // Unauthorized merchant B
  const rejected = authorizeSessionSpend(allowance, {
    sessionId: 'sess_allowlist',
    delegateAgent: delegate,
    amountUnits: 50n,
    recipient: merchantB,
    timestamp: 1500,
  }, verifiedAt(1500));
  assert.equal(rejected.isAuthorized, false);
  assert.match(rejected.rejectionReason ?? '', /not in the delegated allowlist/i);
});

test('rejection of spend on revoked session allowance', () => {
  const allowance = createSessionAllowance(
    'sess_revoked',
    granter,
    delegate,
    1000n,
    1000,
    2000
  );
  allowance.isRevoked = true;

  const result = authorizeSessionSpend(allowance, {
    sessionId: 'sess_revoked',
    delegateAgent: delegate,
    amountUnits: 50n,
    recipient: merchantA,
    timestamp: 1500,
  }, verifiedAt(1500));
  assert.equal(result.isAuthorized, false);
  assert.match(result.rejectionReason ?? '', /revoked/i);
});
