// Idempotent, additive: a token_version on sendq_users for JWT revocation.
// Incrementing it invalidates all previously-issued tokens for that user
// (used for "log out everywhere" + on password change/reset). Safe on the
// shared DB (PHP ignores the extra column).
// Run:  node scripts/add-user-token-version.js
const prisma = require('../src/config/database.config');

(async () => {
  const rows = await prisma.$queryRawUnsafe(
    "SELECT COLUMN_NAME AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sendq_users' AND COLUMN_NAME = 'token_version'",
  );
  if (rows.length) {
    console.log('skip token_version (already exists)');
  } else {
    await prisma.$executeRawUnsafe("ALTER TABLE sendq_users ADD COLUMN `token_version` INT NOT NULL DEFAULT 0");
    console.log('added token_version');
  }
  await prisma.$disconnect();
  console.log('Done.');
  process.exit(0);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
