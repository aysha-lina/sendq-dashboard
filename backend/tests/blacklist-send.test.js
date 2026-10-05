const { test } = require('node:test');
const assert = require('node:assert');
const { isSuppressed } = require('../src/modules/campaigns/campaign.sender');

test('isSuppressed: blacklisted recipients are matched (BUG-14)', () => {
  const set = new Set(['bad@x.com', 'spam@y.com']);
  assert.strictEqual(isSuppressed('bad@x.com', set), true);
  assert.strictEqual(isSuppressed('spam@y.com', set), true);
});

test('isSuppressed: case-insensitive + trims whitespace', () => {
  const set = new Set(['bad@x.com']);
  assert.strictEqual(isSuppressed('  BAD@X.COM ', set), true);
});

test('isSuppressed: non-blacklisted / empty addresses pass through', () => {
  const set = new Set(['bad@x.com']);
  assert.strictEqual(isSuppressed('good@x.com', set), false);
  assert.strictEqual(isSuppressed('', set), false);
  assert.strictEqual(isSuppressed(null, set), false);
  assert.strictEqual(isSuppressed(undefined, set), false);
});

test('isSuppressed: empty blacklist suppresses nothing', () => {
  assert.strictEqual(isSuppressed('anyone@x.com', new Set()), false);
});
