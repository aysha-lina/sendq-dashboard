// Idempotent: create the per-country tax-rate table used by Plan > Tax settings. Run:
//   node scripts/add-country-taxes-table.js
const prisma = require('../src/config/database.config');

(async () => {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS sendq_country_taxes (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      country VARCHAR(255) NOT NULL,
      rate DECIMAL(8,2) NOT NULL DEFAULT 0,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE KEY uniq_country (country)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  console.log('sendq_country_taxes table ready.');
  await prisma.$disconnect();
  process.exit(0);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
