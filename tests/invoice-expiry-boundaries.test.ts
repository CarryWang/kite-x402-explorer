import test from 'node:test';
import assert from 'node:assert/strict';
import { AgentInvoiceGenerator } from '../src/lib/agent-invoice-generator.js';

const params = { issuerAgent: 'issuer', payerAgent: 'payer', recipientAddress: 'recipient', network: 'eip155:2368',
  items: [{ id: 'local', description: 'fixture task', quantity: 1, unitPriceAtomic: 10n }] };

test('non-finite and overflowing lifetimes cannot create permanently issued invoices', () => {
  for (const ttlSeconds of [NaN, Infinity, -Infinity, Number.MAX_VALUE]) {
    const generator = new AgentInvoiceGenerator();
    assert.throws(() => generator.createInvoice({ ...params, ttlSeconds }), /time|TTL|expiry|lifetime/i);
    assert.deepEqual(generator.listByAgent('payer'), []);
  }
});

test('all invoice read/settlement paths expire at the same exact deadline', () => {
  const originalNow = Date.now;
  let now = 1_000_000;
  Date.now = () => now;
  try {
    // 每个入口使用独立记录，防止列表先更新状态后掩盖其他入口的边界错误。
    for (const path of ['list', 'get', 'settle']) {
      const generator = new AgentInvoiceGenerator();
      const invoice = generator.createInvoice({ ...params, ttlSeconds: 1 });
      now = invoice.expiresAt;
      if (path === 'list') assert.equal(generator.listByAgent('payer')[0].status, 'EXPIRED');
      if (path === 'get') assert.equal(generator.getInvoice(invoice.invoiceId)?.status, 'EXPIRED');
      if (path === 'settle') {
        let verified = false;
        assert.throws(() => generator.markSettled(invoice.invoiceId, 'fixture-tx', () => { verified = true; return true; }), /EXPIRED|expired/);
        assert.equal(verified, false);
      }
    }
  } finally { Date.now = originalNow; }
});

test('finite past lifetimes and millisecond-resolution positive lifetimes retain compatibility', () => {
  const generator = new AgentInvoiceGenerator();
  const expired = generator.createInvoice({ ...params, ttlSeconds: -10 });
  assert.equal(generator.getInvoice(expired.invoiceId)?.status, 'EXPIRED');
  const fresh = generator.createInvoice({ ...params, ttlSeconds: 0.5 });
  assert.equal(fresh.expiresAt - fresh.createdAt, 500);
  assert.equal(generator.getInvoice(fresh.invoiceId)?.status, 'ISSUED');
});
