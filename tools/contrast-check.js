#!/usr/bin/env node
 
/**
 * Readability scan for BOTH themes. For each theme (light, dark) it visits every
 * route and flags visible text whose WCAG contrast vs its effective background is
 * below 4.5 (normal) / 3.0 (large/bold). Skips icon fonts, SVG/charts, and any
 * element sitting on a background-image/gradient (indeterminate → avoids false
 * positives on charts, badges, auth sliders).
 *
 *   (frontend :5173 + backend :5000 running)
 *   node tools/contrast-check.js            # both themes
 *   THEME=light node tools/contrast-check.js  # one theme
 * Output: tools/contrast-report.md
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const jwt = require(path.join(__dirname, '..', 'backend', 'node_modules', 'jsonwebtoken'));

const ROOT = path.resolve(__dirname, '..');
const FE = path.join(ROOT, 'frontend', 'src');
const BASE = process.env.BASE || 'http://localhost:5173';
const API = process.env.API || 'http://127.0.0.1:5000';
const THEMES = process.env.THEME ? [process.env.THEME] : ['light', 'dark'];

const env = fs.readFileSync(path.join(ROOT, 'backend', '.env'), 'utf8');
const secret = ((env.match(/^JWT_SECRET=(.*)$/m) || [])[1] || '').trim();
const token = jwt.sign({ id: 1 }, secret, { expiresIn: '1d' });

const appJsx = fs.readFileSync(path.join(FE, 'App.jsx'), 'utf8');
const routes = [...appJsx.matchAll(/<Route\s+[^>]*?path="([^"]+)"/g)].map((m) => m[1]).filter((p) => p && !p.includes('*'));

const apiGet = async (p) => { try { const r = await fetch(`${API}${p}`, { headers: { Authorization: `Bearer ${token}` } }); return await r.json(); } catch { return null; } };

const SCAN = () => {
  const lum = (rgb) => { const a = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2]; };
  const parse = (s) => { const m = s && s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map((x) => parseFloat(x)); return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] }; };
  // Effective bg: first opaque-enough ancestor backgroundColor. Returns null if any
  // ancestor paints a background-image/gradient (can't judge contrast) → skip.
  const effBg = (el) => {
    let n = el;
    while (n && n.nodeType === 1) {
      const st = getComputedStyle(n);
      if (st.backgroundImage && st.backgroundImage !== 'none') return null;
      const c = parse(st.backgroundColor);
      if (c && c.a >= 0.5) return [c.r, c.g, c.b];
      n = n.parentElement;
    }
    return null; // no determinate bg
  };
  const ratio = (fg, bg) => { const L1 = lum(fg) + 0.05; const L2 = lum(bg) + 0.05; return L1 > L2 ? L1 / L2 : L2 / L1; };
  const out = []; const seen = new Set();
  document.querySelectorAll('main *, .imp-modal *, [role="dialog"] *').forEach((el) => {
    if (el.closest('svg') || el.closest('[class*="recharts"]') || el.closest('canvas')) return;
    const cs = getComputedStyle(el);
    if (/Material Symbols|Material Icons/i.test(cs.fontFamily)) return; // icon ligatures
    const txt = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(' ').trim();
    if (!txt || txt.length < 2) return;
    if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) < 0.2) return;
    const rect = el.getBoundingClientRect();
    if (rect.width < 3 || rect.height < 3 || rect.bottom < 0 || rect.width * rect.height < 40) return;
    const fg = parse(cs.color); if (!fg || fg.a < 0.4) return;
    const bg = effBg(el); if (!bg) return; // indeterminate (gradient/image) — skip
    const r = ratio([fg.r, fg.g, fg.b], bg);
    const size = parseFloat(cs.fontSize); const bold = parseInt(cs.fontWeight, 10) >= 600;
    const large = size >= 24 || (size >= 18.66 && bold);
    if (r >= (large ? 3 : 4.5)) return;
    const key = txt.slice(0, 36) + '|' + cs.color; if (seen.has(key)) return; seen.add(key);
    out.push({ text: txt.slice(0, 64), color: cs.color, bg: `rgb(${bg.join(',')})`, ratio: Math.round(r * 100) / 100, size: Math.round(size) });
  });
  return out.sort((a, b) => a.ratio - b.ratio).slice(0, 40);
};

(async () => {
  const me = await apiGet('/api/auth/me');
  const user = (me && (me.user || me)) || { id: 1, email: 'qa@local' };
  const SOURCES = [[/^\/campaigns\//, '/api/v1/campaigns'], [/^\/lists\//, '/api/v1/lists'], [/^\/sending\/domains\//, '/api/v1/sending-domains'], [/^\/templates\//, '/api/v1/templates'], [/^\/admin\/customers\//, '/api/admin/customers']];
  const sampleByEp = {};
  for (const ep of [...new Set(SOURCES.map((s) => s[1]))]) { const d = await apiGet(ep + '?per_page=1'); const f = d && (d.data?.[0] || (Array.isArray(d) ? d[0] : null)); if (f) sampleByEp[ep] = { id: f.id, uid: f.uid }; }
  const resolve = (p) => {
    if (!p.includes(':')) return p;
    const src = SOURCES.find(([re]) => re.test(p)); const s = src ? sampleByEp[src[1]] : null;
    let out = p; if (s) { if (s.uid != null) out = out.replace(/:uid/g, String(s.uid)); if (s.id != null) out = out.replace(/:id/g, String(s.id)); }
    out = out.replace(/:code/g, 'en').replace(/:locale/g, 'en').replace(/:section/g, 'customers').replace(/:type/g, 'opens');
    return out.includes(':') ? null : out;
  };

  let browser = null;
  for (const ch of ['msedge', 'chrome', null]) { try { browser = await chromium.launch(ch ? { channel: ch } : {}); break; } catch { /* next */ } }
  if (!browser) throw new Error('No browser (Edge/Chrome).');

  const byTheme = {};
  for (const theme of THEMES) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript(([t, u, th]) => {
      localStorage.setItem('sendq_token', t); localStorage.setItem('sendq_user', u); localStorage.setItem('sendq_theme', th);
    }, [token, JSON.stringify(user), theme]);
    const page = await ctx.newPage();
    const results = [];
    for (const route of routes) {
      const url = resolve(route); if (url === null) continue;
      try { await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 25000 }); } catch { /* capture anyway */ }
      await page.waitForTimeout(550);
      let hits = [];
      try { hits = await page.evaluate(SCAN); } catch { hits = []; }
      if (hits.length) results.push({ route, hits });
      process.stdout.write(hits.length ? String(Math.min(hits.length, 9)) : '.');
    }
    await ctx.close();
    byTheme[theme] = results;
    console.log(` [${theme}: ${results.length} pages]`);
  }
  await browser.close();

  const md = ['# Readability scan (light + dark)', '', `Routes scanned per theme. Threshold WCAG 4.5 / 3.0 (large). Skips icons, SVG/charts, and text on gradients/images.`, ''];
  for (const theme of THEMES) {
    const results = byTheme[theme];
    const total = results.reduce((n, r) => n + r.hits.length, 0);
    md.push(`## ${theme.toUpperCase()} — ${results.length} pages, ${total} flagged`, '');
    for (const r of results.sort((a, b) => b.hits.length - a.hits.length)) {
      md.push(`### \`${r.route}\` — ${r.hits.length}`);
      for (const h of r.hits) md.push(`- **${h.ratio}** · ${h.size}px · ${h.color} on ${h.bg} — "${h.text.replace(/\|/g, ' ')}"`);
      md.push('');
    }
  }
  fs.writeFileSync(path.join(__dirname, 'contrast-report.md'), md.join('\n'));
  console.log('\n→ tools/contrast-report.md');
  for (const theme of THEMES) console.log(`  ${theme}: ${byTheme[theme].reduce((n, r) => n + r.hits.length, 0)} flagged across ${byTheme[theme].length} pages`);
  process.exit(0);
})().catch((e) => { console.error('SCAN FAILED:', e.message); process.exit(1); });
