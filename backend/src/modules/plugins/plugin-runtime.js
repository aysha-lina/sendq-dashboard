const fs = require('fs');
const path = require('path');
const express = require('express');
const { hooks } = require('./hook-manager');
const prisma = require('../../config/database.config');
const { PLUGINS_DIR } = require('../admin/plugin-upload.middleware');

const PLG_TABLE = `${process.env.DB_PREFIX || 'sendq'}_plugins`;

const loaded = new Map(); // name → { manifest, runtime, ok, error }
const errors = new Map(); // name → message

const readManifest = (dir) => {
  const f = path.join(dir, 'composer.json');
  if (!fs.existsSync(f)) return null;
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; }
};

// A Node plugin declares its JS entry via composer.json `extra.node` (or ships index.js /
// node/index.js). Plugins with no JS entry are "registry-only" (installed, nothing to run).
const entryFile = (dir, manifest) => {
  const candidates = [manifest?.extra?.node, manifest?.node, 'index.js', path.join('node', 'index.js')].filter(Boolean);
  for (const c of candidates) {
    const p = path.join(dir, c);
    if (fs.existsSync(p)) return p;
  }
  return null;
};

// Load a single plugin by "vendor/name". Defensive: a broken plugin is recorded, never thrown.
const loadPlugin = (name, { router, baseDir = PLUGINS_DIR, logger = console } = {}) => {
  const dir = path.join(baseDir, name);
  const manifest = readManifest(dir);
  if (!manifest) { errors.set(name, 'No composer.json found.'); loaded.set(name, { ok: false, error: 'No composer.json found.' }); return { ok: false, error: 'No composer.json found.' }; }

  const entry = entryFile(dir, manifest);
  if (!entry) { loaded.set(name, { manifest, runtime: false, ok: true }); return { ok: true, runtime: false }; }

  try {
    delete require.cache[require.resolve(entry)];
    const register = require(entry);
    if (typeof register !== 'function') throw new Error('Plugin entry must export a function (api) => {}.');

    const sub = router ? express.Router() : null;
    register({
      hooks,
      router: sub,
      prisma, // read access to the app's data
      manifest,
      logger: {
        info: (...a) => logger.log(`[plugin:${name}]`, ...a),
        warn: (...a) => logger.warn(`[plugin:${name}]`, ...a),
        error: (...a) => logger.error(`[plugin:${name}]`, ...a),
      },
    });
    if (router && sub) router.use(`/${name}`, sub); // → /api/plugins/{vendor}/{name}/...

    loaded.set(name, { manifest, runtime: true, ok: true });
    errors.delete(name);
    return { ok: true, runtime: true };
  } catch (err) {
    errors.set(name, err.message);
    loaded.set(name, { manifest, ok: false, error: err.message });
    return { ok: false, error: err.message };
  }
};

// Load every ACTIVE plugin recorded in the registry. Called once at startup.
const loadActivePlugins = async ({ router } = {}) => {
  let rows = [];
  try { rows = await prisma.$queryRawUnsafe(`SELECT name FROM ${PLG_TABLE} WHERE status = 'active'`); } catch { rows = []; }
  let ok = 0;
  for (const r of rows) { if (loadPlugin(r.name, { router }).ok) ok += 1; }
  if (rows.length) console.log(`[plugins] Loaded ${ok}/${rows.length} active plugin(s).`);
  return { total: rows.length, loaded: ok, errors: Object.fromEntries(errors) };
};

const getLoaded = () => Array.from(loaded.entries()).map(([name, v]) => ({ name, ...v }));
const getErrors = () => Object.fromEntries(errors);

module.exports = { loadPlugin, loadActivePlugins, getLoaded, getErrors, PLG_TABLE };
