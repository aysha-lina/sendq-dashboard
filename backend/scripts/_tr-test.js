const prisma = require('../src/config/database.config');
(async () => {
  await prisma.$executeRawUnsafe(
    'INSERT INTO sendq_translations (locale, tkey, value) VALUES (?,?,?) ON DUPLICATE KEY UPDATE value=VALUES(value), updated_at=NOW(3)',
    'de', 'camp.test_key', 'HALLO-RT-OK');
  const r = await fetch('http://127.0.0.1:5000/api/v1/public/translations/de').then(x => x.json());
  console.log('public returns camp.test_key =', r.translations['camp.test_key']);
  await prisma.$executeRawUnsafe('DELETE FROM sendq_translations WHERE locale=? AND tkey=?', 'de', 'camp.test_key');
  console.log('cleanup done');
  await prisma.$disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
