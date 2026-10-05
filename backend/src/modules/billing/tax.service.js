const prisma = require('../../config/database.config');

// Pure tax math — exported for unit tests. `ratePercent` is a percentage (e.g. 15 = 15%).
// When the rate is 0 the total equals the subtotal exactly (no behaviour change).
const computeTax = (subtotal, ratePercent) => {
  const sub = Math.max(0, Number(subtotal) || 0);
  const rate = Math.max(0, Number(ratePercent) || 0);
  const tax = Math.round(sub * rate) / 100;        // sub * (rate/100), rounded to cents
  const total = Math.round((sub + tax) * 100) / 100;
  return { subtotal: sub, rate, tax, total };
};

// Resolve the applicable tax rate (%) for a customer:
//   - tax disabled (setting `tax_enabled` not 1/yes)        → 0
//   - per-country override in sendq_country_taxes           → that rate
//   - otherwise the global `tax_rate` setting               → that rate
// Fails safe to 0 on any error so checkout never breaks on tax lookup.
const resolveTaxRate = async (customer) => {
  try {
    const settings = await prisma.setting.findMany({ where: { name: { in: ['tax_enabled', 'tax_rate'] } } });
    const map = Object.fromEntries(settings.map((s) => [s.name, s.value]));
    if (map.tax_enabled !== '1' && map.tax_enabled !== 'yes') return 0;
    const country = String(customer?.country || '').trim();
    if (country) {
      const rows = await prisma.$queryRawUnsafe(
        'SELECT rate FROM sendq_country_taxes WHERE country = ? LIMIT 1', country,
      );
      if (Array.isArray(rows) && rows.length) return Number(rows[0].rate) || 0;
    }
    return Number(map.tax_rate) || 0;
  } catch {
    return 0;
  }
};

// Resolve rate + apply it. Returns { subtotal, rate, tax, total }.
const taxedTotal = async (subtotal, customer) => computeTax(subtotal, await resolveTaxRate(customer));

module.exports = { computeTax, resolveTaxRate, taxedTotal };
