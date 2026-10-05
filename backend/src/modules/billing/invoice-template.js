const { formatMoney } = require('./invoice-pdf');

// Renders the customer-editable HTML invoice template (admin → Invoice template) by
// filling its {TAG} placeholders, mirroring the PHP Invoice::getInvoiceHtml() str_replace
// approach + the _template_items items table. Pure functions here are unit-tested; the DB
// loads live in invoice-render.js.

// Backend fallback when no custom template is saved (ported from the frontend DEFAULT_TEMPLATE).
const DEFAULT_TEMPLATE = `
<div style="max-width:900px;margin:0 auto;padding:0 4px 40px;font-family:'Noto Sans',Arial,Helvetica,sans-serif;color:#333333;">
  <div style="height:18px;background:#ff0000;"></div>
  <div style="padding-top:18px;">
    <h1 style="color:#ff0000;font-size:30px;margin:18px 0 24px;">TAX INVOICE</h1>
  </div>
  <table style="width:100%;border-collapse:collapse;"><tbody><tr>
    <td style="vertical-align:top;width:55%;padding-right:24px;">
      <p style="font-weight:bold;font-size:16px;margin:0 0 8px;">{COMPANY_NAME}</p>
      <p style="margin:3px 0;color:#9aa0a6;">{COMPANY_ADDRESS}</p>
      <p style="margin:3px 0;color:#9aa0a6;">{COMPANY_EMAIL}</p>
      <p style="margin:3px 0;color:#9aa0a6;">{COMPANY_PHONE}</p>
    </td>
    <td style="vertical-align:top;">
      <table style="width:100%;border-collapse:collapse;color:#9aa0a6;"><tbody>
        <tr><td style="text-align:right;padding:8px;border-bottom:1px solid #eee;">Invoice #:</td><td style="text-align:right;padding:8px;border-bottom:1px solid #eee;color:#333;font-weight:bold;">{INVOICE_NUMBER}</td></tr>
        <tr><td style="text-align:right;padding:8px;border-bottom:1px solid #eee;">Created at:</td><td style="text-align:right;padding:8px;border-bottom:1px solid #eee;color:#333;">{CURRENT_DATETIME}</td></tr>
        <tr><td style="text-align:right;padding:8px;border-bottom:1px solid #eee;">Due date:</td><td style="text-align:right;padding:8px;border-bottom:1px solid #eee;color:#333;">{INVOICE_DUE_DATE}</td></tr>
      </tbody></table>
    </td>
  </tr></tbody></table>
  <div style="margin-top:34px;">
    <p style="color:#ff0000;font-weight:bold;font-size:12px;letter-spacing:1px;margin:0 0 10px;">BILL TO</p>
    <p style="font-weight:bold;margin:0 0 8px;">{FIRST_NAME} {LAST_NAME}</p>
    <p style="margin:3px 0;color:#9aa0a6;">{ADDRESS}, {COUNTRY}</p>
    <p style="margin:3px 0;color:#9aa0a6;">{EMAIL}</p>
    <p style="margin:3px 0;color:#9aa0a6;">{PHONE}</p>
  </div>
  <div style="margin-top:28px;border-top:1px solid #eee;padding-top:18px;min-height:60px;">{ITEMS}</div>
  <p style="text-align:center;color:#ff4d6d;margin-top:48px;">Thanks for your purchase.</p>
</div>`;

const TAGS = [
  'COMPANY_NAME', 'COMPANY_ADDRESS', 'COMPANY_EMAIL', 'COMPANY_PHONE',
  'FIRST_NAME', 'LAST_NAME', 'ADDRESS', 'COUNTRY', 'EMAIL', 'PHONE',
  'INVOICE_NUMBER', 'CURRENT_DATETIME', 'INVOICE_DUE_DATE', 'ITEMS', 'CUSTOMER_ADDRESS',
];

const escapeHtml = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Render the {ITEMS} block: a line-items table + subtotal / tax / total (mirrors PHP
// _template_items.blade.php). items[].amount = base, items[].tax = absolute tax amount.
const renderItemsTable = (items = [], currency, invoice = {}) => {
  const rows = items.length ? items : [{ title: invoice.title || 'Subscription', amount: invoice.fee, tax: 0 }];
  const subtotal = rows.reduce((s, it) => s + (Number(it.amount) || 0), 0);
  const tax = rows.reduce((s, it) => s + (Number(it.tax) || 0), 0);
  const total = Number(invoice.fee) || (subtotal + tax);
  const body = rows.map((it) => `
        <tr>
          <td style="padding:10px 8px;border-bottom:1px solid #eee;">
            <strong>${escapeHtml(it.title || 'Item')}</strong>
            ${it.description ? `<br><span style="color:#9aa0a6;font-size:12px;">${escapeHtml(it.description)}</span>` : ''}
          </td>
          <td style="padding:10px 8px;border-bottom:1px solid #eee;text-align:right;">${escapeHtml(formatMoney(it.amount, currency))}</td>
        </tr>`).join('');
  const summaryRow = (label, value, bold) => `
        <tr>
          <td style="padding:6px 8px;text-align:right;color:#9aa0a6;">${label}</td>
          <td style="padding:6px 8px;text-align:right;${bold ? 'font-weight:bold;color:#333;' : ''}">${escapeHtml(value)}</td>
        </tr>`;
  return `
    <table style="width:100%;border-collapse:collapse;">
      <thead><tr>
        <th style="text-align:left;padding:10px 8px;border-bottom:2px solid #ff0000;">Items</th>
        <th style="text-align:right;padding:10px 8px;border-bottom:2px solid #ff0000;">Price</th>
      </tr></thead>
      <tbody>${body}
        ${summaryRow('Subtotal', formatMoney(subtotal, currency))}
        ${tax > 0 ? summaryRow('Tax', formatMoney(tax, currency)) : ''}
        ${summaryRow('Total', formatMoney(total, currency), true)}
      </tbody>
    </table>`;
};

// Replace every {TAG} in the template with its mapped value (plain string replace, like PHP).
const fillTemplate = (templateHtml, tagMap) => {
  let html = String(templateHtml || '');
  for (const tag of TAGS) {
    const value = tagMap[tag] != null ? tagMap[tag] : '';
    html = html.split(`{${tag}}`).join(value);
  }
  return html;
};

const fmtDate = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? '' : dt.toISOString().slice(0, 16).replace('T', ' ');
};

// Build the final invoice HTML from data + a template + company settings. Pure (no I/O):
// callers pass `template` (custom or DEFAULT_TEMPLATE) and a `company` settings map.
const buildInvoiceHtml = ({ invoice = {}, items = [], customer = {}, currency, template, company = {} }) => {
  const first = invoice.billing_first_name || customer.first_name || '';
  const last = invoice.billing_last_name || customer.last_name || '';
  const address = invoice.billing_address || customer.billing_address || customer.address || '';
  const tagMap = {
    COMPANY_NAME: escapeHtml(company.company_name || 'SendQ'),
    COMPANY_ADDRESS: escapeHtml(company.company_address || ''),
    COMPANY_EMAIL: escapeHtml(company.company_email || ''),
    COMPANY_PHONE: escapeHtml(company.company_phone || ''),
    FIRST_NAME: escapeHtml(first),
    LAST_NAME: escapeHtml(last),
    ADDRESS: escapeHtml(address),
    COUNTRY: escapeHtml(invoice.billing_country || customer.country || ''),
    EMAIL: escapeHtml(invoice.billing_email || customer.work_email || customer.billing_email || ''),
    PHONE: escapeHtml(invoice.billing_phone || customer.phone || ''),
    INVOICE_NUMBER: escapeHtml(invoice.number || (invoice.uid ? invoice.uid.slice(0, 8) : '')),
    CURRENT_DATETIME: escapeHtml(fmtDate(invoice.created_at)),
    INVOICE_DUE_DATE: escapeHtml(fmtDate(invoice.due_date || invoice.created_at)),
    CUSTOMER_ADDRESS: escapeHtml(address),
    ITEMS: renderItemsTable(items, currency, invoice), // not escaped — it's our HTML
  };
  return fillTemplate(template || DEFAULT_TEMPLATE, tagMap);
};

module.exports = { DEFAULT_TEMPLATE, TAGS, escapeHtml, renderItemsTable, fillTemplate, buildInvoiceHtml };
