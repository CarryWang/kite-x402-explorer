/**
 * Autonomous AI Agent Gas Station & Network Price Oracle for Kite AI chain.
 * Computes gas fee recommendations, priority fee tiers, and transaction cost
 * estimates across Kite Mainnet and Testnet settlement networks.
 */

export type GasSpeedTier = 'SLOW' | 'STANDARD' | 'FAST' | 'INSTANT';

export interface GasPriceRecommendation {
  network: string;
  speed: GasSpeedTier;
  baseFeeGwei: number;
  priorityFeeGwei: number;
  maxFeePerGasGwei: number;
  estimatedWaitSeconds: number;
}

export interface SettlementCostEstimate {
  network: string;
  gasLimit: bigint;
  estimatedCostEth: string;
  estimatedCostUsd: string;
  speed: GasSpeedTier;
  timestamp: number;
}

export class AgentGasStationOracle {
  private networkBaseFeesGwei: Map<string, number> = new Map([
    ['kite-mainnet', 15],
    ['kite-testnet', 5],
  ]);

  /**
   * Returns gas recommendations for all speed tiers on a network.
   */
  public getRecommendations(network: string = 'kite-mainnet'): GasPriceRecommendation[] {
    const baseFee = this.networkBaseFeesGwei.get(network) ?? 15;

    return [
      {
        network,
        speed: 'SLOW',
        baseFeeGwei: baseFee,
        priorityFeeGwei: 1,
        maxFeePerGasGwei: baseFee + 1,
        estimatedWaitSeconds: 30,
      },
      {
        network,
        speed: 'STANDARD',
        baseFeeGwei: baseFee,
        priorityFeeGwei: 2,
        maxFeePerGasGwei: Math.ceil(baseFee * 1.15) + 2,
        estimatedWaitSeconds: 10,
      },
      {
        network,
        speed: 'FAST',
        baseFeeGwei: baseFee,
        priorityFeeGwei: 5,
        maxFeePerGasGwei: Math.ceil(baseFee * 1.3) + 5,
        estimatedWaitSeconds: 3,
      },
      {
        network,
        speed: 'INSTANT',
        baseFeeGwei: baseFee,
        priorityFeeGwei: 10,
        maxFeePerGasGwei: Math.ceil(baseFee * 1.5) + 10,
        estimatedWaitSeconds: 1,
      },
    ];
  }

  /**
   * Estimates transaction cost in native currency and USD equivalent.
   */
  public estimateSettlementCost(
    network: string,
    gasLimit: bigint = 65_000n, // standard EIP-3009 transferWithAuthorization gas
    speed: GasSpeedTier = 'STANDARD',
    nativeTokenPriceUsd: number = 2.5 // e.g. Kite / native token USD price
  ): SettlementCostEstimate {
    const recs = this.getRecommendations(network);
    const tier = recs.find((r) => r.speed === speed) ?? recs[1];

    const maxFeeGwei = BigInt(tier.maxFeePerGasGwei);
    const totalGasWei = gasLimit * maxFeeGwei * 1_000_000_000n;

    // Convert wei to ETH/native unit decimal string
    const etherValue = Number(totalGasWei) / 1e18;
    const costUsd = etherValue * nativeTokenPriceUsd;

    return {
      network,
      gasLimit,
      estimatedCostEth: etherValue.toFixed(8),
      estimatedCostUsd: `$${costUsd.toFixed(6)}`,
      speed,
      timestamp: Date.now(),
    };
  }

  /**
   * Updates base fee for a network based on recent block feedback.
   */
  public updateBaseFee(network: string, newBaseFeeGwei: number): void {
    if (newBaseFeeGwei < 1) {
      throw new Error('Base fee cannot be lower than 1 Gwei');
    }
    this.networkBaseFeesGwei.set(network, newBaseFeeGwei);
  }
}
