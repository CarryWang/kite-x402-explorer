/**
 * Autonomous AI Agent Treasury & Portfolio Rebalancer for x402 revenue streams.
 * Enables AI agents to dynamically maintain target liquidity, reserve ratios,
 * and gas reserves across Kite L1 and connected settlement environments.
 */

export interface TokenAllocation {
  tokenSymbol: string;
  tokenAddress: string;
  targetWeightBps: number; // Basis points (e.g., 5000 = 50%)
  minReserveAmount: bigint;
  maxSlippageBps: number;
}

export interface PortfolioAssetBalance {
  tokenSymbol: string;
  tokenAddress: string;
  balance: bigint;
  priceUsdAtomic: bigint; // Scaled by 1e6 (USD micro-units)
  decimals: number;
}

export interface RebalanceInstruction {
  action: 'BUY' | 'SELL' | 'HOLD';
  tokenSymbol: string;
  tokenAddress: string;
  amountAtomic: bigint;
  approxUsdValue: bigint;
  reason: string;
}

export interface RebalanceEvaluationResult {
  agentAddress: string;
  totalPortfolioValueUsd: bigint;
  needsRebalancing: boolean;
  rebalanceThresholdBps: number;
  instructions: RebalanceInstruction[];
  timestamp: number;
}

export class AgentPortfolioRebalancer {
  private allocations: Map<string, TokenAllocation> = new Map();
  private rebalanceThresholdBps: number;

  constructor(targetAllocations: TokenAllocation[], rebalanceThresholdBps: number = 200) {
    let totalWeight = 0;
    for (const alloc of targetAllocations) {
      if (alloc.targetWeightBps < 0) {
        throw new Error(`Target weight cannot be negative for ${alloc.tokenSymbol}`);
      }
      totalWeight += alloc.targetWeightBps;
      this.allocations.set(alloc.tokenSymbol.toUpperCase(), alloc);
    }

    if (totalWeight !== 10000) {
      throw new Error(`Total target allocations must sum exactly to 10000 bps (100%), got ${totalWeight}`);
    }

    this.rebalanceThresholdBps = rebalanceThresholdBps;
  }

  /**
   * Evaluates current portfolio balances against target allocation policy.
   */
  public evaluate(
    agentAddress: string,
    balances: PortfolioAssetBalance[]
  ): RebalanceEvaluationResult {
    let totalPortfolioValueUsd = 0n;

    const parsedAssets = balances.map((asset) => {
      const divisor = 10n ** BigInt(asset.decimals);
      // Normalized USD value (in 1e6 precision)
      const usdValue = (asset.balance * asset.priceUsdAtomic) / divisor;
      totalPortfolioValueUsd += usdValue;
      return {
        ...asset,
        symbolUpper: asset.tokenSymbol.toUpperCase(),
        usdValue,
      };
    });

    if (totalPortfolioValueUsd === 0n) {
      return {
        agentAddress,
        totalPortfolioValueUsd: 0n,
        needsRebalancing: false,
        rebalanceThresholdBps: this.rebalanceThresholdBps,
        instructions: [],
        timestamp: Date.now(),
      };
    }

    const instructions: RebalanceInstruction[] = [];
    let shouldRebalance = false;

    for (const asset of parsedAssets) {
      const allocation = this.allocations.get(asset.symbolUpper);
      if (!allocation) {
        // Unmanaged asset: generate liquidation or hold
        continue;
      }

      const currentWeightBps = Number((asset.usdValue * 10000n) / totalPortfolioValueUsd);
      const targetWeightBps = allocation.targetWeightBps;
      const weightDeltaBps = Math.abs(currentWeightBps - targetWeightBps);

      const targetUsdValue = (totalPortfolioValueUsd * BigInt(targetWeightBps)) / 10000n;
      const deltaUsdValue = asset.usdValue > targetUsdValue 
        ? asset.usdValue - targetUsdValue 
        : targetUsdValue - asset.usdValue;

      const divisor = 10n ** BigInt(asset.decimals);
      const deltaTokens = asset.priceUsdAtomic > 0n 
        ? (deltaUsdValue * divisor) / asset.priceUsdAtomic 
        : 0n;

      if (weightDeltaBps >= this.rebalanceThresholdBps) {
        shouldRebalance = true;
        if (currentWeightBps > targetWeightBps) {
          instructions.push({
            action: 'SELL',
            tokenSymbol: asset.tokenSymbol,
            tokenAddress: asset.tokenAddress,
            amountAtomic: deltaTokens,
            approxUsdValue: deltaUsdValue,
            reason: `Weight ${currentWeightBps} bps exceeds target ${targetWeightBps} bps by ${weightDeltaBps} bps`,
          });
        } else {
          instructions.push({
            action: 'BUY',
            tokenSymbol: asset.tokenSymbol,
            tokenAddress: asset.tokenAddress,
            amountAtomic: deltaTokens,
            approxUsdValue: deltaUsdValue,
            reason: `Weight ${currentWeightBps} bps below target ${targetWeightBps} bps by ${weightDeltaBps} bps`,
          });
        }
      } else {
        instructions.push({
          action: 'HOLD',
          tokenSymbol: asset.tokenSymbol,
          tokenAddress: asset.tokenAddress,
          amountAtomic: 0n,
          approxUsdValue: 0n,
          reason: `Weight within deviation threshold (${weightDeltaBps} bps < ${this.rebalanceThresholdBps} bps)`,
        });
      }
    }

    return {
      agentAddress,
      totalPortfolioValueUsd,
      needsRebalancing: shouldRebalance,
      rebalanceThresholdBps: this.rebalanceThresholdBps,
      instructions,
      timestamp: Date.now(),
    };
  }

  public getTargetAllocation(tokenSymbol: string): TokenAllocation | undefined {
    return this.allocations.get(tokenSymbol.toUpperCase());
  }
}
