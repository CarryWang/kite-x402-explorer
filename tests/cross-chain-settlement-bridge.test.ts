import { describe, expect, it } from 'vitest';
import {
  createBridgeIntent,
  calculateBridgeRouteQuote,
  attestBridgeFulfillment,
  KITE_TESTNET_CHAIN_ID,
} from '../src/lib/cross-chain-settlement-bridge';

describe('cross-chain-settlement-bridge', () => {
  const token = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' as const; // USDC
  const recipient = '0x1111111111111111111111111111111111111111' as const;
  const relayer = '0x2222222222222222222222222222222222222222' as const;
  const txHash = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd' as const;

  it('calculates bridge quotes with accurate fee deduction', () => {
    const quote = calculateBridgeRouteQuote({
      sourceChainId: 1, // Ethereum
      destinationChainId: KITE_TESTNET_CHAIN_ID,
      sourceAmountWei: 1_000_000_000n, // 1000 USDC
      feeBps: 15, // 0.15% = 1_500_000n
    });

    expect(quote.bridgeFeeWei).toBe(1_500_000n);
    expect(quote.estimatedOutputWei).toBe(998_500_000n);
    expect(quote.estimatedLatencySeconds).toBe(15);
  });

  it('creates a pending bridge intent with valid structure', () => {
    const intent = createBridgeIntent({
      sourceChainId: 42161, // Arbitrum
      sourceToken: token,
      sourceAmountWei: 500_000_000n,
      destinationRecipient: recipient,
      nonce: 12345n,
      timestamp: 1000,
    });

    expect(intent.intentId).toMatch(/^intent-[a-f0-9]{12}$/);
    expect(intent.status).toBe('pending');
    expect(intent.sourceAmountWei).toBe(500_000_000n);
    expect(intent.minDestinationAmountWei).toBeLessThan(500_000_000n);
    expect(intent.expiryTimestamp).toBe(1000 + 1800 * 1000);
  });

  it('attests and settles valid bridge intents', () => {
    const intent = createBridgeIntent({
      sourceChainId: 8453, // Base
      sourceToken: token,
      sourceAmountWei: 100_000_000n,
      destinationRecipient: recipient,
      nonce: 42n,
      timestamp: 1000,
    });

    const settled = attestBridgeFulfillment(intent, {
      relayerAddress: relayer,
      destinationTxHash: txHash,
      timestamp: 2000,
    });

    expect(settled.status).toBe('settled');
    expect(settled.relayer).toBe(relayer);
    expect(settled.destinationTxHash).toBe(txHash);
  });

  it('marks intent as expired if attested past deadline', () => {
    const intent = createBridgeIntent({
      sourceChainId: 1,
      sourceToken: token,
      sourceAmountWei: 50_000_000n,
      destinationRecipient: recipient,
      ttlSeconds: 60,
      timestamp: 1000,
    });

    const expired = attestBridgeFulfillment(intent, {
      relayerAddress: relayer,
      destinationTxHash: txHash,
      timestamp: 1000 + 100 * 1000, // 100s later (past 60s ttl)
    });

    expect(expired.status).toBe('expired');
  });
});
