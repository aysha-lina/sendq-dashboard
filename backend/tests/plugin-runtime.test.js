const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const express = require('express');
const { hooks } = require('../src/modules/plugins/hook-manager');
const { loadPlugin } = require('../src/modules/plugins/plugin-runtime');

const PLUGINS_DIR = path.join(__dirname, '..', 'storage', 'app', 'plugins');
const quietLogger = { log() {}, warn() {}, error() {} };

test('loadPlugin: loads the sample plugin and registers its hooks', () => {
  const res = loadPlugin('sendq/hello', { baseDir: PLUGINS_DIR, logger: quietLogger });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.runtime, true);
  assert.strictEqual(hooks.hasAction('customer.registered'), true);
  assert.strictEqual(hooks.hasFilter('email.message'), true);
});

test('loadPlugin: a missing plugin is recorded as an error, never thrown', () => {
  const res = loadPlugin('nope/missing', { baseDir: PLUGINS_DIR, logger: quietLogger });
  assert.strictEqual(res.ok, false);
  assert.match(res.error, /composer\.json/);
});

test('plugin route is mounted and responds end-to-end', async () => {
  const app = express();
  const router = express.Router();
  app.use('/api/plugins', router);
  loadPlugin('sendq/hello', { router, baseDir: PLUGINS_DIR, logger: quietLogger });

  const server = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/plugins/sendq/hello/ping`);
    const body = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(body.pong, true);
    assert.strictEqual(body.plugin, 'sendq/hello');
  } finally {
    server.close();
  }
});

test('the plugin email.message filter participates in applyFilters', async () => {
  const msg = { subject: 'Hi', html: '<p>x</p>' };
  const out = await hooks.applyFilters('email.message', msg, {});
  assert.strictEqual(out.subject, 'Hi'); // sample plugin filter is a no-op pass-through
});
