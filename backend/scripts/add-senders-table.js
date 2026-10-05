// Idempotent, additive: verified sender (From-address) table. Greenfield — no
// senders table exists in this DB. Safe on the shared DB (PHP ignores it here).
// Run:  node scripts/add-senders-table.js
const prisma = require('../src/config/database.config');

(async () => {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS sendq_senders (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      uid CHAR(36) NOT NULL,
      customer_id INT UNSIGNED NULL,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'unverified',
      verification_token CHAR(40) NULL,
      verified_at DATETIME(3) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE KEY uniq_uid (uid),
      KEY idx_sender_customer (customer_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  console.log('sendq_senders ready.');
  await prisma.$disconnect();
  process.exit(0);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
