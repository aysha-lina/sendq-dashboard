const { test } = require('node:test');
const assert = require('node:assert');
const { computeTax } = require('../src/modules/billing/tax.service');

test('computeTax: zero rate is a no-op (total === subtotal)', () => {
  const r = computeTax(100, 0);
  assert.strictEqual(r.tax, 0);
  assert.strictEqual(r.total, 100);
});

test('computeTax: 15% applied correctly', () => {
  const r = computeTax(100, 15);
  assert.strictEqual(r.tax, 15);
  assert.strictEqual(r.total, 115);
});

test('computeTax: rounds tax to cents', () => {
  const r = computeTax(99.99, 15);
  assert.strictEqual(r.tax, 15); // 99.99*0.15 = 14.9985 → 15.00
  assert.strictEqual(r.total, 114.99);
});

test('computeTax: negative/invalid inputs are clamped to 0', () => {
  assert.strictEqual(computeTax(-50, 10).subtotal, 0);
  assert.strictEqual(computeTax(100, -5).total, 100);
  assert.strictEqual(computeTax('abc', 'x').total, 0);
});

test('computeTax: fractional rate', () => {
  const r = computeTax(200, 5.5);
  assert.strictEqual(r.tax, 11);
  assert.strictEqual(r.total, 211);
});
