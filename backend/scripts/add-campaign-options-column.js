// Additive, idempotent: add an `options` JSON-text column to sendq_campaigns.
// Stores multi-list/segment targets and resend-to-non-openers config without a
// dedicated column per feature. Safe on the shared DB — PHP ignores the extra column.
// Run:  node scripts/add-campaign-options-column.js
const prisma = require('../src/config/database.config');

const COLUMNS = {
  options: 'LONGTEXT NULL',
};

(async () => {
  const rows = await prisma.$queryRawUnsafe(
    "SELECT COLUMN_NAME AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sendq_campaigns'",
  );
  const existing = new Set(rows.map((r) => String(r.c).toLowerCase()));
  for (const [col, def] of Object.entries(COLUMNS)) {
    if (existing.has(col)) { console.log(`skip ${col} (already exists)`); continue; }
     
    await prisma.$executeRawUnsafe(`ALTER TABLE sendq_campaigns ADD COLUMN \`${col}\` ${def}`);
    console.log(`added ${col}`);
  }
  await prisma.$disconnect();
  console.log('Done.');
  process.exit(0);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
