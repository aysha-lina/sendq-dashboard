const { test } = require('node:test');
const assert = require('node:assert');
const { descriptorFor, isApi, maskSecrets } = require('../src/modules/email-engine/api.senders');

test('descriptorFor: elasticemail-api routes to the HTTP API (BUG-10)', () => {
  const d = descriptorFor({ type: 'elasticemail-api', api_key: 'EE_KEY' });
  assert.strictEqual(d.api, 'elasticemail');
  assert.strictEqual(d.apiKey, 'EE_KEY');
  assert.strictEqual(isApi(d), true);
});

test('descriptorFor: smtp stays SMTP (regression)', () => {
  const d = descriptorFor({ type: 'smtp', host: 'mail.x', smtp_username: 'u', smtp_password: 'p', smtp_port: 587 });
  assert.strictEqual(d.type, 'smtp');
  assert.strictEqual(isApi(d), false);
});

test('maskSecrets: blanks secrets and emits *_set flags (BUG-9)', () => {
  const masked = maskSecrets({
    id: 1, name: 'srv', host: 'mail.x',
    smtp_password: 'topsecret', api_key: 'KEY', api_secret_key: '', aws_secret_access_key: 'AWS',
  });
  assert.strictEqual(masked.smtp_password, '');
  assert.strictEqual(masked.api_key, '');
  assert.strictEqual(masked.aws_secret_access_key, '');
  assert.strictEqual(masked.smtp_password_set, true);
  assert.strictEqual(masked.api_key_set, true);
  assert.strictEqual(masked.api_secret_key_set, false); // was empty
  assert.strictEqual(masked.aws_secret_access_key_set, true);
  // non-secret fields untouched
  assert.strictEqual(masked.host, 'mail.x');
  assert.strictEqual(masked.name, 'srv');
});
