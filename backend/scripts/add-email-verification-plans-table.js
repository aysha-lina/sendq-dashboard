// Additive, idempotent: create sendq_email_verification_plans (admin Email verification plans).
// CRUD is done via raw SQL so no Prisma regen is required. Run once:
//   node scripts/add-email-verification-plans-table.js
const prisma = require('../src/config/database.config');

const SQL = `CREATE TABLE IF NOT EXISTS sendq_email_verification_plans (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  uid CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  email_verification_credits INT NOT NULL DEFAULT 0,
  price DECIMAL(16,2) NOT NULL DEFAULT 0,
  currency_id INT UNSIGNED NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'recurring',
  frequency_amount VARCHAR(50) NULL,
  frequency_unit VARCHAR(50) NULL,
  trial_amount INT NULL,
  trial_unit VARCHAR(50) NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_evp_uid (uid)
)`;

(async () => {
  await prisma.$executeRawUnsafe(SQL);
  console.log('sendq_email_verification_plans ready.');
  await prisma.$disconnect();
  process.exit(0);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
