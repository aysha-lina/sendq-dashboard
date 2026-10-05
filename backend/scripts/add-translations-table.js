// Idempotent: per-locale UI translation overrides edited via admin Languages → Translate.
//   node scripts/add-translations-table.js
const prisma = require('../src/config/database.config');

(async () => {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS sendq_translations (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      locale VARCHAR(10) NOT NULL,
      tkey VARCHAR(255) NOT NULL,
      value TEXT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE KEY uniq_locale_key (locale, tkey)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  console.log('sendq_translations table ready.');
  await prisma.$disconnect();
  process.exit(0);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
