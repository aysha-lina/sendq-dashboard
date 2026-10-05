const { test } = require('node:test');
const assert = require('node:assert');
const { buildAuthHeaders, buildBody } = require('../src/modules/webhooks/webhook.dispatcher');

test('buildAuthHeaders: bearer', () => {
  assert.deepStrictEqual(buildAuthHeaders({ request_auth_type: 'bearer', request_auth_bearer_token: 'tok' }), { Authorization: 'Bearer tok' });
});

test('buildAuthHeaders: basic', () => {
  const h = buildAuthHeaders({ request_auth_type: 'basic', request_auth_basic_username: 'u', request_auth_basic_password: 'p' });
  assert.strictEqual(h.Authorization, `Basic ${Buffer.from('u:p').toString('base64')}`);
});

test('buildAuthHeaders: custom header + none', () => {
  assert.deepStrictEqual(buildAuthHeaders({ request_auth_type: 'header', request_auth_custom_key: 'X-Key', request_auth_custom_value: 'v' }), { 'X-Key': 'v' });
  assert.deepStrictEqual(buildAuthHeaders({ request_auth_type: 'none' }), {});
});

test('buildBody: defaults to JSON of the payload', () => {
  const { body, contentType } = buildBody({ request_body_type: 'json' }, { event: 'x', a: 1 });
  assert.strictEqual(contentType, 'application/json');
  assert.deepStrictEqual(JSON.parse(body), { event: 'x', a: 1 });
});

test('buildBody: plain text', () => {
  const { body, contentType } = buildBody({ request_body_type: 'plain', request_body_plain: 'hello' }, {});
  assert.strictEqual(contentType, 'text/plain');
  assert.strictEqual(body, 'hello');
});

test('buildBody: form params', () => {
  const { body, contentType } = buildBody({ request_body_type: 'form', request_body_params: '{"a":"1","b":"2"}' }, {});
  assert.strictEqual(contentType, 'application/x-www-form-urlencoded');
  assert.strictEqual(body, 'a=1&b=2');
});
