import assert from 'node:assert/strict';
import test from 'node:test';
import {
  routeComputeRequest,
  estimateTierCost,
  computeExecutionTicketHash,
  DEFAULT_TIER_SPECIFICATIONS,
  type ComputeRoutingRequest,
} from '../src/lib/compute-tier-router.ts';

const mockPayer = '0x1234567890123456789012345678901234567890' as const;

test('nano tier selection for small prompt within lightweight budget', () => {
  const req: ComputeRoutingRequest = {
    requestId: 'req_nano_01',
    payer: mockPayer,
    promptTokens: 200,
    maxCompletionTokens: 100,
    maxBudgetUnits: 200_000_000_000_000n, // 0.0002
    preferredTier: 'nano',
  };

  const decision = routeComputeRequest(req);
  assert.equal(decision.isRoutable, true);
  assert.equal(decision.selectedTier, 'nano');
  assert.equal(decision.modelIdentifier, 'kite-nano-v1');
  assert.equal(decision.fallbackTriggered, false);
  assert.ok(decision.estimatedCostUnits <= req.maxBudgetUnits);
  assert.match(decision.executionTicketHash ?? '', /^0x[0-9a-f]{64}$/);
});

test('reasoning tier selection when requireReasoning is requested and budget suffices', () => {
  const req: ComputeRoutingRequest = {
    requestId: 'req_cot_01',
    payer: mockPayer,
    promptTokens: 1500,
    maxCompletionTokens: 1000,
    maxBudgetUnits: 10_000_000_000_000_000n, // 0.010
    requireReasoning: true,
  };

  const decision = routeComputeRequest(req);
  assert.equal(decision.isRoutable, true);
  assert.ok(decision.selectedTier === 'reasoning' || decision.selectedTier === 'deep-inference');
  assert.ok(decision.estimatedCostUnits <= req.maxBudgetUnits);
});

test('graceful fallback when preferred reasoning tier exceeds budget', () => {
  const req: ComputeRoutingRequest = {
    requestId: 'req_fallback_01',
    payer: mockPayer,
    promptTokens: 500,
    maxCompletionTokens: 200,
    maxBudgetUnits: 1_000_000_000_000_000n, // 0.001 - enough for balanced (0.0005) but not reasoning (0.002)
    preferredTier: 'reasoning',
    requireReasoning: false,
  };

  const decision = routeComputeRequest(req);
  assert.equal(decision.isRoutable, true);
  assert.equal(decision.selectedTier, 'balanced');
  assert.equal(decision.fallbackTriggered, true);
});

test('rejection when budget is zero or negative', () => {
  for (const invalidBudget of [0n, -500n]) {
    const req: ComputeRoutingRequest = {
      requestId: 'req_neg_budget',
      payer: mockPayer,
      promptTokens: 100,
      maxCompletionTokens: 50,
      maxBudgetUnits: invalidBudget,
    };
    const decision = routeComputeRequest(req);
    assert.equal(decision.isRoutable, false);
    assert.match(decision.rejectionReason ?? '', /budget/i);
  }
});

test('rejection when prompt tokens is nonpositive', () => {
  const req: ComputeRoutingRequest = {
    requestId: 'req_invalid_tokens',
    payer: mockPayer,
    promptTokens: 0,
    maxCompletionTokens: 50,
    maxBudgetUnits: 1_000_000_000_000_000n,
  };
  const decision = routeComputeRequest(req);
  assert.equal(decision.isRoutable, false);
  assert.match(decision.rejectionReason ?? '', /prompt tokens/i);
});

test('rejection when SLA latency constraint cannot be met', () => {
  const req: ComputeRoutingRequest = {
    requestId: 'req_impossible_latency',
    payer: mockPayer,
    promptTokens: 100,
    maxCompletionTokens: 50,
    maxBudgetUnits: 10_000_000_000_000_000n,
    maxAllowedLatencyMs: 50, // All tiers have p95 >= 120ms
  };
  const decision = routeComputeRequest(req);
  assert.equal(decision.isRoutable, false);
  assert.match(decision.rejectionReason ?? '', /incompatible constraints/i);
});

test('deterministic execution ticket hash generation', () => {
  const hash1 = computeExecutionTicketHash(
    'req_100',
    mockPayer,
    'balanced',
    'kite-balanced-v2',
    500000000000000n
  );
  const hash2 = computeExecutionTicketHash(
    'req_100',
    mockPayer,
    'balanced',
    'kite-balanced-v2',
    500000000000000n
  );
  const hash3 = computeExecutionTicketHash(
    'req_101',
    mockPayer,
    'balanced',
    'kite-balanced-v2',
    500000000000000n
  );

  assert.equal(hash1, hash2);
  assert.notEqual(hash1, hash3);
  assert.match(hash1, /^0x[0-9a-f]{64}$/);
});

test('router rejects fractional tokens and unconfigured mainnet unit pricing', () => {
  const base: ComputeRoutingRequest = {
    requestId: 'req', payer: mockPayer, promptTokens: 100, maxCompletionTokens: 10,
    maxBudgetUnits: 1_000_000_000_000_000n,
  };
  assert.equal(routeComputeRequest({ ...base, promptTokens: 1.5 }).isRoutable, false);
  assert.equal(routeComputeRequest({ ...base, network: 'eip155:2366' }).isRoutable, false);
});

test('zero or negative SLA limits are rejected', () => {
  const base: ComputeRoutingRequest = {
    requestId: 'req_latency', payer: mockPayer, promptTokens: 100, maxCompletionTokens: 10,
    maxBudgetUnits: 1_000_000_000_000_000n,
  };
  for (const maxAllowedLatencyMs of [0, -1]) {
    const result = routeComputeRequest({ ...base, maxAllowedLatencyMs });
    assert.equal(result.isRoutable, false);
    assert.match(result.rejectionReason ?? '', /latency/i);
  }
});

test('cost estimation calculates base plus token rate with ceil rounding', () => {
  const spec = DEFAULT_TIER_SPECIFICATIONS.nano;
  // prompt: 500, output: 501 => total 1001 tokens.
  // rate per 1k = 50_000_000_000_000n
  // (1001 * 50_000_000_000_000 + 999) / 1000 = 50_050_000_000_000n
  const cost = estimateTierCost(spec, 500, 501);
  assert.equal(cost.baseCostUnits, spec.baseCostUnits);
  assert.equal(cost.tokenCostUnits, 50_050_000_000_000n);
  assert.equal(cost.totalCostUnits, spec.baseCostUnits + 50_050_000_000_000n);
});
