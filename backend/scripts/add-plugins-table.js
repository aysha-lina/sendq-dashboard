// Idempotent: create the sendq_plugins table (mirrors PHP plugins schema). Run:
//   node scripts/add-plugins-table.js
const prisma = require('../src/config/database.config');

(async () => {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS sendq_plugins (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      uid VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      type VARCHAR(255) NULL,
      title VARCHAR(255) NOT NULL,
      description VARCHAR(255) NULL,
      version VARCHAR(255) NOT NULL,
      status VARCHAR(255) NOT NULL DEFAULT 'inactive',
      created_at DATETIME(3) NULL,
      updated_at DATETIME(3) NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_plugin_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  console.log('sendq_plugins table ready.');
  await prisma.$disconnect();
  process.exit(0);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
