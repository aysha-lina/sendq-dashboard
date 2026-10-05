#!/usr/bin/env node
 
/**
 * Interactive login e2e — drives a real browser through the login form against the
 * running dev stack (frontend :5173 proxying /api → backend :5000) and asserts a
 * successful auth flow plus a wrong-password rejection. Complements tools/crawl.js
 * (which bypasses the form by injecting a JWT); this exercises the form itself.
 *
 *   E2E_EMAIL=user@x.com E2E_PASSWORD=secret node tools/e2e-login.js
 */
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://localhost:5173';
const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error('E2E_EMAIL and E2E_PASSWORD are required');
  process.exit(2);
}

const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${detail ? ` (${detail})` : ''}`);
};

// Bundled chromium downloads stall in this sandbox — prefer the system Edge/Chrome
// channel (the same fallback tools/crawl.js uses), falling back to bundled chromium.
async function launchBrowser() {
  for (const channel of ['msedge', 'chrome']) {
    try { return await chromium.launch({ channel }); } catch { /* try next */ }
  }
  return chromium.launch();
}

(async () => {
  const browser = await launchBrowser();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  // ── 1. Wrong password is rejected and keeps the user on /login ──
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', 'definitely-wrong-password');
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/auth/login')).catch(() => null),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForTimeout(800);
  const stayedOnLogin = /\/login/.test(page.url());
  const noToken = !(await page.evaluate(() => localStorage.getItem('sendq_token')));
  check('wrong password is rejected (stays on /login, no token issued)', stayedOnLogin && noToken,
    `url=${new URL(page.url()).pathname}`);

  // ── 2. Correct credentials authenticate and leave /login ──
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', PASSWORD);
  const loginResp = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/auth/login')),
    page.click('button[type="submit"]'),
  ]).then(([r]) => r);
  check('POST /api/auth/login returns 200', loginResp.status() === 200, `status=${loginResp.status()}`);

  await page.waitForURL((url) => !/\/login/.test(url.toString()), { timeout: 8000 }).catch(() => null);
  const leftLogin = !/\/login/.test(page.url());
  check('redirected away from /login after auth', leftLogin, `now at ${new URL(page.url()).pathname}`);

  const hasToken = await page.evaluate(() => !!localStorage.getItem('sendq_token'));
  check('auth token persisted in the browser', hasToken);

  // ── 3. An authenticated page renders without bouncing back to /login ──
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  check('authenticated /dashboard renders (not bounced to /login)', !/\/login/.test(page.url()),
    `at ${new URL(page.url()).pathname}`);

  await browser.close();

  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} login e2e checks passed.`);
  process.exit(passed === results.length ? 0 : 1);
})().catch((e) => { console.error('E2E ERROR', e.message); process.exit(1); });
