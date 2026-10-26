import { describe, it, expect } from 'vitest';
import { AgentInvoiceGenerator } from '../src/lib/agent-invoice-generator';

describe('AgentInvoiceGenerator', () => {
  it('creates an issued micro-invoice with valid totals and checksum', () => {
    const generator = new AgentInvoiceGenerator();
    const invoice = generator.createInvoice({
      issuerAgent: '0xAgentProvider',
      payerAgent: '0xAgentClient',
      recipientAddress: '0xTreasuryWallet',
      network: 'kite-mainnet',
      items: [
        { id: 'item-1', description: 'LLM Inference 1000 tokens', quantity: 2, unitPriceAtomic: 500_000n },
        { id: 'item-2', description: 'Web Search Tool Query', quantity: 1, unitPriceAtomic: 200_000n },
      ],
      discountAtomic: 100_000n,
      ttlSeconds: 300,
    });

    expect(invoice.invoiceId).toMatch(/^inv_\d+_[a-z0-9]+$/);
    expect(invoice.status).toBe('ISSUED');
    expect(invoice.subtotalAtomic).toBe(1_200_000n);
    expect(invoice.discountAtomic).toBe(100_000n);
    expect(invoice.totalAmountAtomic).toBe(1_100_000n);
    expect(invoice.invoiceChecksum).toMatch(/^0x[0-9a-f]{8}$/);
  });

  it('settles an issued invoice successfully', () => {
    const generator = new AgentInvoiceGenerator();
    const invoice = generator.createInvoice({
      issuerAgent: '0xAgentProvider',
      payerAgent: '0xAgentClient',
      recipientAddress: '0xTreasuryWallet',
      network: 'kite-testnet',
      items: [{ id: 'item-1', description: 'Embedding vector lookup', quantity: 1, unitPriceAtomic: 10_000n }],
    });

    const settled = generator.markSettled(invoice.invoiceId, '0x9999abcdef');
    expect(settled.status).toBe('SETTLED');
    expect(settled.settlementTxHash).toBe('0x9999abcdef');
    expect(settled.settledAt).toBeDefined();
  });

  it('rejects settlement when invoice is expired', () => {
    const generator = new AgentInvoiceGenerator();
    const invoice = generator.createInvoice({
      issuerAgent: '0xAgentProvider',
      payerAgent: '0xAgentClient',
      recipientAddress: '0xTreasuryWallet',
      network: 'kite-testnet',
      items: [{ id: 'item-1', description: 'Fast task', quantity: 1, unitPriceAtomic: 10_000n }],
      ttlSeconds: -10, // already expired
    });

    expect(() => {
      generator.markSettled(invoice.invoiceId, '0xtx');
    }).toThrow(/expired/);
  });
});
