// Idempotent: add SMTP (auto-reply) columns to sendq_warmup_inboxes. Run:
//   node scripts/add-warmup-inbox-smtp-columns.js
const prisma = require('../src/config/database.config');

const COLUMNS = [
  ['smtp_host', 'VARCHAR(255) NULL'],
  ['smtp_port', 'VARCHAR(20) NULL'],
  ['smtp_encryption', "VARCHAR(50) NULL DEFAULT 'tls'"],
  ['smtp_username', 'VARCHAR(255) NULL'],
  ['smtp_password', 'TEXT NULL'],
];

(async () => {
  for (const [name, def] of COLUMNS) {
    const exists = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*) c FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'sendq_warmup_inboxes' AND column_name = ?`, name);
    if (Number(exists[0].c) === 0) {
      await prisma.$executeRawUnsafe(`ALTER TABLE sendq_warmup_inboxes ADD COLUMN ${name} ${def}`);
      console.log(`Added column ${name}.`);
    } else {
      console.log(`Column ${name} already exists.`);
    }
  }
  await prisma.$disconnect();
  process.exit(0);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
