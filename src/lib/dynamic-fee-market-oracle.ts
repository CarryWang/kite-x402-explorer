
export type PriorityTier = 'economy' | 'standard' | 'expedited' | 'flash';

export interface MarketConfig {
  /** Target capacity utilization ratio (e.g. 0.8 for 80%) */
  targetUtilizationRatio: number;
  /** Maximum fee adjustment basis points per update step (e.g. 1250 = 12.5%) */
  maxAdjustmentBps: number;
  /** Absolute minimum base fee units permitted in the market (e.g. 1000n = $0.001) */
  minBaseFeeUnits: bigint;
  /** Absolute maximum base fee units cap to protect callers from unbounded surge */
  maxBaseFeeUnits: bigint;
  /** Time-to-live for issued price quotes in seconds */
  quoteTtlSeconds: number;
}

export const DEFAULT_MARKET_CONFIG: MarketConfig = {
  targetUtilizationRatio: 0.8,
  maxAdjustmentBps: 1250, // 12.5% max adjustment per block/step (similar to EIP-1559)
  minBaseFeeUnits: 1000n, // $0.001 at 6-decimal USDC
  maxBaseFeeUnits: 100000n, // $0.100 maximum ceiling
  quoteTtlSeconds: 60,
};

export interface ProviderMarketState {
  providerAddress: `0x${string}`;
  currentBaseFeeUnits: bigint;
  activeRequests: number;
  capacityLimit: number;
  utilizationRatio: number;
  emaUtilization: number;
  totalQuotesIssued: number;
  lastUpdatedTimestamp: number;
}

export interface FeeQuoteRequest {
  providerAddress: `0x${string}`;
  clientAddress: `0x${string}`;
  priorityTier: PriorityTier;
  estimatedTokens?: number;
}

export interface FeeQuote {
  quoteId: string;
  providerAddress: `0x${string}`;
  clientAddress: `0x${string}`;
  priorityTier: PriorityTier;
  baseFeeUnits: bigint;
  priorityTipUnits: bigint;
  totalFeeUnits: bigint;
  issuedAtTimestamp: number;
  expiresAtTimestamp: number;
  quoteDigest: `0x${string}`;
}

export const PRIORITY_TIP_BPS: Record<PriorityTier, number> = {
  economy: 0,
  standard: 50, // 0.5%
  expedited: 200, // 2.0%
  flash: 500, // 5.0%
};

export interface DynamicFeeMarketOracle {
  readonly config: MarketConfig;
  registerProvider(
    providerAddress: `0x${string}`,
    capacityLimit: number,
    initialBaseFeeUnits?: bigint,
    currentTimestamp?: number
  ): ProviderMarketState;
  updateUtilization(
    providerAddress: `0x${string}`,
    activeRequests: number,
    currentTimestamp?: number
  ): ProviderMarketState;
  calculatePriorityTip(baseFeeUnits: bigint, tier: PriorityTier): bigint;
  generateQuote(
    request: FeeQuoteRequest,
    currentTimestamp?: number
  ): FeeQuote;
  getMarketState(providerAddress: `0x${string}`): ProviderMarketState | undefined;
  getAllMarkets(): ProviderMarketState[];
}

export function createMarketOracle(
  customConfig?: Partial<MarketConfig>
): DynamicFeeMarketOracle {
  const config: MarketConfig = {
    ...DEFAULT_MARKET_CONFIG,
    ...customConfig,
  };

  const providers = new Map<string, ProviderMarketState>();
  let quoteCounter = 0;

  function normalizeAddress(addr: string): `0x${string}` {
    const trimmed = addr.trim().toLowerCase();
    if (!/^0x[0-9a-f]{40}$/.test(trimmed)) {
      throw new Error(`Invalid EVM address format: ${addr}`);
    }
    return trimmed as `0x${string}`;
  }

  function registerProvider(
    providerAddress: `0x${string}`,
    capacityLimit: number,
    initialBaseFeeUnits?: bigint,
    currentTimestamp?: number
  ): ProviderMarketState {
    const normalized = normalizeAddress(providerAddress);
    if (!Number.isSafeInteger(capacityLimit) || capacityLimit <= 0) {
      throw new Error(`capacityLimit must be a positive integer, got ${capacityLimit}`);
    }

    const baseFee = initialBaseFeeUnits ?? config.minBaseFeeUnits;
    if (baseFee < config.minBaseFeeUnits || baseFee > config.maxBaseFeeUnits) {
      throw new Error(`initialBaseFeeUnits out of bounds [${config.minBaseFeeUnits}, ${config.maxBaseFeeUnits}]`);
    }

    const now = currentTimestamp ?? Math.floor(Date.now() / 1000);
    const state: ProviderMarketState = {
      providerAddress: normalized,
      currentBaseFeeUnits: baseFee,
      activeRequests: 0,
      capacityLimit,
      utilizationRatio: 0,
      emaUtilization: 0,
      totalQuotesIssued: 0,
      lastUpdatedTimestamp: now,
    };

    providers.set(normalized, state);
    return { ...state };
  }

  function updateUtilization(
    providerAddress: `0x${string}`,
    activeRequests: number,
    currentTimestamp?: number
  ): ProviderMarketState {
    const normalized = normalizeAddress(providerAddress);
    const state = providers.get(normalized);
    if (!state) {
      throw new Error(`Provider not registered: ${providerAddress}`);
    }
    if (!Number.isSafeInteger(activeRequests) || activeRequests < 0) {
      throw new Error(`activeRequests must be non-negative integer, got ${activeRequests}`);
    }

    const now = currentTimestamp ?? Math.floor(Date.now() / 1000);
    const rawRatio = activeRequests / state.capacityLimit;
    const utilizationRatio = Math.min(rawRatio, 2.0);

    const alpha = 0.3;
    const emaUtilization = alpha * utilizationRatio + (1 - alpha) * state.emaUtilization;

    let newBaseFee = state.currentBaseFeeUnits;
    const diff = utilizationRatio - config.targetUtilizationRatio;
    if (diff !== 0) {
      const deltaBps = Math.min(
        Math.round((Math.abs(diff) / config.targetUtilizationRatio) * config.maxAdjustmentBps),
        config.maxAdjustmentBps
      );
      const adjustment = (state.currentBaseFeeUnits * BigInt(deltaBps)) / 10000n;
      const effectiveAdjustment = adjustment > 0n ? adjustment : 1n;

      if (diff > 0) {
        newBaseFee = state.currentBaseFeeUnits + effectiveAdjustment;
        if (newBaseFee > config.maxBaseFeeUnits) {
          newBaseFee = config.maxBaseFeeUnits;
        }
      } else {
        if (state.currentBaseFeeUnits > effectiveAdjustment + config.minBaseFeeUnits) {
          newBaseFee = state.currentBaseFeeUnits - effectiveAdjustment;
        } else {
          newBaseFee = config.minBaseFeeUnits;
        }
      }
    }

    state.activeRequests = activeRequests;
    state.utilizationRatio = utilizationRatio;
    state.emaUtilization = emaUtilization;
    state.currentBaseFeeUnits = newBaseFee;
    state.lastUpdatedTimestamp = now;

    return { ...state };
  }

  function calculatePriorityTip(baseFeeUnits: bigint, tier: PriorityTier): bigint {
    const tipBps = PRIORITY_TIP_BPS[tier] ?? 0;
    if (tipBps === 0) return 0n;
    return (baseFeeUnits * BigInt(tipBps)) / 10000n;
  }

  function generateQuote(
    request: FeeQuoteRequest,
    currentTimestamp?: number
  ): FeeQuote {
    const normalizedProvider = normalizeAddress(request.providerAddress);
    const normalizedClient = normalizeAddress(request.clientAddress);

    const state = providers.get(normalizedProvider);
    if (!state) {
      throw new Error(`Provider not registered: ${request.providerAddress}`);
    }

    const now = currentTimestamp ?? Math.floor(Date.now() / 1000);
    const expiresAt = now + config.quoteTtlSeconds;

    quoteCounter += 1;
    state.totalQuotesIssued += 1;

    const baseFeeUnits = state.currentBaseFeeUnits;
    const priorityTipUnits = calculatePriorityTip(baseFeeUnits, request.priorityTier);
    const totalFeeUnits = baseFeeUnits + priorityTipUnits;

    const quoteId = `quote_${now}_${quoteCounter}`;

    return {
      quoteId,
      providerAddress: normalizedProvider,
      clientAddress: normalizedClient,
      priorityTier: request.priorityTier,
      baseFeeUnits,
      priorityTipUnits,
      totalFeeUnits,
      issuedAtTimestamp: now,
      expiresAtTimestamp: expiresAt,
      quoteDigest: '0x0000000000000000000000000000000000000000000000000000000000000000',
    };
  }

  function getMarketState(providerAddress: `0x${string}`): ProviderMarketState | undefined {
    const normalized = normalizeAddress(providerAddress);
    const state = providers.get(normalized);
    return state ? { ...state } : undefined;
  }

  function getAllMarkets(): ProviderMarketState[] {
    return Array.from(providers.values()).map((s) => ({ ...s }));
  }

  return {
    config,
    registerProvider,
    updateUtilization,
    calculatePriorityTip,
    generateQuote,
    getMarketState,
    getAllMarkets,
  };
}
