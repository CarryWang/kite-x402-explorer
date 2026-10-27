import { describe, it, expect } from './vitest-compat.js';
import { CrossChainReceiptProver, type PaymentReceipt, type TrustedReceiptReader, type ReceiptReplayStore } from '../src/lib/cross-chain-receipt-prover';

describe('CrossChainReceiptProver', () => {
  const supportedChains = [1, 137, 2368];

  const validReceipt: PaymentReceipt = {
    chainId: 2368,
    txHash: '0x' + 'a'.repeat(64),
    blockNumber: 123456,
    payer: '0x1111111111111111111111111111111111111111',
    recipient: '0x2222222222222222222222222222222222222222',
    amount: 1000000n,
    tokenAddress: '0x3333333333333333333333333333333333333333',
    timestamp: 1000,
  };

  function replayStore(): ReceiptReplayStore {
    const claimed = new Set<string>();
    return { claim: async (id) => {
      if (claimed.has(id)) return false;
      claimed.add(id);
      return true;
    } };
  }

  function reader(record: PaymentReceipt | null): TrustedReceiptReader {
    return { readConfirmedReceipt: async () => record };
  }

  it('rejects a fabricated receipt absent from trusted chain data', async () => {
    const prover = new CrossChainReceiptProver(reader(null), replayStore());
    const res = await prover.verifyReceipt(validReceipt, supportedChains, 3600, 1100);
    expect(res.isValid).toBe(false);
  });

  it('validates only a matching confirmed chain receipt', async () => {
    const prover = new CrossChainReceiptProver(reader(validReceipt), replayStore());
    const res = await prover.verifyReceipt(validReceipt, supportedChains, 3600, 1100);
    expect(res.isValid).toBe(true);
    expect(res.settlementAgeSeconds).toBe(100);
  });

  it('rejects a forged amount despite a real transaction hash', async () => {
    const prover = new CrossChainReceiptProver(reader(validReceipt), replayStore());
    const res = await prover.verifyReceipt({ ...validReceipt, amount: 2000000n }, supportedChains, 3600, 1100);
    expect(res.isValid).toBe(false);
  });

  it('rejects replay across prover instances sharing durable state', async () => {
    const store = replayStore();
    const first = new CrossChainReceiptProver(reader(validReceipt), store);
    const second = new CrossChainReceiptProver(reader(validReceipt), store);
    expect((await first.verifyReceipt(validReceipt, supportedChains, 3600, 1100)).isValid).toBe(true);
    expect((await second.verifyReceipt(validReceipt, supportedChains, 3600, 1100)).isValid).toBe(false);
  });

  it('rejects unsupported chain IDs', async () => {
    const prover = new CrossChainReceiptProver(reader(null), replayStore());
    const res = await prover.verifyReceipt({ ...validReceipt, chainId: 999999 }, supportedChains);
    expect(res.isValid).toBe(false);
  });
});
