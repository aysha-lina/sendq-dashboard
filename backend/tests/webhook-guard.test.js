const { test, afterEach } = require('node:test');
const assert = require('node:assert');
const { tokenOk } = require('../src/modules/webhooks/inbound.controller');

const orig = { env: process.env.NODE_ENV, tok: process.env.INBOUND_WEBHOOK_TOKEN };
afterEach(() => {
  process.env.NODE_ENV = orig.env;
  if (orig.tok === undefined) delete process.env.INBOUND_WEBHOOK_TOKEN;
  else process.env.INBOUND_WEBHOOK_TOKEN = orig.tok;
});

const req = (token, header) => ({ query: token ? { token } : {}, headers: header ? { 'x-webhook-token': header } : {} });

test('inbound webhook FAILS CLOSED in production when no token configured (BUG-2)', () => {
  process.env.NODE_ENV = 'production';
  delete process.env.INBOUND_WEBHOOK_TOKEN;
  assert.strictEqual(tokenOk(req()), false);
});

test('inbound webhook allows unconfigured in development', () => {
  process.env.NODE_ENV = 'development';
  delete process.env.INBOUND_WEBHOOK_TOKEN;
  assert.strictEqual(tokenOk(req()), true);
});

test('inbound webhook accepts the correct token (query or header)', () => {
  process.env.NODE_ENV = 'production';
  process.env.INBOUND_WEBHOOK_TOKEN = 'secret123';
  assert.strictEqual(tokenOk(req('secret123')), true);
  assert.strictEqual(tokenOk(req(null, 'secret123')), true);
});

test('inbound webhook rejects a wrong token', () => {
  process.env.NODE_ENV = 'production';
  process.env.INBOUND_WEBHOOK_TOKEN = 'secret123';
  assert.strictEqual(tokenOk(req('wrong')), false);
});
