// BUG-5 step 2: make the blacklist per-tenant — replace the global UNIQUE(email)
// with UNIQUE(customer_id, email). Idempotent. Safe (table has 0 rows).
// Run: node --env-file=.env scripts/add-blacklist-composite-unique.js
const mysql = require('mysql2/promise');

(async () => {
  const c = await mysql.createConnection(process.env.DATABASE_URL);
  const has = async (keyName) => {
    const [r] = await c.query(
      "SELECT COUNT(*) n FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'sendq_blacklists' AND index_name = ?",
      [keyName],
    );
    return Number(r[0].n) > 0;
  };

  if (await has('sendq_blacklists_email_key')) {
    await c.query('ALTER TABLE `sendq_blacklists` DROP INDEX `sendq_blacklists_email_key`');
    console.log('Dropped global UNIQUE(email).');
  } else {
    console.log('Global UNIQUE(email) already absent.');
  }

  if (await has('blacklist_customer_email_unique')) {
    console.log('Composite UNIQUE(customer_id, email) already exists.');
  } else {
    await c.query('ALTER TABLE `sendq_blacklists` ADD UNIQUE INDEX `blacklist_customer_email_unique` (`customer_id`, `email`)');
    console.log('Added UNIQUE(customer_id, email).');
  }
  await c.end();
})().catch((e) => { console.error('Migration failed:', e.message); process.exit(1); });
