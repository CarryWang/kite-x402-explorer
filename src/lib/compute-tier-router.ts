/**
 * Compute Tier Router & Intelligent AI Model Execution Allocator for Kite Chain.
 *
 * Coordinates multi-model LLM/compute routing across micro-tiers (Nano, Balanced, Reasoning, Deep-Inference)
 * under x402 payment constraints. Ensures deterministic execution ticket generation,
 * dynamic budget fallback, and strict SLA latency adherence.
 */

export type ComputeTier = 'nano' | 'balanced' | 'reasoning' | 'deep-inference';

export interface TierSpecification {
  tier: ComputeTier;
  displayName: string;
  baseCostUnits: bigint;
  tokenRatePer1kUnits: bigint;
  maxContextTokens: number;
  maxOutputTokens: number;
  p95LatencyMs: number;
  supportsReasoning: boolean;
  modelIdentifier: string;
}

export interface ComputeRoutingRequest {
  requestId: string;
  payer: `0x${string}`;
  promptTokens: number;
  maxCompletionTokens: number;
  maxBudgetUnits: bigint;
  maxAllowedLatencyMs?: number;
  requireReasoning?: boolean;
  preferredTier?: ComputeTier;
  network?: 'eip155:2366' | 'eip155:2368';
}

export interface RoutingDecision {
  requestId: string;
  isRoutable: boolean;
  selectedTier?: ComputeTier;
  modelIdentifier?: string;
  estimatedCostUnits: bigint;
  baseCostUnits: bigint;
  tokenCostUnits: bigint;
  estimatedLatencyMs: number;
  fallbackTriggered: boolean;
  executionTicketHash?: string;
  rejectionReason?: string;
}

/**
 * Standard tier specs calibrated for Kite AI agent micro-transactions (18-decimal base).
 */
export const DEFAULT_TIER_SPECIFICATIONS: Record<ComputeTier, TierSpecification> = {
  nano: {
    tier: 'nano',
    displayName: 'Kite Nano Micro-Inference',
    baseCostUnits: 100_000_000_000_000n, // 0.0001
    tokenRatePer1kUnits: 50_000_000_000_000n, // 0.00005 per 1k tokens
    maxContextTokens: 8192,
    maxOutputTokens: 2048,
    p95LatencyMs: 120,
    supportsReasoning: false,
    modelIdentifier: 'kite-nano-v1',
  },
  balanced: {
    tier: 'balanced',
    displayName: 'Kite Balanced Agent Model',
    baseCostUnits: 500_000_000_000_000n, // 0.0005
    tokenRatePer1kUnits: 200_000_000_000_000n, // 0.0002 per 1k tokens
    maxContextTokens: 32768,
    maxOutputTokens: 8192,
    p95LatencyMs: 450,
    supportsReasoning: false,
    modelIdentifier: 'kite-balanced-v2',
  },
  reasoning: {
    tier: 'reasoning',
    displayName: 'Kite Reasoning CoT Engine',
    baseCostUnits: 2_000_000_000_000_000n, // 0.002
    tokenRatePer1kUnits: 1_000_000_000_000_000n, // 0.001 per 1k tokens
    maxContextTokens: 65536,
    maxOutputTokens: 16384,
    p95LatencyMs: 1800,
    supportsReasoning: true,
    modelIdentifier: 'kite-reasoning-r1',
  },
  'deep-inference': {
    tier: 'deep-inference',
    displayName: 'Kite Deep-Inference Pro',
    baseCostUnits: 8_000_000_000_000_000n, // 0.008
    tokenRatePer1kUnits: 4_000_000_000_000_000n, // 0.004 per 1k tokens
    maxContextTokens: 131072,
    maxOutputTokens: 32768,
    p95LatencyMs: 4200,
    supportsReasoning: true,
    modelIdentifier: 'kite-deep-math-r1',
  },
};

/**
 * Calculates total expected execution cost for a given tier and token load.
 */
export function estimateTierCost(
  spec: TierSpecification,
  promptTokens: number,
  maxCompletionTokens: number
): { totalCostUnits: bigint; baseCostUnits: bigint; tokenCostUnits: bigint } {
  const totalTokens = BigInt(Math.max(0, promptTokens + maxCompletionTokens));
  const tokenCostUnits = (totalTokens * spec.tokenRatePer1kUnits + 999n) / 1000n;
  const totalCostUnits = spec.baseCostUnits + tokenCostUnits;
  return {
    totalCostUnits,
    baseCostUnits: spec.baseCostUnits,
    tokenCostUnits,
  };
}

/**
 * Generates a deterministic hex hash for execution ticket verification.
 */
export function computeExecutionTicketHash(
  requestId: string,
  payer: string,
  tier: string,
  model: string,
  costUnits: bigint
): string {
  const input = `${requestId}:${payer.toLowerCase()}:${tier}:${model}:${costUnits.toString()}`;
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const part1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const part2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return `0xtkt_${part1}${part2}`;
}

/**
 * Selects the optimal model compute tier matching budget, latency, token limits,
 * and reasoning requirements. Performs graceful degradation when preferred tiers
 * exceed budget.
 */
export function routeComputeRequest(
  request: ComputeRoutingRequest,
  tierSpecs: Record<ComputeTier, TierSpecification> = DEFAULT_TIER_SPECIFICATIONS
): RoutingDecision {
  if (request.maxBudgetUnits <= 0n) {
    return {
      requestId: request.requestId,
      isRoutable: false,
      estimatedCostUnits: 0n,
      baseCostUnits: 0n,
      tokenCostUnits: 0n,
      estimatedLatencyMs: 0,
      fallbackTriggered: false,
      rejectionReason: 'Maximum budget must be strictly positive',
    };
  }

  if (request.promptTokens <= 0 || request.maxCompletionTokens < 0) {
    return {
      requestId: request.requestId,
      isRoutable: false,
      estimatedCostUnits: 0n,
      baseCostUnits: 0n,
      tokenCostUnits: 0n,
      estimatedLatencyMs: 0,
      fallbackTriggered: false,
      rejectionReason: 'Prompt tokens must be > 0 and completion tokens >= 0',
    };
  }

  const candidateTiers: ComputeTier[] = ['deep-inference', 'reasoning', 'balanced', 'nano'];

  // Filter candidates that support reasoning if requested
  const reasoningFiltered = request.requireReasoning
    ? candidateTiers.filter((t) => tierSpecs[t].supportsReasoning)
    : candidateTiers;

  if (reasoningFiltered.length === 0) {
    return {
      requestId: request.requestId,
      isRoutable: false,
      estimatedCostUnits: 0n,
      baseCostUnits: 0n,
      tokenCostUnits: 0n,
      estimatedLatencyMs: 0,
      fallbackTriggered: false,
      rejectionReason: 'No compute tiers support required reasoning capabilities',
    };
  }

  // Determine starting preferred tier
  let targetTierOrder: ComputeTier[];
  if (request.preferredTier && tierSpecs[request.preferredTier]) {
    const prefIndex = reasoningFiltered.indexOf(request.preferredTier);
    if (prefIndex >= 0) {
      targetTierOrder = [
        request.preferredTier,
        ...reasoningFiltered.filter((t) => t !== request.preferredTier),
      ];
    } else {
      targetTierOrder = reasoningFiltered;
    }
  } else {
    targetTierOrder = reasoningFiltered;
  }

  let fallbackTriggered = false;

  for (const tierName of targetTierOrder) {
    const spec = tierSpecs[tierName];
    if (!spec) continue;

    // Check context window
    if (request.promptTokens > spec.maxContextTokens) {
      continue;
    }
    if (request.maxCompletionTokens > spec.maxOutputTokens) {
      continue;
    }

    // Check latency constraint if specified
    if (request.maxAllowedLatencyMs && spec.p95LatencyMs > request.maxAllowedLatencyMs) {
      continue;
    }

    // Check pricing
    const cost = estimateTierCost(spec, request.promptTokens, request.maxCompletionTokens);
    if (cost.totalCostUnits <= request.maxBudgetUnits) {
      if (request.preferredTier && tierName !== request.preferredTier) {
        fallbackTriggered = true;
      }
      const ticketHash = computeExecutionTicketHash(
        request.requestId,
        request.payer,
        spec.tier,
        spec.modelIdentifier,
        cost.totalCostUnits
      );

      return {
        requestId: request.requestId,
        isRoutable: true,
        selectedTier: spec.tier,
        modelIdentifier: spec.modelIdentifier,
        estimatedCostUnits: cost.totalCostUnits,
        baseCostUnits: cost.baseCostUnits,
        tokenCostUnits: cost.tokenCostUnits,
        estimatedLatencyMs: spec.p95LatencyMs,
        fallbackTriggered,
        executionTicketHash: ticketHash,
      };
    }
  }

  return {
    requestId: request.requestId,
    isRoutable: false,
    estimatedCostUnits: 0n,
    baseCostUnits: 0n,
    tokenCostUnits: 0n,
    estimatedLatencyMs: 0,
    fallbackTriggered: false,
    rejectionReason: 'Insufficient budget or incompatible constraints across all compute tiers',
  };
}
