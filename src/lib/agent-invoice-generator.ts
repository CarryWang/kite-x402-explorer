import { keccak256, stringToHex } from 'viem';

/**
 * Autonomous AI Agent Micro-Invoice & Cryptographic Payment Request Generator.
 * Enables AI agents to create standardized, verifiable, tamper-evident invoices
 * for machine-to-machine x402 services.
 */

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPriceAtomic: bigint;
  totalAtomic: bigint;
}

export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'SETTLED' | 'EXPIRED' | 'CANCELLED';

export interface MicroInvoice {
  invoiceId: string;
  issuerAgent: string;
  payerAgent: string;
  recipientAddress: string;
  network: string;
  currencySymbol: string;
  lineItems: InvoiceLineItem[];
  subtotalAtomic: bigint;
  discountAtomic: bigint;
  totalAmountAtomic: bigint;
  status: InvoiceStatus;
  createdAt: number;
  expiresAt: number;
  settledAt?: number;
  settlementTxHash?: string;
  invoiceChecksum: string;
}

export interface CreateInvoiceParams {
  issuerAgent: string;
  payerAgent: string;
  recipientAddress: string;
  network: string;
  currencySymbol?: string;
  items: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPriceAtomic: bigint;
  }>;
  discountAtomic?: bigint;
  ttlSeconds?: number;
}

export class AgentInvoiceGenerator {
  private invoices: Map<string, MicroInvoice> = new Map();
  private settledTxHashes: Set<string> = new Set();

  /**
   * Generates a new micro-invoice for autonomous agent payment.
   */
  public createInvoice(params: CreateInvoiceParams): MicroInvoice {
    if (!params.items || params.items.length === 0) {
      throw new Error('Invoice must contain at least one line item');
    }

    const now = Date.now();
    const ttlMs = (params.ttlSeconds ?? 3600) * 1000;
    const expiresAt = now + ttlMs;

    let subtotalAtomic = 0n;
    const lineItems: InvoiceLineItem[] = params.items.map((item) => {
      if (item.quantity <= 0) {
        throw new Error(`Quantity must be greater than zero for item ${item.id}`);
      }
      if (!Number.isSafeInteger(item.quantity) || item.unitPriceAtomic < 0n) {
        throw new Error(`Invalid quantity or unit price for item ${item.id}`);
      }
      const totalAtomic = item.unitPriceAtomic * BigInt(item.quantity);
      subtotalAtomic += totalAtomic;
      return {
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        unitPriceAtomic: item.unitPriceAtomic,
        totalAtomic,
      };
    });

    const discountAtomic = params.discountAtomic ?? 0n;
    if (discountAtomic < 0n || discountAtomic > subtotalAtomic) {
      throw new Error('Discount cannot exceed subtotal amount');
    }
    const totalAmountAtomic = subtotalAtomic - discountAtomic;

    const invoiceId = `inv_${now}_${Math.random().toString(36).substring(2, 9)}`;
    const invoice: MicroInvoice = {
      invoiceId,
      issuerAgent: params.issuerAgent.toLowerCase(),
      payerAgent: params.payerAgent.toLowerCase(),
      recipientAddress: params.recipientAddress.toLowerCase(),
      network: params.network,
      currencySymbol: params.currencySymbol ?? 'USDC',
      lineItems,
      subtotalAtomic,
      discountAtomic,
      totalAmountAtomic,
      status: 'ISSUED',
      createdAt: now,
      expiresAt,
      invoiceChecksum: '',
    };
    invoice.invoiceChecksum = this.calculateChecksum(invoice);

    this.invoices.set(invoiceId, invoice);
    return this.copyInvoice(invoice);
  }

  /**
   * Marks an invoice as settled upon receiving on-chain transaction hash.
   */
  public markSettled(
    invoiceId: string,
    txHash: string,
    verifyPayment?: (invoice: Readonly<MicroInvoice>, txHash: string) => boolean
  ): MicroInvoice {
    const invoice = this.invoices.get(invoiceId);
    if (!invoice) {
      throw new Error(`Invoice ${invoiceId} not found`);
    }

    if (invoice.status !== 'ISSUED') {
      throw new Error(`Cannot settle an invoice with status ${invoice.status}`);
    }

    if (Date.now() > invoice.expiresAt) {
      invoice.status = 'EXPIRED';
      throw new Error(`Invoice ${invoiceId} has expired`);
    }
    if (this.calculateChecksum(invoice) !== invoice.invoiceChecksum) {
      throw new Error('Invoice checksum mismatch');
    }
    const txKey = `${invoice.network.toLowerCase()}:${txHash.toLowerCase()}`;
    if (!txHash || this.settledTxHashes.has(txKey)) {
      throw new Error('Settlement transaction already used or missing');
    }
    if (!verifyPayment || !verifyPayment(this.copyInvoice(invoice), txHash)) {
      throw new Error('Settlement payment verification failed');
    }

    invoice.status = 'SETTLED';
    invoice.settledAt = Date.now();
    invoice.settlementTxHash = txHash;
    this.settledTxHashes.add(txKey);
    return this.copyInvoice(invoice);
  }

  /**
   * Retrieves an invoice by ID, checking expiration if still ISSUED.
   */
  public getInvoice(invoiceId: string): MicroInvoice | undefined {
    const invoice = this.invoices.get(invoiceId);
    if (invoice && invoice.status === 'ISSUED' && Date.now() > invoice.expiresAt) {
      invoice.status = 'EXPIRED';
    }
    return invoice && this.copyInvoice(invoice);
  }

  /**
   * Lists invoices by payer or issuer.
   */
  public listByAgent(agentAddress: string): MicroInvoice[] {
    const addr = agentAddress.toLowerCase();
    return Array.from(this.invoices.values()).filter(
      (inv) => inv.issuerAgent === addr || inv.payerAgent === addr
    ).map((inv) => this.copyInvoice(inv));
  }

  private copyInvoice(invoice: MicroInvoice): MicroInvoice {
    return { ...invoice, lineItems: invoice.lineItems.map((item) => ({ ...item })) };
  }

  private calculateChecksum(invoice: MicroInvoice): string {
    const payload = [
      invoice.invoiceId, invoice.issuerAgent, invoice.payerAgent,
      invoice.recipientAddress, invoice.network, invoice.currencySymbol,
      invoice.lineItems.map((item) => [item.id, item.description, item.quantity, item.unitPriceAtomic.toString()]),
      invoice.subtotalAtomic.toString(), invoice.discountAtomic.toString(),
      invoice.totalAmountAtomic.toString(), invoice.createdAt, invoice.expiresAt,
    ];
    return keccak256(stringToHex(JSON.stringify(payload)));
  }
}
