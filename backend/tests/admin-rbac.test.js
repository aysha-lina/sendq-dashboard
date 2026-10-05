const { test } = require('node:test');
const assert = require('node:assert');
const { requiredAbility } = require('../src/modules/admin/admin.rbac');

test('CRUD sections derive ability from method (BUG-1)', () => {
  assert.strictEqual(requiredAbility('GET', '/customers'), 'customer_read');
  assert.strictEqual(requiredAbility('POST', '/customers'), 'customer_create');
  assert.strictEqual(requiredAbility('PUT', '/customers/abc'), 'customer_update');
  assert.strictEqual(requiredAbility('DELETE', '/admins/abc'), 'admin_delete');
  assert.strictEqual(requiredAbility('GET', '/plans'), 'plan_read');
  assert.strictEqual(requiredAbility('GET', '/sending-servers'), 'sending_server_read');
});

test('FIXED sections use a single ability regardless of method', () => {
  assert.strictEqual(requiredAbility('GET', '/settings'), 'setting_general');
  assert.strictEqual(requiredAbility('POST', '/settings'), 'setting_general');
  assert.strictEqual(requiredAbility('GET', '/blacklist'), 'report_blacklist');
  assert.strictEqual(requiredAbility('GET', '/open-log'), 'report_open_log');
  assert.strictEqual(requiredAbility('POST', '/plugins'), 'setting_upgrade_manager');
});

test('admin-groups vs admins are distinct', () => {
  assert.strictEqual(requiredAbility('GET', '/admin-groups'), 'admin_group_read');
  assert.strictEqual(requiredAbility('GET', '/admins'), 'admin_read');
});

test('unmapped routes → null (fall back to super_admin-only)', () => {
  assert.strictEqual(requiredAbility('GET', '/dashboard'), null);
  assert.strictEqual(requiredAbility('GET', '/something-random'), null);
});

test('tolerates the /api/admin prefix', () => {
  assert.strictEqual(requiredAbility('GET', '/api/admin/customers'), 'customer_read');
});
