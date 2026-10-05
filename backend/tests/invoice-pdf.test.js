const { test } = require('node:test');
const assert = require('node:assert');
const { generateInvoicePdf, formatMoney } = require('../src/modules/billing/invoice-pdf');

test('formatMoney: uses the currency format string, with fallbacks', () => {
  assert.strictEqual(formatMoney(12.5, { format: '$%v' }), '$12.50');
  assert.strictEqual(formatMoney(12.5, { format: '%v USD' }), '12.50 USD');
  assert.strictEqual(formatMoney(12.5, { code: 'OMR' }), 'OMR 12.50');
  assert.strictEqual(formatMoney(null, { code: 'USD' }), 'USD 0.00');
  assert.strictEqual(formatMoney(0, {}), '0.00');
});

test('generateInvoicePdf: produces a valid PDF with itemised lines (BUG-13)', async () => {
  const pdf = await generateInvoicePdf({
    invoice: { id: 1, uid: 'abcd1234', number: 'INV-1', status: 'paid', fee: 115, created_at: new Date('2026-01-01') },
    items: [{ title: 'Pro plan', amount: 100, tax: 15 }],
    customer: { first_name: 'A', last_name: 'B', work_email: 'a@b.com' },
    currency: { code: 'USD', format: '$%v' },
    siteName: 'SendQ',
  });
  assert.ok(Buffer.isBuffer(pdf));
  assert.strictEqual(pdf.slice(0, 5).toString(), '%PDF-'); // valid PDF magic header
  assert.ok(pdf.length > 800, `PDF unexpectedly small: ${pdf.length} bytes`);
});

test('generateInvoicePdf: falls back to invoice.fee when there are no items', async () => {
  const pdf = await generateInvoicePdf({
    invoice: { id: 2, uid: 'x', status: 'pending', fee: 50, title: 'Subscription', created_at: new Date('2026-02-01') },
    items: [],
    currency: { code: 'USD' },
  });
  assert.strictEqual(pdf.slice(0, 5).toString(), '%PDF-');
});
