#!/usr/bin/env node
 
/**
 * Visual / structural parity diff: loads each mapped page in BOTH the original PHP
 * app and the React clone, screenshots them side-by-side, and diffs their "UI
 * fingerprint" (headings, tab labels, button text, table columns, form labels) so
 * theme differences are ignored and real structural gaps (missing buttons/columns/
 * sections) surface automatically.
 *
 * Prereqs: React app on :5173 + backend on :5000 running; the live PHP app reachable.
 * Provide PHP access via env or tools/.parity.env (KEY=VALUE per line):
 *   PHP_URL=https://your-php-app.example.com      (no trailing slash)
 *   PHP_EMAIL=you@example.com
 *   PHP_PASS=yourpassword
 *   # optional: REACT_URL (default http://localhost:5173), API (default http://127.0.0.1:5000)
 *
 * Run:  node tools/visual-parity.js
 * Output:
 *   tools/parity-shots/*.png         — php_<name>.png + react_<name>.png
 *   tools/visual-parity-report.md    — per-page structural diff
 *   tools/visual-parity.html         — side-by-side contact sheet + diff
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const jwt = require(path.join(__dirname, '..', 'backend', 'node_modules', 'jsonwebtoken'));

const ROOT = path.resolve(__dirname, '..');
const SHOTS = path.join(__dirname, 'parity-shots');

// ── config (env or tools/.parity.env) ───────────────────────────────────────────
const cfgFile = path.join(__dirname, '.parity.env');
if (fs.existsSync(cfgFile)) {
  for (const line of fs.readFileSync(cfgFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}
const PHP_URL = (process.env.PHP_URL || '').replace(/\/$/, '');
const PHP_EMAIL = process.env.PHP_EMAIL || '';
const PHP_PASS = process.env.PHP_PASS || '';
const REACT_URL = (process.env.REACT_URL || 'http://localhost:5173').replace(/\/$/, '');
const API = (process.env.API || 'http://127.0.0.1:5000').replace(/\/$/, '');

if (!PHP_URL || !PHP_EMAIL || !PHP_PASS) {
  console.error('Missing PHP access. Set PHP_URL, PHP_EMAIL, PHP_PASS in env or tools/.parity.env');
  process.exit(2);
}

// React auth (JWT in localStorage, same as crawl.js)
const env = fs.readFileSync(path.join(ROOT, 'backend', '.env'), 'utf8');
const secret = ((env.match(/^JWT_SECRET=(.*)$/m) || [])[1] || '').trim();
const token = jwt.sign({ id: 1 }, secret, { expiresIn: '1d' });

// ── page map: name, React path, PHP path. {LIST}/{CAMP}/{DOMAIN} get a sample id. ──
const MAP = [
  ['Dashboard', '/dashboard', '/'],
  ['Campaigns', '/campaigns', '/campaigns'],
  ['Campaign create (wizard)', '/campaigns/create', '/campaigns/create'],
  ['Lists', '/lists/all', '/lists'],
  ['Subscribers', '/lists/contacts', '/lists/{LIST}/subscribers'],
  ['Segments', '/lists/segments', '/lists/{LIST}/segments'],
  ['Manage list fields', '/lists/fields', '/lists/{LIST}/fields'],
  ['List email verification', '/lists/email-verification', '/lists/{LIST}/verification'],
  ['Forms', '/lists/forms', '/forms'],
  ['Templates', '/templates', '/templates'],
  ['Sending domains', '/sending/domains', '/sending_domains'],
  ['Tracking domains', '/sending/tracking-domains', '/tracking_domains'],
  ['Signatures', '/sending/signatures', '/signatures'],
  ['Blacklist', '/sending/blacklist', '/blacklists'],
  ['Billing', '/billing', '/account/billing'],
  ['Account profile', '/campaign-api', '/account/profile'],
  ['Admin dashboard', '/admin', '/admin'],
  ['Admin blacklist', '/admin/blacklist', '/admin/blacklist'],
  ['Admin templates', '/admin/template-gallery', '/admin/templates'],
];

const apiGet = async (p) => {
  try {
    const r = await fetch(`${API}${p}`, { headers: { Authorization: `Bearer ${token}` } });
    return await r.json();
  } catch { return null; }
};

// Extract a structural UI fingerprint from whatever page is loaded (runs in-browser).
const FINGERPRINT = () => {
  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const grab = (sel, attr) => {
    const out = [];
    document.querySelectorAll(sel).forEach((el) => {
      const t = norm(attr ? el.getAttribute(attr) : el.textContent);
      if (t && t.length <= 60) out.push(t);
    });
    return [...new Set(out)];
  };
  return {
    headings: grab('h1, h2, h3, h4'),
    tabs: grab('[role="tab"], .nav-tabs a, .nav-link, .nav-pills a, .sending-tabs button, .cw-stepbar-tab'),
    buttons: [...grab('button'), ...grab('a.btn, .btn, .btn-primary, .btn-secondary, .btn-danger'), ...grab('input[type="submit"]', 'value')],
    columns: grab('th, thead td, .sending-records-head span, .mlf-head > div'),
    labels: grab('label, .form-label, .cw-label'),
  };
};

const CATS = ['headings', 'tabs', 'buttons', 'columns', 'labels'];
const lc = (arr) => new Set(arr.map((s) => s.toLowerCase()));
const diffCat = (php, react) => {
  const ps = lc(php); const rs = lc(react);
  return {
    missing: php.filter((s) => !rs.has(s.toLowerCase())),     // in PHP, absent in React
    extra: react.filter((s) => !ps.has(s.toLowerCase())),     // in React, not in PHP
  };
};

(async () => {
  // Sample ids (shared DB → same uid valid in both apps).
  const listD = await apiGet('/api/v1/lists?per_page=1');
  const LIST = listD?.data?.[0]?.uid || '';
  const fill = (p) => p.replace('{LIST}', LIST);

  fs.mkdirSync(SHOTS, { recursive: true });
  let browser = null;
  for (const channel of ['msedge', 'chrome', null]) {
    try { browser = await chromium.launch(channel ? { channel } : {}); break; } catch { /* next */ }
  }
  if (!browser) throw new Error('No browser (install Edge/Chrome or: npx playwright install chromium)');

  // React context: JWT in localStorage.
  const me = await apiGet('/api/auth/me');
  const user = (me && (me.user || me)) || { id: 1, email: 'qa@local' };
  const reactCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await reactCtx.addInitScript(([t, u]) => {
    localStorage.setItem('sendq_token', t); localStorage.setItem('sendq_user', u);
  }, [token, JSON.stringify(user)]);
  const reactPage = await reactCtx.newPage();

  // PHP context: log in via the Laravel form to get a session cookie.
  const phpCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const phpPage = await phpCtx.newPage();
  console.log('Logging into PHP app…');
  try {
    await phpPage.goto(`${PHP_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });
    await phpPage.fill('input[type="email"], input[name="email"]', PHP_EMAIL);
    await phpPage.fill('input[type="password"], input[name="password"]', PHP_PASS);
    await Promise.all([
      phpPage.waitForNavigation({ timeout: 30000 }).catch(() => {}),
      phpPage.click('button[type="submit"], input[type="submit"], button:has-text("Login"), button:has-text("Sign in")'),
    ]);
    await phpPage.waitForTimeout(1200);
    if (/\/login/.test(phpPage.url())) {
      console.error('PHP login appears to have failed (still on /login). Check PHP_EMAIL/PHP_PASS.');
    } else {
      console.log('PHP login OK →', phpPage.url());
    }
  } catch (e) {
    console.error('PHP login error:', e.message);
  }

  const shotOf = async (page, base, route, prefix, name) => {
    const safe = name.replace(/[^\w]+/g, '_').replace(/^_|_$/g, '').toLowerCase().slice(0, 50);
    const rel = `parity-shots/${prefix}_${safe}.png`;
    try {
      await page.goto(base + route, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(900);
    } catch { /* capture whatever rendered */ }
    let fp = null;
    try { fp = await page.evaluate(FINGERPRINT); } catch { fp = null; }
    try { await page.screenshot({ path: path.join(__dirname, rel), fullPage: false }); } catch { /* ignore */ }
    return { rel, fp, finalUrl: page.url() };
  };

  const results = [];
  for (const [name, reactRoute, phpRoute] of MAP) {
    const rRoute = fill(reactRoute);
    const pRoute = fill(phpRoute);
    if (pRoute.includes('{')) { console.log(`~ skip ${name} (no sample id)`); continue; }
    process.stdout.write(`• ${name} … `);
    const react = await shotOf(reactPage, REACT_URL, rRoute, 'react', name);
    const php = await shotOf(phpPage, PHP_URL, pRoute, 'php', name);
    const diffs = {};
    let total = 0;
    if (php.fp && react.fp) {
      for (const c of CATS) {
        const d = diffCat(php.fp[c] || [], react.fp[c] || []);
        diffs[c] = d; total += d.missing.length + d.extra.length;
      }
    }
    const phpLoginRedirect = /\/login/.test(php.finalUrl);
    results.push({ name, reactRoute: rRoute, phpRoute: pRoute, react, php, diffs, total, phpLoginRedirect });
    console.log(phpLoginRedirect ? 'PHP→login' : `${total} diffs`);
  }

  await browser.close();

  // ── markdown report ──
  const md = ['# Visual / structural parity report', '',
    `Compared ${results.length} pages · PHP \`${PHP_URL}\` vs React \`${REACT_URL}\`.`,
    'Diff ignores styling — it compares headings, tabs, buttons, table columns and form labels.',
    '"Missing" = present in PHP, absent in React (likely a real gap). "Extra" = in React only.', ''];
  for (const r of results.sort((a, b) => b.total - a.total)) {
    md.push(`## ${r.name}  — ${r.phpLoginRedirect ? '⚠️ PHP redirected to login' : `${r.total} diffs`}`);
    md.push(`React \`${r.reactRoute}\` · PHP \`${r.phpRoute}\``);
    if (r.phpLoginRedirect) { md.push('_PHP page not captured (auth). Fix login or route, then re-run._', ''); continue; }
    if (!r.total) { md.push('_✅ structurally aligned._', ''); continue; }
    for (const c of CATS) {
      const d = r.diffs[c]; if (!d || (!d.missing.length && !d.extra.length)) continue;
      if (d.missing.length) md.push(`- **${c} missing in React:** ${d.missing.map((s) => `\`${s}\``).join(', ')}`);
      if (d.extra.length) md.push(`- _${c} only in React:_ ${d.extra.map((s) => `\`${s}\``).join(', ')}`);
    }
    md.push('');
  }
  fs.writeFileSync(path.join(__dirname, 'visual-parity-report.md'), md.join('\n'));

  // ── side-by-side HTML ──
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const diffHtml = (r) => {
    if (r.phpLoginRedirect) return '<p style="color:#c00">PHP redirected to login — not captured.</p>';
    if (!r.total) return '<p style="color:#2a7">✅ structurally aligned</p>';
    let out = '';
    for (const c of CATS) {
      const d = r.diffs[c]; if (!d || (!d.missing.length && !d.extra.length)) continue;
      if (d.missing.length) out += `<div><b style="color:#c0392b">${c} missing in React:</b> ${d.missing.map((s) => esc(s)).join(', ')}</div>`;
      if (d.extra.length) out += `<div style="color:#888">${c} only in React: ${d.extra.map((s) => esc(s)).join(', ')}</div>`;
    }
    return out;
  };
  const rows = results.map((r) => `
    <section style="border:1px solid #ccc;border-radius:8px;margin:14px 0;padding:12px;background:#fff">
      <h3 style="margin:0 0 8px">${esc(r.name)} <span style="font:12px monospace;color:#888">${esc(r.reactRoute)} ⇄ ${esc(r.phpRoute)}</span> — ${r.phpLoginRedirect ? '⚠️ PHP login' : `${r.total} diffs`}</h3>
      <div style="display:flex;gap:12px">
        <div style="flex:1"><div style="font:12px monospace;color:#777">PHP (original)</div><img src="${r.php.rel}" style="width:100%;border:1px solid #eee"/></div>
        <div style="flex:1"><div style="font:12px monospace;color:#777">React (clone)</div><img src="${r.react.rel}" style="width:100%;border:1px solid #eee"/></div>
      </div>
      <div style="font:13px system-ui;margin-top:8px">${diffHtml(r)}</div>
    </section>`).join('');
  fs.writeFileSync(path.join(__dirname, 'visual-parity.html'),
    `<!doctype html><meta charset=utf8><title>Visual parity</title><body style="font-family:system-ui;background:#f4f6f9;max-width:1500px;margin:0 auto;padding:16px"><h2>SendQ visual parity — ${results.length} pages</h2>${rows}`);

  console.log('\nDone.');
  console.log('  Report : tools/visual-parity-report.md');
  console.log('  Visual : tools/visual-parity.html (open in a browser)');
  const flagged = results.filter((r) => r.total > 0 || r.phpLoginRedirect);
  console.log(`  Pages with diffs: ${flagged.length}/${results.length}`);
  process.exit(0);
})().catch((e) => { console.error('PARITY FAILED:', e.message); process.exit(1); });
