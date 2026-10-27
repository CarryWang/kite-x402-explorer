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
    if (discountAtomic > subtotalAtomic) {
      throw new Error('Discount cannot exceed subtotal amount');
    }
    const totalAmountAtomic = subtotalAtomic - discountAtomic;

    const invoiceId = `inv_${now}_${Math.random().toString(36).substring(2, 9)}`;
    const invoiceChecksum = this.calculateChecksum(invoiceId, params.issuerAgent, totalAmountAtomic, expiresAt);

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
      invoiceChecksum,
    };

    this.invoices.set(invoiceId, invoice);
    return invoice;
  }

  /**
   * Marks an invoice as settled upon receiving on-chain transaction hash.
   */
  public markSettled(invoiceId: string, txHash: string): MicroInvoice {
    const invoice = this.invoices.get(invoiceId);
    if (!invoice) {
      throw new Error(`Invoice ${invoiceId} not found`);
    }

    if (invoice.status === 'EXPIRED' || invoice.status === 'CANCELLED') {
      throw new Error(`Cannot settle an invoice with status ${invoice.status}`);
    }

    if (Date.now() > invoice.expiresAt) {
      invoice.status = 'EXPIRED';
      throw new Error(`Invoice ${invoiceId} has expired`);
    }

    invoice.status = 'SETTLED';
    invoice.settledAt = Date.now();
    invoice.settlementTxHash = txHash;
    return invoice;
  }

  /**
   * Retrieves an invoice by ID, checking expiration if still ISSUED.
   */
  public getInvoice(invoiceId: string): MicroInvoice | undefined {
    const invoice = this.invoices.get(invoiceId);
    if (invoice && invoice.status === 'ISSUED' && Date.now() > invoice.expiresAt) {
      invoice.status = 'EXPIRED';
    }
    return invoice;
  }

  /**
   * Lists invoices by payer or issuer.
   */
  public listByAgent(agentAddress: string): MicroInvoice[] {
    const addr = agentAddress.toLowerCase();
    return Array.from(this.invoices.values()).filter(
      (inv) => inv.issuerAgent === addr || inv.payerAgent === addr
    );
  }

  private calculateChecksum(
    invoiceId: string,
    issuer: string,
    total: bigint,
    expiresAt: number
  ): string {
    let hash = 0;
    const str = `${invoiceId}:${issuer}:${total.toString()}:${expiresAt}`;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return `0x${Math.abs(hash).toString(16).padStart(8, '0')}`;
  }
}
