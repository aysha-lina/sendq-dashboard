// Additive, idempotent: add contact-info columns to sendq_customers.
// Safe on the shared DB — only adds columns that don't already exist; PHP ignores extras.
// Run:  node scripts/add-contact-columns.js
const prisma = require('../src/config/database.config');

const COLUMNS = {
  company: 'VARCHAR(255) NULL',
  phone: 'VARCHAR(255) NULL',
  address: 'VARCHAR(255) NULL',
  city: 'VARCHAR(255) NULL',
  state: 'VARCHAR(255) NULL',
  zip: 'VARCHAR(255) NULL',
  country: 'VARCHAR(255) NULL',
  website: 'VARCHAR(255) NULL',
  tax_number: 'VARCHAR(255) NULL',
};

(async () => {
  const rows = await prisma.$queryRawUnsafe(
    "SELECT COLUMN_NAME AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sendq_customers'",
  );
  const existing = new Set(rows.map((r) => String(r.c).toLowerCase()));
  for (const [col, def] of Object.entries(COLUMNS)) {
    if (existing.has(col)) { console.log(`skip ${col} (already exists)`); continue; }
     
    await prisma.$executeRawUnsafe(`ALTER TABLE sendq_customers ADD COLUMN \`${col}\` ${def}`);
    console.log(`added ${col}`);
  }
  await prisma.$disconnect();
  console.log('Done.');
  process.exit(0);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
