const PDFDocument = require('pdfkit');

// Format an amount with the currency's format string ("$%v", "%v USD"…) or fall back to "CODE 0.00".
const formatMoney = (amount, currency) => {
  const n = Number(amount || 0).toFixed(2);
  const fmt = currency && currency.format;
  if (fmt && fmt.includes('%v')) return fmt.replace('%v', n);
  if (fmt && fmt.includes('{PRICE}')) return fmt.replace('{PRICE}', n);
  return `${(currency && currency.code) || ''} ${n}`.trim();
};

// Render a clean A4 invoice PDF. Returns a Promise<Buffer>.
const generateInvoicePdf = ({ invoice, items = [], customer, currency, siteName = 'SendQ' }) => new Promise((resolve, reject) => {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  doc.on('end', () => resolve(Buffer.concat(chunks)));
  doc.on('error', reject);

  // Header
  doc.fillColor('#1a1a2e').fontSize(20).text(siteName, 50, 50);
  doc.fillColor('#d32f2f').fontSize(24).text('INVOICE', 0, 48, { align: 'right' });

  // Meta (left) + Bill-To (right)
  doc.fillColor('#444').fontSize(10);
  const invNo = invoice.number || (invoice.uid ? invoice.uid.slice(0, 8) : String(invoice.id));
  const date = invoice.created_at ? new Date(invoice.created_at).toISOString().slice(0, 10) : '';
  doc.text(`Invoice #: ${invNo}`, 50, 95);
  doc.text(`Date: ${date}`, 50, 110);
  doc.text(`Status: ${String(invoice.status || '').toUpperCase()}`, 50, 125);

  const billName = [invoice.billing_first_name || (customer && customer.first_name), invoice.billing_last_name || (customer && customer.last_name)]
    .filter(Boolean).join(' ') || 'Customer';
  doc.fillColor('#1a1a2e').text('Bill To', 350, 95);
  doc.fillColor('#444').text(billName, 350, 110);
  const billEmail = invoice.billing_email || (customer && customer.work_email);
  if (billEmail) doc.text(billEmail, 350, 125);
  const billAddr = invoice.billing_address || (customer && customer.billing_address);
  if (billAddr) doc.text(String(billAddr), 350, 140, { width: 200 });

  // Items table header
  let y = 185;
  doc.rect(50, y, 500, 24).fill('#1a1a2e');
  doc.fillColor('#fff').fontSize(10)
    .text('Description', 56, y + 7)
    .text('Amount', 330, y + 7, { width: 90, align: 'right' })
    .text('Tax', 430, y + 7, { width: 110, align: 'right' });
  y += 28;

  const rows = items.length ? items : [{ title: invoice.title, amount: invoice.fee, tax: 0 }];
  let subtotal = 0;
  let taxTotal = 0;
  doc.fillColor('#333');
  rows.forEach((it, i) => {
    const amt = Number(it.amount || 0);
    const tax = Number(it.tax || 0);
    subtotal += amt;
    taxTotal += tax;
    if (i % 2) doc.rect(50, y - 4, 500, 22).fill('#f6f7fb').fillColor('#333');
    doc.fillColor('#333').fontSize(10)
      .text(it.title || 'Item', 56, y, { width: 260 })
      .text(formatMoney(amt, currency), 330, y, { width: 90, align: 'right' })
      .text(formatMoney(tax, currency), 430, y, { width: 110, align: 'right' });
    y += 22;
  });

  // Totals
  y += 8;
  doc.moveTo(330, y).lineTo(550, y).strokeColor('#ccc').stroke();
  y += 10;
  doc.fillColor('#444').fontSize(10)
    .text('Subtotal', 350, y).text(formatMoney(subtotal, currency), 450, y, { width: 100, align: 'right' });
  y += 16;
  doc.text('Tax', 350, y).text(formatMoney(taxTotal, currency), 450, y, { width: 100, align: 'right' });
  y += 18;
  doc.fillColor('#1a1a2e').fontSize(13)
    .text('Total', 350, y).text(formatMoney(invoice.fee != null ? invoice.fee : subtotal + taxTotal, currency), 450, y, { width: 100, align: 'right' });

  // Footer
  doc.fillColor('#999').fontSize(9).text(`${siteName} — Thank you for your business.`, 50, 770, { align: 'center', width: 500 });

  doc.end();
});

module.exports = { generateInvoicePdf, formatMoney };
