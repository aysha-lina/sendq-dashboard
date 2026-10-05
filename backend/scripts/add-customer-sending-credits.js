// Idempotent, additive: a sending-credits balance on sendq_customers. Customers
// buy credits from a SendingCreditPlan; this column holds the current balance.
// Safe on the shared DB (PHP ignores the extra column).
// Run:  node scripts/add-customer-sending-credits.js
const prisma = require('../src/config/database.config');

(async () => {
  const rows = await prisma.$queryRawUnsafe(
    "SELECT COLUMN_NAME AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sendq_customers' AND COLUMN_NAME = 'sending_credits'",
  );
  if (rows.length) {
    console.log('skip sending_credits (already exists)');
  } else {
    await prisma.$executeRawUnsafe("ALTER TABLE sendq_customers ADD COLUMN `sending_credits` BIGINT NOT NULL DEFAULT 0");
    console.log('added sending_credits');
  }
  await prisma.$disconnect();
  console.log('Done.');
  process.exit(0);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
