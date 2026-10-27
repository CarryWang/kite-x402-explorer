import { describe, it, expect } from 'vitest';
import { CrossChainReceiptProver, type PaymentReceipt } from '../src/lib/cross-chain-receipt-prover';

describe('CrossChainReceiptProver', () => {
  const prover = new CrossChainReceiptProver();
  const supportedChains = [1, 137, 2368];

  const validReceipt: PaymentReceipt = {
    chainId: 2368,
    txHash: '0x' + 'a'.repeat(64),
    blockNumber: 123456,
    payer: '0xPayer',
    recipient: '0xMerchant',
    amount: 1000000n,
    tokenAddress: '0xToken',
    timestamp: 1000,
  };

  it('validates a conformant receipt on a supported chain', () => {
    const res = prover.verifyReceipt(validReceipt, supportedChains, 3600, 1100);
    expect(res.isValid).toBe(true);
    expect(res.settlementAgeSeconds).toBe(100);
  });

  it('rejects duplicate receipt replay', () => {
    const res = prover.verifyReceipt(validReceipt, supportedChains, 3600, 1100);
    expect(res.isValid).toBe(false);
    expect(res.reason).toContain('Duplicate receipt');
  });

  it('rejects unsupported chain IDs', () => {
    const res = prover.verifyReceipt({ ...validReceipt, chainId: 999999 }, supportedChains);
    expect(res.isValid).toBe(false);
    expect(res.reason).toContain('Unsupported chain ID');
  });
});
