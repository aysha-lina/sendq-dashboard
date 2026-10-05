// Idempotent: base form templates table (admin Setting > Form templates). Run:
//   node scripts/add-form-templates-table.js
const prisma = require('../src/config/database.config');

const FORM_HTML = (title) => `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;font-family:Arial,Helvetica,sans-serif;background:#f3f4f6;padding:24px;color:#1f2937}
.f{background:#fff;max-width:340px;margin:0 auto;padding:26px;border-radius:8px;box-shadow:0 4px 18px rgba(0,0,0,.08)}
.f h2{font-size:20px;margin:0 0 18px}label{font-size:12px;font-weight:600}
.f input{width:100%;box-sizing:border-box;padding:9px;border:1px solid #d1d5db;border-radius:5px;margin:6px 0 14px}
.f button{background:#111827;color:#fff;border:0;padding:9px 18px;border-radius:5px;cursor:pointer}
.cr{margin-top:16px;font-size:11px;color:#9ca3af}</style></head>
<body><div class="f"><h2>${title}</h2><label>Email Address</label><input type="email"/>
<button>Sign Up</button><div class="cr">© 2025 SendQ</div></div></body></html>`;

const SEED = [
  { name: 'English Standard', category: 'English Standard' },
  { name: 'CSS Animated', category: 'CSS Animated' },
  { name: 'Full Featured', category: 'Full Featured' },
  { name: 'Minimal Popup', category: 'Minimal Popup' },
  { name: 'Big Banner', category: 'Big Banner' },
  { name: 'Sidebar Form', category: 'Sidebar Form' },
];

(async () => {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS sendq_form_templates (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      uid CHAR(36) NOT NULL,
      name VARCHAR(255) NOT NULL,
      category VARCHAR(255) NOT NULL DEFAULT 'Basic',
      content LONGTEXT NULL,
      image LONGTEXT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id), UNIQUE KEY uniq_uid (uid)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  const count = await prisma.$queryRawUnsafe('SELECT COUNT(*) c FROM sendq_form_templates');
  if (Number(count[0].c) === 0) {
    const { randomUUID } = require('crypto');
    for (const s of SEED) {
      await prisma.$executeRawUnsafe(
        'INSERT INTO sendq_form_templates (uid, name, category, content, created_at, updated_at) VALUES (?,?,?,?,NOW(3),NOW(3))',
        randomUUID(), s.name, s.category, FORM_HTML('Subscribe to our newsletter'),
      );
    }
    console.log(`Seeded ${SEED.length} base form templates.`);
  } else {
    console.log('Form templates already exist.');
  }
  console.log('sendq_form_templates ready.');
  await prisma.$disconnect();
  process.exit(0);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
