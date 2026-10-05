// Idempotent: tables for Custom Emails & Pages + Languages. Run:
//   node scripts/add-custom-pages-languages.js
const prisma = require('../src/config/database.config');
const { randomUUID } = require('crypto');

const CUSTOM = [
  ['Final "Welcome" email', 'Sign-up', 'email'],
  ['Registration confirmation email', 'Subscription', 'email'],
  ['Update profile email sent', 'Update profile', 'page'],
  ['Update profile success page', 'Update profile', 'page'],
  ['Update profile form', 'Update profile', 'page'],
  ['Update profile email', 'Update profile', 'email'],
  ['Unsubscribe "Goodbye" email', 'Unsubscribe', 'email'],
  ['Unsubscribe confirmation page', 'Unsubscribe', 'page'],
  ['Forgot password email', 'Password', 'email'],
  ['Reset password page', 'Password', 'page'],
];
const LANGS = [['Arabic', 'ar'], ['English', 'en']];

(async () => {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS sendq_custom_templates (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT, uid CHAR(36) NOT NULL,
      name VARCHAR(255) NOT NULL, group_label VARCHAR(255) NOT NULL,
      type VARCHAR(20) NOT NULL DEFAULT 'email', content LONGTEXT NULL,
      custom_page_count INT NOT NULL DEFAULT 0,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id), UNIQUE KEY uniq_uid (uid)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS sendq_languages (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT, uid CHAR(36) NOT NULL,
      name VARCHAR(255) NOT NULL, code VARCHAR(20) NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'active',
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id), UNIQUE KEY uniq_uid (uid), UNIQUE KEY uniq_code (code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);

  const cc = await prisma.$queryRawUnsafe('SELECT COUNT(*) c FROM sendq_custom_templates');
  if (Number(cc[0].c) === 0) {
    for (const [name, grp, type] of CUSTOM) {
      await prisma.$executeRawUnsafe(
        'INSERT INTO sendq_custom_templates (uid, name, group_label, type, content, created_at, updated_at) VALUES (?,?,?,?,?,NOW(3),NOW(3))',
        randomUUID(), name, grp, type, `<p>Default ${name} content. Edit to customize.</p>`);
    }
    console.log(`Seeded ${CUSTOM.length} custom templates.`);
  } else { console.log('Custom templates already exist.'); }

  const lc = await prisma.$queryRawUnsafe('SELECT COUNT(*) c FROM sendq_languages');
  if (Number(lc[0].c) === 0) {
    for (const [name, code] of LANGS) {
      await prisma.$executeRawUnsafe(
        'INSERT INTO sendq_languages (uid, name, code, status, created_at, updated_at) VALUES (?,?,?,?,NOW(3),NOW(3))',
        randomUUID(), name, code, 'active');
    }
    console.log(`Seeded ${LANGS.length} languages.`);
  } else { console.log('Languages already exist.'); }

  await prisma.$disconnect();
  process.exit(0);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
