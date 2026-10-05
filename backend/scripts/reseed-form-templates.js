// Base form templates with the exact popup layout variants (in display order),
// matching the PHP PRO-builder designs. Each is self-contained HTML so it renders
// both in the builder and as the card preview. Run:
//   node scripts/reseed-form-templates.js
const prisma = require('../src/config/database.config');
const { randomUUID } = require('crypto');

const HEAD = `<style>
*{box-sizing:border-box}body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#1f2937;background:#fff}
.wrap{max-width:760px;margin:0 auto}
h1,h2{margin:0 0 12px;font-weight:700}
.lorem{color:#374151;line-height:1.6;margin:0 0 18px}
.ph{background:#d9d6cf}
.form label{display:block;font-size:12px;font-weight:600;margin-bottom:6px}
.form input{width:100%;padding:9px;border:1px solid #d1d5db;border-radius:4px;margin-bottom:12px}
.form button{background:#111827;color:#fff;border:0;padding:9px 18px;border-radius:4px;cursor:pointer}
.foot{font-size:12px;color:#374151;text-align:center;margin-top:18px}.foot b{color:#111827}
.pad{padding:34px}
</style>`;
const FORM = `<div class="form"><label>Email</label><input type="email"/><button>Submit</button></div>`;
const INTRO = `<h2>{LIST_NAME}</h2><p class="lorem">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Morbi tristique ligula ac ipsum interdum.</p>`;
const FOOT = `<div class="foot">Made by <b>YourBrand</b></div>`;
const doc = (body) => `<!doctype html><html><head><meta charset="utf-8">${HEAD}</head><body>${body}</body></html>`;

// Order = how they appear on the page (top→bottom).
const TEMPLATES = [
  { name: 'Right banner', category: 'Banner',
    content: doc(`<div class="wrap"><table width="100%" style="border-collapse:collapse"><tr>
      <td width="58%" valign="top" class="pad">${INTRO}${FORM}${FOOT}</td>
      <td width="42%" class="ph"></td></tr></table></div>`) },
  { name: 'Left banner', category: 'Banner',
    content: doc(`<div class="wrap"><table width="100%" style="border-collapse:collapse"><tr>
      <td width="42%" class="ph"></td>
      <td width="58%" valign="top" class="pad">${INTRO}${FORM}${FOOT}</td></tr></table></div>`) },
  { name: 'Top banner', category: 'Banner',
    content: doc(`<div class="wrap"><div class="ph" style="height:170px"></div><div class="pad">${INTRO}${FORM}${FOOT}</div></div>`) },
  { name: 'Bottom banner', category: 'Banner',
    content: doc(`<div class="wrap"><div class="pad">${INTRO}${FORM}${FOOT}</div><div class="ph" style="height:170px"></div></div>`) },
  { name: 'Event Featured', category: 'Featured',
    content: doc(`<div class="wrap" style="background:#1c1c1c;border-radius:8px;overflow:hidden"><table width="100%" style="border-collapse:collapse"><tr>
      <td width="42%" style="background:linear-gradient(rgba(0,0,0,.35),rgba(0,0,0,.55)),#3a2f2a;min-height:300px"></td>
      <td width="58%" valign="top" class="pad" style="color:#fff">
        <h2 style="color:#fff">{LIST_NAME}</h2><p class="lorem" style="color:#e5e7eb">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Morbi tristique ligula ac ipsum interdum.</p>
        <div class="foot" style="color:#e5e7eb">Made by <b style="color:#fff">YourBrand</b></div></td></tr></table></div>`) },
  { name: 'Sign up', category: 'Image',
    content: doc(`<div class="wrap"><table width="100%" style="border-collapse:collapse"><tr>
      <td width="55%" valign="top" class="pad"><h1>Sign up</h1><p class="lorem">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Morbi tristique ligula ac ipsum interdum.</p>${FOOT}</td>
      <td width="45%" class="ph" style="text-align:center;vertical-align:middle"><div style="font-size:48px;line-height:300px;color:#9aa0a6">🖥️</div></td></tr></table></div>`) },
  { name: 'Profile Card', category: 'Profile',
    content: doc(`<div class="wrap" style="background:linear-gradient(rgba(13,71,120,.75),rgba(13,71,120,.85)),#1d4ed8;border-radius:8px;text-align:center;color:#fff;padding:54px 30px">
      <div style="width:120px;height:120px;border-radius:50%;background:#ffffff33;border:4px solid #fff;margin:0 auto 18px"></div>
      <h1 style="color:#fff;font-size:40px">Lena Swift</h1>
      <div class="foot" style="color:#dbeafe;margin-top:30px">Made by <b style="color:#fff">YourBrand</b></div></div>`) },
];

(async () => {
  await prisma.$executeRawUnsafe('DELETE FROM sendq_form_templates');
  for (let i = 0; i < TEMPLATES.length; i += 1) {
    const t = TEMPLATES[i];
    await prisma.$executeRawUnsafe(
      'INSERT INTO sendq_form_templates (uid, name, category, content, created_at, updated_at) VALUES (?,?,?,?, DATE_SUB(NOW(3), INTERVAL ? SECOND), NOW(3))',
      randomUUID(), t.name, t.category, t.content, i);
  }
  console.log(`Reseeded ${TEMPLATES.length} ordered form templates.`);
  await prisma.$disconnect();
  process.exit(0);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
