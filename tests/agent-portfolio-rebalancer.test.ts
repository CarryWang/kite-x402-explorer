import { describe, it, expect } from 'vitest';
import { AgentPortfolioRebalancer, TokenAllocation, PortfolioAssetBalance } from '../src/lib/agent-portfolio-rebalancer';

describe('AgentPortfolioRebalancer', () => {
  const targetAllocations: TokenAllocation[] = [
    {
      tokenSymbol: 'USDC',
      tokenAddress: '0x1111111111111111111111111111111111111111',
      targetWeightBps: 5000, // 50%
      minReserveAmount: 100_000_000n,
      maxSlippageBps: 50,
    },
    {
      tokenSymbol: 'KITE',
      tokenAddress: '0x2222222222222222222222222222222222222222',
      targetWeightBps: 3000, // 30%
      minReserveAmount: 50_000_000_000_000_000_000n,
      maxSlippageBps: 100,
    },
    {
      tokenSymbol: 'WETH',
      tokenAddress: '0x3333333333333333333333333333333333333333',
      targetWeightBps: 2000, // 20%
      minReserveAmount: 1_000_000_000_000_000_000n,
      maxSlippageBps: 50,
    },
  ];

  it('rejects allocations that do not total 10000 bps', () => {
    expect(() => {
      new AgentPortfolioRebalancer([
        {
          tokenSymbol: 'USDC',
          tokenAddress: '0x1',
          targetWeightBps: 4000,
          minReserveAmount: 0n,
          maxSlippageBps: 50,
        },
      ]);
    }).toThrow(/must sum exactly to 10000 bps/);
  });

  it('identifies balanced portfolio and generates HOLD instructions', () => {
    const rebalancer = new AgentPortfolioRebalancer(targetAllocations, 300);

    const balances: PortfolioAssetBalance[] = [
      {
        tokenSymbol: 'USDC',
        tokenAddress: '0x1111111111111111111111111111111111111111',
        balance: 5000_000_000n, // $5,000
        priceUsdAtomic: 1_000_000n, // $1.00
        decimals: 6,
      },
      {
        tokenSymbol: 'KITE',
        tokenAddress: '0x2222222222222222222222222222222222222222',
        balance: 3000_000_000_000_000_000_000n, // 3,000 tokens
        priceUsdAtomic: 1_000_000n, // $1.00
        decimals: 18,
      },
      {
        tokenSymbol: 'WETH',
        tokenAddress: '0x3333333333333333333333333333333333333333',
        balance: 1_000_000_000_000_000_000n, // 1 WETH
        priceUsdAtomic: 2000_000_000n, // $2000
        decimals: 18,
      },
    ];

    const result = rebalancer.evaluate('0xAgent001', balances);
    expect(result.needsRebalancing).toBe(false);
    expect(result.totalPortfolioValueUsd).toBe(10_000_000_000n); // $10,000 total
    for (const inst of result.instructions) {
      expect(inst.action).toBe('HOLD');
    }
  });

  it('triggers BUY and SELL instructions when portfolio weights drift beyond threshold', () => {
    const rebalancer = new AgentPortfolioRebalancer(targetAllocations, 200);

    // Overweight USDC (80%), Underweight KITE (10%) and WETH (10%)
    const balances: PortfolioAssetBalance[] = [
      {
        tokenSymbol: 'USDC',
        tokenAddress: '0x1111111111111111111111111111111111111111',
        balance: 8000_000_000n, // $8,000 (80%)
        priceUsdAtomic: 1_000_000n,
        decimals: 6,
      },
      {
        tokenSymbol: 'KITE',
        tokenAddress: '0x2222222222222222222222222222222222222222',
        balance: 1000_000_000_000_000_000_000n, // $1,000 (10%)
        priceUsdAtomic: 1_000_000n,
        decimals: 18,
      },
      {
        tokenSymbol: 'WETH',
        tokenAddress: '0x3333333333333333333333333333333333333333',
        balance: 500_000_000_000_000_000n, // 0.5 WETH = $1,000 (10%)
        priceUsdAtomic: 2000_000_000n,
        decimals: 18,
      },
    ];

    const result = rebalancer.evaluate('0xAgent001', balances);
    expect(result.needsRebalancing).toBe(true);

    const usdcInst = result.instructions.find((i) => i.tokenSymbol === 'USDC');
    expect(usdcInst?.action).toBe('SELL');

    const kiteInst = result.instructions.find((i) => i.tokenSymbol === 'KITE');
    expect(kiteInst?.action).toBe('BUY');

    const wethInst = result.instructions.find((i) => i.tokenSymbol === 'WETH');
    expect(wethInst?.action).toBe('BUY');
  });
});
