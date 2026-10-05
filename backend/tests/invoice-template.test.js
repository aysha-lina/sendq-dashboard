const { test } = require('node:test');
const assert = require('node:assert');
const { fillTemplate, renderItemsTable, buildInvoiceHtml, escapeHtml, DEFAULT_TEMPLATE } = require('../src/modules/billing/invoice-template');

test('fillTemplate: replaces every {TAG} occurrence', () => {
  const out = fillTemplate('Hi {FIRST_NAME} {LAST_NAME}, inv {INVOICE_NUMBER} — {FIRST_NAME}', {
    FIRST_NAME: 'Ada', LAST_NAME: 'Lovelace', INVOICE_NUMBER: 'INV-9',
  });
  assert.strictEqual(out, 'Hi Ada Lovelace, inv INV-9 — Ada');
});

test('fillTemplate: unmapped tags become empty', () => {
  assert.strictEqual(fillTemplate('[{EMAIL}]', {}), '[]');
});

test('escapeHtml: neutralises HTML so values cannot break the template', () => {
  assert.strictEqual(escapeHtml('<b>x</b> & "q"'), '&lt;b&gt;x&lt;/b&gt; &amp; &quot;q&quot;');
});

test('renderItemsTable: lists items + subtotal/tax/total using the currency format', () => {
  const html = renderItemsTable(
    [{ title: 'Pro plan', amount: 100, tax: 15 }],
    { format: '$%v' },
    { fee: 115 },
  );
  assert.ok(html.includes('Pro plan'));
  assert.ok(html.includes('$100.00')); // line amount
  assert.ok(html.includes('Subtotal'));
  assert.ok(html.includes('Tax'));
  assert.ok(html.includes('$15.00')); // tax
  assert.ok(html.includes('$115.00')); // total = invoice.fee
});

test('renderItemsTable: hides the Tax row when there is no tax', () => {
  const html = renderItemsTable([{ title: 'Free', amount: 0, tax: 0 }], { code: 'USD' }, { fee: 0 });
  assert.ok(!/>\s*Tax\s*</.test(html));
});

test('renderItemsTable: falls back to a single row from the invoice when no items', () => {
  const html = renderItemsTable([], { format: '$%v' }, { title: 'Subscription', fee: 50 });
  assert.ok(html.includes('Subscription'));
  assert.ok(html.includes('$50.00'));
});

test('buildInvoiceHtml: fills the default template with invoice/customer/company data', () => {
  const html = buildInvoiceHtml({
    invoice: { number: 'INV-1', fee: 115, created_at: new Date('2026-01-01'), billing_first_name: 'Ada', billing_last_name: 'L' },
    items: [{ title: 'Pro', amount: 100, tax: 15 }],
    customer: { work_email: 'ada@x.com' },
    currency: { format: '$%v' },
    template: DEFAULT_TEMPLATE,
    company: { company_name: 'Acme Inc' },
  });
  assert.ok(html.includes('Acme Inc'));
  assert.ok(html.includes('INV-1'));
  assert.ok(html.includes('Ada'));
  assert.ok(html.includes('$115.00'));
  assert.ok(!html.includes('{ITEMS}')); // the items placeholder was filled
  assert.ok(!html.includes('{INVOICE_NUMBER}'));
});

test('buildInvoiceHtml: escapes injected customer values', () => {
  const html = buildInvoiceHtml({
    invoice: { number: 'INV-2', billing_first_name: '<script>alert(1)</script>' },
    items: [], currency: { code: 'USD' }, template: '{FIRST_NAME}', company: {},
  });
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
});
