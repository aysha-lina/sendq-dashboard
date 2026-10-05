// Idempotent: create warmup package tables (admin Email Warmup > Warmup Packages). Run:
//   node scripts/add-warmup-packages-tables.js
const prisma = require('../src/config/database.config');

(async () => {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS sendq_warmup_packages (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      uid CHAR(36) NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT NULL,
      max_accounts INT NOT NULL DEFAULT 3,
      max_daily_volume INT NOT NULL DEFAULT 1000,
      duration_days INT NOT NULL DEFAULT 30,
      ramp_pattern VARCHAR(50) NOT NULL DEFAULT 'linear',
      status VARCHAR(50) NOT NULL DEFAULT 'active',
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE KEY uniq_uid (uid)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS sendq_warmup_package_customers (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      package_id INT UNSIGNED NOT NULL,
      customer_id INT UNSIGNED NOT NULL,
      warmup_accounts INT NOT NULL DEFAULT 1,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE KEY uniq_pkg_cust (package_id, customer_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  console.log('warmup package tables ready.');
  await prisma.$disconnect();
  process.exit(0);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
