#!/usr/bin/env node
 
/**
 * Runtime/layout crawler — visits every React route in the running app and records
 * console errors, failed API requests, auth redirects, and a screenshot per page.
 *
 *   (start frontend on :5173 and backend on :5000 first)
 *   node tools/crawl.js
 *
 * Output:
 *   tools/crawl-report.md   — table of every page + its errors
 *   tools/shots/*.png       — one screenshot per page
 *   tools/crawl-report.html — contact sheet (skim all pages + error badges at a glance)
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const jwt = require(path.join(__dirname, '..', 'backend', 'node_modules', 'jsonwebtoken'));

const ROOT = path.resolve(__dirname, '..');
const FE = path.join(ROOT, 'frontend', 'src');
const BASE = process.env.BASE || 'http://localhost:5173';
const API = process.env.API || 'http://127.0.0.1:5000';
const SHOTS = path.join(__dirname, 'shots');

const env = fs.readFileSync(path.join(ROOT, 'backend', '.env'), 'utf8');
const secret = ((env.match(/^JWT_SECRET=(.*)$/m) || [])[1] || '').trim();
const token = jwt.sign({ id: 1 }, secret, { expiresIn: '1d' });

const appJsx = fs.readFileSync(path.join(FE, 'App.jsx'), 'utf8');
const routes = [...appJsx.matchAll(/<Route\s+[^>]*?path="([^"]+)"/g)]
  .map((m) => m[1]).filter((p) => p && p !== '*' && !p.includes('*'));

const apiGet = async (p) => {
  try {
    const r = await fetch(`${API}${p}`, { headers: { Authorization: `Bearer ${token}` } });
    return await r.json();
  } catch { return null; }
};

(async () => {
  const me = await apiGet('/api/auth/me');
  const user = (me && (me.user || me)) || { id: 1, email: 'qa@local' };

  // Route-prefix → list endpoint, so dynamic routes get a REAL id of the right entity type.
  const SOURCES = [
    [/^\/templates\//, '/api/v1/templates'],
    [/^\/sending\/domains\//, '/api/v1/sending-domains'],
    [/^\/sending\/email-verification-servers\//, '/api/sending/verification-servers'],
    [/^\/admin\/customers\//, '/api/admin/customers'],
    [/^\/admin\/roles\//, '/api/admin/roles'],
    [/^\/admin\/plans\//, '/api/admin/plans'],
    [/^\/admin\/sending-credit-plans\//, '/api/admin/sending-credit-plans'],
    [/^\/admin\/email-verification-plans\//, '/api/admin/email-verification-plans'],
    [/^\/admin\/admins\//, '/api/admin/admins'],
    [/^\/admin\/admin-groups\//, '/api/admin/admin-groups'],
    [/^\/admin\/sending-servers\//, '/api/admin/sending-servers'],
    [/^\/admin\/bounce-handlers\//, '/api/admin/bounce-handlers'],
    [/^\/admin\/feedback-handlers\//, '/api/admin/feedback-handlers'],
    [/^\/admin\/email-verification-servers\//, '/api/admin/email-verification-servers'],
    [/^\/admin\/warmup-packages\//, '/api/admin/warmup-packages'],
    [/^\/admin\/warmup-inboxes\//, '/api/admin/warmup-inboxes'],
    [/^\/admin\/template-gallery\//, '/api/admin/template-gallery'],
    [/^\/admin\/form-templates\//, '/api/admin/form-templates'],
    [/^\/admin\/custom-emails\//, '/api/admin/custom-templates'],
    [/^\/admin\/payment-gateways\//, '/api/admin/payment-gateways'],
    [/^\/admin\/webhooks\//, '/api/admin/webhooks'],
    [/^\/admin\/currencies\//, '/api/admin/currencies'],
    [/^\/campaigns\//, '/api/v1/campaigns'],
    [/^\/lists\//, '/api/v1/lists'],
  ];
  const sampleByEp = {};
  for (const ep of [...new Set(SOURCES.map((s) => s[1]))]) {
    const d = await apiGet(ep + '?per_page=1');
    const first = (d && (d.data?.[0] || (Array.isArray(d) ? d[0] : null))) || null;
    if (first) sampleByEp[ep] = { id: first.id, uid: first.uid };
  }
  const sampleIds = Object.values(sampleByEp).flatMap((s) => [s.id, s.uid]).filter((v) => v != null).map(String);

  const resolveRoute = (p) => {
    if (!p.includes(':')) return p;
    const src = SOURCES.find(([re]) => re.test(p));
    const s = src ? sampleByEp[src[1]] : null;
    let out = p;
    if (s) {
      if (s.uid != null) out = out.replace(/:uid/g, String(s.uid));
      if (s.id != null) out = out.replace(/:id/g, String(s.id));
    }
    out = out.replace(/:code/g, 'en').replace(/:locale/g, 'en').replace(/:section/g, 'profile').replace(/:type/g, 'opens');
    out = out.replace(/:[A-Za-z]+/g, '__x__');
    return out.includes('__x__') ? null : out;
  };

  fs.mkdirSync(SHOTS, { recursive: true });
  // Prefer a system browser (no Playwright download needed); fall back to bundled chromium.
  let browser = null;
  for (const channel of ['msedge', 'chrome', null]) {
    try { browser = await chromium.launch(channel ? { channel } : {}); break; }
    catch { /* try next */ }
  }
  if (!browser) throw new Error('No browser available (install Edge/Chrome or run: npx playwright install chromium)');
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(([t, u]) => {
    localStorage.setItem('sendq_token', t);
    localStorage.setItem('sendq_user', u);
  }, [token, JSON.stringify(user)]);
  const page = await ctx.newPage();

  const results = [];
  for (const route of routes) {
    const url = resolveRoute(route);
    if (url === null) { results.push({ route, skipped: true }); process.stdout.write('-'); continue; }
    const errors = []; const failed = [];
    const onConsole = (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 240)); };
    const onPageErr = (e) => errors.push('PAGEERROR: ' + e.message.slice(0, 240));
    const onResp = (r) => { if (r.status() >= 400 && r.url().includes('/api/')) failed.push(`${r.status()} ${r.request().method()} ${r.url().replace(API, '').split('?')[0]}`); };
    page.on('console', onConsole); page.on('pageerror', onPageErr); page.on('response', onResp);
    let navErr = null;
    try { await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 25000 }); }
    catch (e) { navErr = e.message.split('\n')[0].slice(0, 140); }
    await page.waitForTimeout(800);
    const finalPath = page.url().replace(BASE, '').split('?')[0] || '/';
    const redirectedToLogin = /\/login/.test(finalPath) && !/login/.test(route);
    const safe = (route.replace(/[^\w]+/g, '_').replace(/^_|_$/g, '') || 'root').slice(0, 60);
    const shot = `shots/${safe}.png`;
    try { await page.screenshot({ path: path.join(__dirname, shot) }); } catch { /* ignore */ }
    page.off('console', onConsole); page.off('pageerror', onPageErr); page.off('response', onResp);
    const errs = [...new Set(errors)]; const fails = [...new Set(failed)];
    // A dynamic route whose ONLY errors are 404/500s for an injected sample id is a
    // test-data artifact (e.g. empty list, or id of a record that vanished) — bucket apart.
    const onlyResourceErrs = errs.every((e) => /Failed to load resource/.test(e));
    const failsAreSampleId = fails.every((f) => sampleIds.some((id) => id && f.includes(id)));
    const isDynamic = route.includes(':');
    const artifact = isDynamic && !navErr && !redirectedToLogin && onlyResourceErrs && failsAreSampleId && (errs.length || fails.length);
    const real = !artifact && (redirectedToLogin || navErr || errs.length || fails.length);
    const kind = real ? 'problem' : artifact ? 'artifact' : 'clean';
    results.push({ route, finalPath, redirectedToLogin, navErr, errors: errs, failed: fails, shot, kind });
    process.stdout.write(kind === 'problem' ? 'X' : kind === 'artifact' ? '~' : '.');
  }
  await browser.close();
  console.log('');

  // ── markdown report ──
  const problems = results.filter((r) => r.kind === 'problem');
  const artifacts = results.filter((r) => r.kind === 'artifact');
  const clean = results.filter((r) => r.kind === 'clean');
  const md = ['# Crawl report', '', `Visited ${results.filter((r) => !r.skipped).length} routes · ${results.filter((r) => r.skipped).length} skipped (dynamic, no sample id).`, ''];
  md.push(`## ❌ Real problems — ${problems.length}`, '');
  if (!problems.length) md.push('_None — every visited page rendered without real errors._');
  for (const r of problems) {
    md.push(`### \`${r.route}\``);
    if (r.redirectedToLogin) md.push(`- ⛔ redirected to **/login** (auth/guard issue)`);
    if (r.navErr) md.push(`- ⛔ navigation error: ${r.navErr}`);
    for (const e of r.errors) md.push(`- 🟥 console: ${e}`);
    for (const f of r.failed) md.push(`- 🌐 API ${f}`);
    md.push(`- 📸 ${r.shot}`, '');
  }
  md.push('', `## ~ Artifacts (dynamic route fed a wrong-type sample id — not real bugs) — ${artifacts.length}`, '');
  md.push('_To verify these for real, open each with a valid id. A 500 (vs 404) here = backend should handle bad ids gracefully._', '');
  for (const r of artifacts) md.push(`- \`${r.route}\` → ${r.failed.join(', ') || r.errors.join('; ')}`);
  md.push('', `## ✅ Clean pages — ${clean.length}`, '');
  for (const r of clean) md.push(`- \`${r.route}\``);
  fs.writeFileSync(path.join(__dirname, 'crawl-report.md'), md.join('\n'));

  // ── HTML contact sheet ──
  const card = (r) => {
    if (r.skipped) return '';
    const color = r.kind === 'problem' ? '#e53' : r.kind === 'artifact' ? '#d90' : '#2a7';
    const label = r.kind === 'problem' ? [r.redirectedToLogin && 'login', r.navErr && 'navErr', r.errors.length && `${r.errors.length} err`, r.failed.length && `${r.failed.length} api`].filter(Boolean).join(', ') : r.kind === 'artifact' ? 'no sample id' : 'ok';
    const badge = `<span style="color:${color}">● ${label}</span>`;
    return `<div style="border:1px solid #ccc;border-radius:6px;padding:6px;width:340px">
      <div style="font:12px monospace;display:flex;justify-content:space-between"><b>${r.route}</b>${badge}</div>
      <img src="${r.shot}" style="width:100%;border:1px solid #eee;margin-top:4px"/></div>`;
  };
  const html = `<!doctype html><meta charset=utf8><title>Crawl contact sheet</title>
  <body style="font-family:system-ui;background:#f4f6f9"><h2>SendQ crawl — ${results.filter((r) => !r.skipped).length} pages</h2>
  <div style="display:flex;flex-wrap:wrap;gap:12px">${results.map(card).join('')}</div>`;
  fs.writeFileSync(path.join(__dirname, 'crawl-report.html'), html);

  console.log('Crawl complete.');
  console.log(`  Real problems : ${problems.length}`);
  console.log(`  Artifacts     : ${artifacts.length} (dynamic routes, wrong-type sample id)`);
  console.log(`  Clean         : ${clean.length}`);
  console.log(`  Skipped       : ${results.filter((r) => r.skipped).length}`);
  console.log('  Report        : tools/crawl-report.md  ·  tools/crawl-report.html (open in browser)');
  for (const r of problems) console.log(`  X ${r.route}  ${[r.redirectedToLogin && 'LOGIN', r.navErr && 'NAVERR', r.errors.length && `${r.errors.length}err`, r.failed.length && `${r.failed.length}api`].filter(Boolean).join(' ')}`);
  process.exit(0);
})().catch((e) => { console.error('CRAWL FAILED:', e.message); process.exit(1); });
