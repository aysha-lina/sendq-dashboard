// Additive, idempotent: extra customer detail columns for the admin customer page.
// Read/written via raw SQL, so no Prisma regen is required. Run once:
//   node scripts/add-customer-detail-columns.js
const prisma = require('../src/config/database.config');

const COLUMNS = {
  language: 'VARCHAR(255) NULL',
  contact_first_name: 'VARCHAR(255) NULL',
  contact_last_name: 'VARCHAR(255) NULL',
  work_email: 'VARCHAR(255) NULL',
  address_2: 'VARCHAR(255) NULL',
  billing_address: 'VARCHAR(255) NULL',
};

(async () => {
  const rows = await prisma.$queryRawUnsafe(
    "SELECT COLUMN_NAME AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sendq_customers'",
  );
  const existing = new Set(rows.map((r) => String(r.c).toLowerCase()));
  for (const [col, def] of Object.entries(COLUMNS)) {
    if (existing.has(col)) { console.log(`skip ${col} (exists)`); continue; }
     
    await prisma.$executeRawUnsafe(`ALTER TABLE sendq_customers ADD COLUMN \`${col}\` ${def}`);
    console.log(`added ${col}`);
  }
  await prisma.$disconnect();
  console.log('Done.');
  process.exit(0);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
