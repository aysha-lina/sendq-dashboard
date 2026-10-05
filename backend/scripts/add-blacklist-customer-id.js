// Additive, idempotent PREP migration for BUG-5 (per-customer blacklist scoping).
// Step 1 of the fix: add a nullable customer_id column + index to sendq_blacklists.
// Run when the DB is reachable:  node --env-file=.env scripts/add-blacklist-customer-id.js
//
// NOTE: this only adds the column. The full fix also requires (a) changing the unique key
// from (email) to (customer_id, email), (b) regenerating the Prisma client with the new
// field, and (c) scoping all blacklist reads/writes by customer_id in code. Those steps
// need a reachable DB + a Prisma regen and must be validated before production.
const mysql = require('mysql2/promise');

(async () => {
  const c = await mysql.createConnection(process.env.DATABASE_URL);
  const [cols] = await c.query(
    "SELECT column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'sendq_blacklists' AND column_name = 'customer_id'",
  );
  if (cols.length) {
    console.log('sendq_blacklists.customer_id already exists — nothing to do.');
    await c.end();
    return;
  }
  await c.query('ALTER TABLE `sendq_blacklists` ADD COLUMN `customer_id` INT UNSIGNED NULL AFTER `id`');
  await c.query('CREATE INDEX `idx_blacklist_customer` ON `sendq_blacklists` (`customer_id`)');
  console.log('Added sendq_blacklists.customer_id (nullable) + index idx_blacklist_customer.');
  await c.end();
})().catch((e) => { console.error('Migration failed:', e.message); process.exit(1); });
