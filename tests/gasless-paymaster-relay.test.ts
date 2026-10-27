import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPaymasterPool as createPaymasterPoolVerified,
  depositGasToPool,
  validateSponsorshipEligibility,
  executeSponsoredRelay,
  getPaymasterMetrics,
  type PaymasterPolicy,
  type RelayRequest,
} from '../src/lib/gasless-paymaster-relay.js';

const SPONSOR = '0x1111111111111111111111111111111111111111';
const AGENT = '0x2222222222222222222222222222222222222222';
const TOKEN = '0x3333333333333333333333333333333333333333';
const createPaymasterPool = (params: Parameters<typeof createPaymasterPoolVerified>[0]) => createPaymasterPoolVerified(params, () => true);

const DEFAULT_POLICY: PaymasterPolicy = {
  maxGasLimitPerTx: 250_000n,
  allowedTokens: [TOKEN],
  dailyAgentGasCapWei: 1_000_000_000_000_000n, // 0.001 ETH
};

test('createPaymasterPool creates pool with valid configuration', () => {
  const pool = createPaymasterPool({
    poolId: 'pool-alpha',
    sponsor: SPONSOR,
    initialDepositWei: 10_000_000_000_000_000n,
    policy: DEFAULT_POLICY,
  });

  assert.equal(pool.poolId, 'pool-alpha');
  assert.equal(pool.balanceWei, 10_000_000_000_000_000n);
  assert.equal(pool.spentWei, 0n);
});

test('depositGasToPool increments pool balance', () => {
  const pool = createPaymasterPool({
    poolId: 'pool-beta',
    sponsor: SPONSOR,
    initialDepositWei: 1_000n,
    policy: DEFAULT_POLICY,
  });

  const updated = depositGasToPool(pool, 5_000n, () => true);
  assert.equal(updated.balanceWei, 6_000n);
});

test('validateSponsorshipEligibility validates token and limits correctly', () => {
  const pool = createPaymasterPool({
    poolId: 'pool-gamma',
    sponsor: SPONSOR,
    initialDepositWei: 10_000_000_000_000_000n,
    policy: DEFAULT_POLICY,
  });

  const validReq: RelayRequest = {
    agent: AGENT,
    token: TOKEN,
    amount: 100n,
    estimatedGas: 100_000n,
    nonce: '0xabc123',
    signature: '0xdef456',
  };

  const gasPrice = 1_000_000_000n; // 1 Gwei
  const check = validateSponsorshipEligibility(pool, validReq, gasPrice);
  assert.equal(check.eligible, true);

  // Unsupported token
  const invalidTokenReq = { ...validReq, token: '0x9999999999999999999999999999999999999999' };
  const checkToken = validateSponsorshipEligibility(pool, invalidTokenReq, gasPrice);
  assert.equal(checkToken.eligible, false);
  assert.match(checkToken.reason!, /not supported/);

  // Gas exceeds max per tx
  const heavyGasReq = { ...validReq, estimatedGas: 500_000n };
  const checkGas = validateSponsorshipEligibility(pool, heavyGasReq, gasPrice);
  assert.equal(checkGas.eligible, false);
  assert.match(checkGas.reason!, /exceeds max limit/);
});

test('executeSponsoredRelay deducts balance and issues receipt', () => {
  const pool = createPaymasterPool({
    poolId: 'pool-delta',
    sponsor: SPONSOR,
    initialDepositWei: 1_000_000_000_000_000n,
    policy: DEFAULT_POLICY,
  });

  const req: RelayRequest = {
    agent: AGENT,
    token: TOKEN,
    amount: 50n,
    estimatedGas: 100_000n,
    nonce: '0xnonce999',
    signature: '0xsig888',
  };

  const gasPrice = 2_000_000_000n; // 2 Gwei
  const { receipt, updatedPool } = executeSponsoredRelay(pool, req, gasPrice, () => true);

  assert.equal(receipt.status, 'sponsored');
  assert.equal(receipt.totalCostWei, 200_000_000_000_000n);
  assert.equal(updatedPool.spentWei, 200_000_000_000_000n);
  assert.equal(updatedPool.balanceWei, 800_000_000_000_000n);
});

test('getPaymasterMetrics aggregates metrics across pools', () => {
  const p1 = createPaymasterPool({
    poolId: 'p1',
    sponsor: SPONSOR,
    initialDepositWei: 1_000n,
    policy: DEFAULT_POLICY,
  });
  const p2 = createPaymasterPool({
    poolId: 'p2',
    sponsor: '0x4444444444444444444444444444444444444444',
    initialDepositWei: 3_000n,
    policy: DEFAULT_POLICY,
  });

  const metrics = getPaymasterMetrics([p1, p2]);
  assert.equal(metrics.totalPools, 2);
  assert.equal(metrics.totalBalanceWei, 4_000n);
  assert.equal(metrics.activeSponsors, 2);
});

test('rejects negative gas cost and unsigned sponsorship', () => {
  const pool = createPaymasterPool({ poolId: 'secure', sponsor: SPONSOR, initialDepositWei: 1_000_000n, policy: DEFAULT_POLICY });
  const request: RelayRequest = { agent: AGENT, token: TOKEN, amount: 1n, estimatedGas: -1n, nonce: 'once', signature: 'fake' };
  assert.equal(validateSponsorshipEligibility(pool, request, 1n).eligible, false);
  assert.throws(() => executeSponsoredRelay(pool, { ...request, estimatedGas: 1n }, 1n), /verif|sign|auth/i);
});

test('cannot sponsor the same agent nonce twice', () => {
  const pool = createPaymasterPool({ poolId: 'replay', sponsor: SPONSOR, initialDepositWei: 1_000_000n, policy: DEFAULT_POLICY });
  const request: RelayRequest = { agent: AGENT, token: TOKEN, amount: 1n, estimatedGas: 1n, nonce: 'once', signature: 'verified-externally' };
  const first = executeSponsoredRelay(pool, request, 1n, () => true);
  assert.throws(() => executeSponsoredRelay(first.updatedPool, request, 1n, () => true), /nonce/i);
});

test('pool creation requires verified sponsor funding', () => {
  assert.throws(() => createPaymasterPoolVerified({ poolId: 'unfunded', sponsor: SPONSOR, initialDepositWei: 100n, policy: DEFAULT_POLICY }), /fund|verif/i);
});
