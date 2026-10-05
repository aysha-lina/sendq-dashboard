const { test } = require('node:test');
const assert = require('node:assert');
const { hasAbility, hasPermission } = require('../src/modules/auth/rbac');

const superAdmin = { roles: [{ code: 'super_admin' }], permissions: [] };
const reseller = {
  roles: [{ code: 'reseller' }],
  permissions: ['customer_read:own', 'customer_delete:own', 'admin_read:no', 'report_open_log:yes', 'campaign.full_access'],
};
const nobody = { roles: [], permissions: [] };

test('hasAbility: super_admin passes everything', () => {
  assert.strictEqual(hasAbility(superAdmin, 'admin_delete'), true);
  assert.strictEqual(hasAbility(superAdmin, 'anything_at_all'), true);
});

test('hasAbility: grants on any non-"no" scope (all/own/yes)', () => {
  assert.strictEqual(hasAbility(reseller, 'customer_read'), true);  // :own
  assert.strictEqual(hasAbility(reseller, 'customer_delete'), true); // :own
  assert.strictEqual(hasAbility(reseller, 'report_open_log'), true); // :yes
});

test('hasAbility: denies on "no" scope or missing ability', () => {
  assert.strictEqual(hasAbility(reseller, 'admin_read'), false);   // :no
  assert.strictEqual(hasAbility(reseller, 'plan_delete'), false);  // absent
  assert.strictEqual(hasAbility(nobody, 'customer_read'), false);
});

test('hasPermission: still matches plain ".full_access" strings (scope format fix is additive)', () => {
  assert.strictEqual(hasPermission(reseller, 'campaign.full_access'), true);
  assert.strictEqual(hasPermission(reseller, 'list.full_access'), false);
});

test('hasPermission: scope-aware for ability:scope (previously broken exact-match)', () => {
  // Before the fix, hasPermission('customer_read') failed because the stored value is
  // "customer_read:own". It now resolves via the ability matcher.
  assert.strictEqual(hasPermission(reseller, 'customer_read'), true);
  assert.strictEqual(hasPermission(reseller, 'admin_read'), false);
});
