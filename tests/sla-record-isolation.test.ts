import test from 'node:test';
import assert from 'node:assert/strict';
import { AgentSLAOracle, type AgentHeartbeat } from '../src/lib/agent-sla-oracle.js';

test('historical heartbeat data cannot change after its caller reuses the input object', () => {
  const oracle = new AgentSLAOracle();
  const ping: AgentHeartbeat = { agentAddress: 'fixture-agent', serviceId: 'svc', timestamp: 1,
    blockNumber: 1, latencyMs: 100, statusCode: 200, signature: 'local-unverified-fixture' };
  oracle.recordHeartbeat(ping);
  ping.latencyMs = 9999;
  ping.statusCode = 500;
  const metrics = oracle.evaluateSLAMetrics('svc');
  assert.equal(metrics.successfulPings, 1);
  assert.equal(metrics.avgLatencyMs, 100);
});

test('issued and queried vouchers are snapshots and cannot undo redemption', () => {
  const oracle = new AgentSLAOracle();
  const issued = oracle.issueCallerRefund('caller', 'svc', 'fixture-penalty', 1);
  issued.isRedeemed = true;
  assert.equal(oracle.redeemVoucher(issued.voucherId), true);
  const fetched = oracle.getVouchersForCaller('caller')[0];
  fetched.isRedeemed = false;
  fetched.rebateAmountKite = 999;
  assert.equal(oracle.redeemVoucher(issued.voucherId), false);
  assert.equal(oracle.getVouchersForCaller('caller')[0].rebateAmountKite, 1);
});

test('penalty creation and query results cannot rewrite the retained diagnostic history', () => {
  const oracle = new AgentSLAOracle();
  oracle.registerSLASpec({ provider: 'provider', serviceId: 'svc', minUptimePercent: 99,
    maxP95LatencyMs: 500, maxErrorRatePercent: 1, stakedCollateralKite: 100, penaltyPerBreachKite: 10 });
  for (let i = 0; i < 10; i++) oracle.recordHeartbeat({ agentAddress: 'agent', serviceId: 'svc', timestamp: i,
    blockNumber: i, latencyMs: 100, statusCode: 500, signature: 'local-fixture' });
  const penalty = oracle.evaluateAndSlash('svc')!;
  penalty.slashedAmountKite = 999;
  const fetched = oracle.getPenalties();
  assert.equal(fetched[0].slashedAmountKite, 10);
  fetched[0].remainingCollateralKite = -1;
  assert.equal(oracle.getPenalties()[0].remainingCollateralKite, 90);
});
