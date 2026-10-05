#!/usr/bin/env node
 
/**
 * Parity checker — deterministic verification of routes & connections.
 *
 *   node tools/parity-check.js
 *
 * Reports, with zero guessing:
 *   1. React navigations (navigate()/<Link to>/createPath/editPath) that point to a
 *      route NOT defined in App.jsx        → dead-end / 404 reroutes
 *   2. Frontend API calls (services.js) that hit NO backend Express route
 *                                          → broken connections
 *   3. Backend routes that no frontend ever calls   → orphan endpoints (info)
 *   4. PHP (Laravel) route inventory + heuristic coverage vs React   → missing pages
 *
 * Writes a markdown report to tools/parity-report.md and prints a summary.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FE = path.join(ROOT, 'frontend', 'src');
const BE = path.join(ROOT, 'backend', 'src');
const PHP_WEB = path.join(ROOT, '.source', 'SendQ-Dash', 'SendQ---APP-dev', 'routes', 'web.php');

// ── helpers ──────────────────────────────────────────────────────────────────
const walk = (dir, exts) => {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist') continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) out.push(...walk(p, exts));
    else if (exts.some((e) => name.endsWith(e))) out.push(p);
  }
  return out;
};
const read = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } };
const rel = (f) => path.relative(ROOT, f).replace(/\\/g, '/');

// Turn a template literal path into a testable concrete path: ${x} -> 1
const concrete = (p) => p.replace(/\$\{[^}]*\}/g, '1').split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
// Build a RegExp from a route pattern: :param (and :param(...) constraints) -> [^/]+
const routeRegex = (pattern) => {
  const cleaned = pattern.replace(/\/+$/, '') || '/';
  const body = cleaned.split('/').map((seg) => {
    if (seg.startsWith(':') || seg.startsWith('{')) return '[^/]+';
    if (seg === '*') return '.*';
    return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }).join('/');
  return new RegExp(`^${body}$`);
};

// ── 1. React routes (App.jsx) ─────────────────────────────────────────────────
const appJsx = read(path.join(FE, 'App.jsx'));
const reactRoutes = [...appJsx.matchAll(/<Route\s+[^>]*?path=(?:"([^"]+)"|'([^']+)'|\{`([^`]+)`\})/g)]
  .map((m) => m[1] || m[2] || m[3]).filter((p) => p && p !== '*' && !p.includes('*'));
const reactRouteRx = reactRoutes.map(routeRegex);
const isKnownRoute = (p) => reactRouteRx.some((rx) => rx.test(p));

// ── 2. React navigations ──────────────────────────────────────────────────────
const navPatterns = [
  /\bnavigate\(\s*(?:"([^"]+)"|'([^']+)'|`([^`]+)`)/g,
  /\bto=(?:"([^"]+)"|'([^']+)'|\{\s*`([^`]+)`\s*\}|\{\s*'([^']+)'\s*\})/g,
  /\b(?:createPath|editPath)\s*[:=]\s*(?:\([^)]*\)\s*=>\s*)?(?:"([^"]+)"|'([^']+)'|`([^`]+)`)/g,
];
const navs = new Map(); // concretePath -> [files]
for (const file of walk(FE, ['.jsx', '.js'])) {
  if (file.endsWith('App.jsx')) continue;
  const src = read(file);
  for (const re of navPatterns) {
    for (const m of src.matchAll(re)) {
      const raw = m[1] || m[2] || m[3] || m[4];
      if (!raw || !raw.startsWith('/')) continue; // only absolute in-app paths
      if (/^\/(api|track|uploads)\b/.test(raw)) continue; // not router routes
      if (raw.includes('}${') || /\$\{[^}]*(suffix|path|rest|url|to|tab)\b/i.test(raw)) continue; // unresolvable dynamic suffix
      const c = concrete(raw);
      if (!navs.has(c)) navs.set(c, { raw, files: new Set() });
      navs.get(c).files.add(rel(file));
    }
  }
}
const deadNavs = [...navs.entries()].filter(([c]) => !isKnownRoute(c));

// ── 3. Frontend API calls (services.js + any http.METHOD usage) ────────────────
const METHODS = ['get', 'post', 'put', 'delete', 'patch'];
const apiCalls = new Map(); // "METHOD path" -> {raw, files}
const httpCallRe = new RegExp(`\\b(?:http|api)\\.(${METHODS.join('|')})\\(\\s*(?:"([^"]+)"|'([^']+)'|\`([^\`]+)\`)`, 'g');
const normPat = (p) => (p.replace(/\$\{[^}]*\}/g, ':p').replace(/\/+$/, '') || '/');
for (const file of walk(FE, ['.js', '.jsx'])) {
  const src = read(file);
  for (const m of src.matchAll(httpCallRe)) {
    const method = m[1].toUpperCase();
    const raw = m[2] || m[3] || m[4];
    if (!raw) continue;
    const full = '/api' + (raw.startsWith('/') ? raw : '/' + raw); // axios baseURL = /api
    const key = `${method} ${normPat(full)}`;
    if (!apiCalls.has(key)) apiCalls.set(key, { raw: `${method} ${full}`, files: new Set() });
    apiCalls.get(key).files.add(rel(file));
  }
}
// Two route patterns "overlap" if every segment pair is compatible (equal, or either is a
// wildcard). Build-time-constant segments like store `${name}` thus correctly match literal routes.
const segOk = (a, b) => {
  const w = (s) => s.startsWith(':') || s.startsWith('{') || s === '*';
  return w(a) || w(b) || a === b;
};
const overlap = (pa, pb) => {
  const A = (pa.replace(/\/+$/, '') || '/').split('/');
  const B = (pb.replace(/\/+$/, '') || '/').split('/');
  return A.length === B.length && A.every((s, i) => segOk(s, B[i]));
};

// ── 4. Backend Express routes ──────────────────────────────────────────────────
const appBe = read(path.join(BE, 'bootstrap', 'app.js'));
// var -> required file
const varFile = {};
for (const m of appBe.matchAll(/const\s+(\w+)\s*=\s*require\(\s*'([^']+routes)'\s*\)/g)) {
  varFile[m[1]] = path.resolve(BE, 'bootstrap', m[2]) + '.js';
}
// mounts: app.use('PREFIX', <middleware...>, VAR | require('FILE'));  — args may contain ()
const mounts = []; // { prefix, file }
for (const m of appBe.matchAll(/app\.use\(\s*'([^']+)'([^;]*);/g)) {
  const prefix = m[1];
  const args = m[2];
  if (!prefix.startsWith('/api')) continue;
  let file = null;
  const reqM = args.match(/require\(\s*'([^']+)'\s*\)/);
  if (reqM) file = path.resolve(BE, 'bootstrap', reqM[1]) + '.js';
  else {
    const ids = [...args.matchAll(/\b(\w+)\b/g)].map((x) => x[1]).filter((x) => varFile[x]);
    if (ids.length) file = varFile[ids[ids.length - 1]];
  }
  if (file) mounts.push({ prefix, file });
}
const backendRoutes = []; // { method, path }
const stripConstraint = (p) => p.replace(/\(([^)]*)\)/g, ''); // :id(\d+) -> :id
// direct app.METHOD('/api/...')
for (const m of appBe.matchAll(/app\.(get|post|put|delete|patch)\(\s*'([^']+)'/g)) {
  if (m[2].startsWith('/api')) backendRoutes.push({ method: m[1].toUpperCase(), path: stripConstraint(m[2]) });
}
for (const { prefix, file } of mounts) {
  const src = read(file);
  for (const m of src.matchAll(/router\.(get|post|put|delete|patch)\(\s*(?:"([^"]+)"|'([^']+)'|`([^`]+)`)/g)) {
    const sub = (m[2] || m[3] || m[4] || '').replace(/\/+$/, '');
    const full = (prefix + sub).replace(/\/+$/, '') || prefix;
    backendRoutes.push({ method: m[1].toUpperCase(), path: stripConstraint(full) });
  }
}
const backendHas = (method, p) => backendRoutes.some((r) => r.method === method && overlap(p, r.path));

const brokenApi = [];
for (const [key, info] of apiCalls) {
  const [method, p] = key.split(' ');
  if (!backendHas(method, p)) brokenApi.push(info.raw + '  (' + [...info.files].join(', ') + ')');
}

// orphan backend routes (no frontend caller) — informational
const orphanBackend = backendRoutes.filter((r) => ![...apiCalls.keys()].some((k) => {
  const [m, p] = k.split(' ');
  return m === r.method && overlap(p, r.path);
})).filter((r) => !/\/(webhook|inbound|track|public|jobs)\b/.test(r.path)); // exclude server-to-server

// ── 5. PHP route inventory (heuristic coverage) ────────────────────────────────
const php = read(PHP_WEB);
const phpRoutes = [...php.matchAll(/Route::(get|post|put|patch|delete|any|match)\(\s*'([^']+)'/g)]
  .map((m) => ({ method: m[1].toUpperCase(), path: '/' + m[2].replace(/^\/+/, '') }));
const shape = (p) => p.replace(/\{[^}]+\}|:[\w]+/g, '*').replace(/\/+$/, '') || '/';
const reactShapes = new Set(reactRoutes.map(shape));
const phpUncovered = phpRoutes.filter((r) => !reactShapes.has(shape(r.path)));

// ── report ─────────────────────────────────────────────────────────────────────
const lines = [];
const L = (s = '') => lines.push(s);
L('# Parity report');
L('');
L(`Generated by tools/parity-check.js`);
L('');
L(`- React routes defined: **${reactRoutes.length}**`);
L(`- React navigation targets scanned: **${navs.size}**`);
L(`- Frontend API calls: **${apiCalls.size}**`);
L(`- Backend Express routes: **${backendRoutes.length}**`);
L(`- PHP (Laravel) routes inventoried: **${phpRoutes.length}**`);
L('');
L(`## ❌ Dead-end navigations (route not in App.jsx) — ${deadNavs.length}`);
L('Navigations that would 404. Fix the path or add the route.');
L('');
if (!deadNavs.length) L('_None — every in-app navigation resolves to a defined route._');
for (const [, info] of deadNavs.sort((a, b) => a[1].raw.localeCompare(b[1].raw))) {
  L(`- \`${info.raw}\`  — ${[...info.files].join(', ')}`);
}
L('');
L(`## ❌ Broken API connections (no backend route) — ${brokenApi.length}`);
L('Frontend calls with no matching Express route. Fix the path or add the endpoint.');
L('');
if (!brokenApi.length) L('_None — every frontend API call maps to a backend route._');
for (const b of brokenApi.sort()) L(`- \`${b}\``);
L('');
L(`## ⚠️ Orphan backend routes (no frontend caller) — ${orphanBackend.length}`);
L('Informational: endpoints nothing in the SPA calls (may be used elsewhere / dead).');
L('');
for (const r of orphanBackend.sort((a, b) => a.path.localeCompare(b.path))) L(`- \`${r.method} ${r.path}\``);
L('');
L(`## 📋 PHP routes with no matching React route (heuristic) — ${phpUncovered.length} / ${phpRoutes.length}`);
L('Shape-based heuristic (`{id}`/`:id` → `*`); names differ between stacks so treat as a checklist, not gospel.');
L('');
for (const r of phpUncovered.sort((a, b) => a.path.localeCompare(b.path))) L(`- \`${r.method} ${r.path}\``);
L('');

const outFile = path.join(ROOT, 'tools', 'parity-report.md');
fs.writeFileSync(outFile, lines.join('\n'));

// console summary
console.log('Parity check complete →', rel(outFile));
console.log('');
console.log(`  Dead-end navigations : ${deadNavs.length}`);
console.log(`  Broken API calls     : ${brokenApi.length}`);
console.log(`  Orphan backend routes: ${orphanBackend.length}`);
console.log(`  PHP routes uncovered : ${phpUncovered.length} / ${phpRoutes.length} (heuristic)`);
console.log('');
if (deadNavs.length) {
  console.log('Dead-end navigations:');
  for (const [, info] of deadNavs) console.log('  ✗ ' + info.raw + '  (' + [...info.files][0] + ')');
  console.log('');
}
if (brokenApi.length) {
  console.log('Broken API connections:');
  for (const b of brokenApi) console.log('  ✗ ' + b);
}
process.exit(0);
