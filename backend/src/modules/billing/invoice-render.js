const prisma = require('../../config/database.config');
const { generateInvoicePdf } = require('./invoice-pdf');
const { buildInvoiceHtml, DEFAULT_TEMPLATE } = require('./invoice-template');
const { htmlToPdf } = require('./html-to-pdf');

const baseUrl = () => process.env.API_URL || `http://localhost:${process.env.PORT || 5000}`;

const loadSettings = async (names) => {
  try {
    const rows = await prisma.setting.findMany({ where: { name: { in: names } } });
    return Object.fromEntries(rows.map((r) => [r.name, r.value]));
  } catch { return {}; }
};

// Render an invoice PDF. Uses the admin's custom HTML invoice template (rendered to PDF via
// a headless browser) when one is configured AND a browser is available; otherwise falls
// back to the dependency-free pdfkit layout so the endpoint always returns a valid PDF.
const renderInvoicePdf = async ({ invoice, items = [], customer, currency, siteName = 'SendQ' }) => {
  const settings = await loadSettings([
    'invoice_template', 'company_name', 'company_address', 'company_email', 'company_phone',
  ]);
  const template = settings.invoice_template && settings.invoice_template.trim()
    ? settings.invoice_template
    : DEFAULT_TEMPLATE;

  try {
    const html = buildInvoiceHtml({
      invoice, items, customer, currency, template,
      company: {
        company_name: settings.company_name || siteName,
        company_address: settings.company_address,
        company_email: settings.company_email,
        company_phone: settings.company_phone,
      },
    });
    return await htmlToPdf(html, { baseUrl: baseUrl() });
  } catch (err) {
    // No browser / render failure → dependency-free pdfkit layout.
    console.warn('[invoice] HTML→PDF unavailable, using pdfkit fallback:', err.message);
    return generateInvoicePdf({ invoice, items, customer, currency, siteName });
  }
};

module.exports = { renderInvoicePdf };
