// Idempotent: ensure the Omani Rial (OMR) currency exists. Run:
//   node scripts/seed-omr-currency.js
const prisma = require('../src/config/database.config');

(async () => {
  const existing = await prisma.currency.findFirst({ where: { code: 'OMR' } });
  if (existing) { console.log('OMR already exists.'); process.exit(0); }
  await prisma.currency.create({ data: { name: 'Omani Rial', code: 'OMR', format: 'OMR {PRICE}', status: 'active' } });
  console.log('Added Omani Rial (OMR).');
  await prisma.$disconnect();
  process.exit(0);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
