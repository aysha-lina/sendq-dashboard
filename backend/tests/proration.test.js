const { test } = require('node:test');
const assert = require('node:assert');
const { computeProration } = require('../src/modules/billing/billing.controller');

// Fixed clock helpers
const day = 24 * 60 * 60 * 1000;
const start = new Date('2026-01-01T00:00:00Z');
const end = new Date('2026-01-31T00:00:00Z'); // 30-day period
const mid = new Date('2026-01-16T00:00:00Z'); // ~50% remaining (14/30 days left)

test('upgrade mid-cycle: charges the prorated difference (dueNow > 0)', () => {
  const p = computeProration({ currentPlan: { price: 10 }, newPlan: { price: 30 }, periodStart: start, periodEnd: end, now: mid });
  // ~50% of period left → oldCredit ≈ 5, newProratedCost ≈ 15, dueNow ≈ 10
  assert.ok(p.fraction > 0.45 && p.fraction < 0.55, `fraction=${p.fraction}`);
  assert.ok(p.dueNow > 0, `dueNow=${p.dueNow}`);
  assert.strictEqual(p.dueNow, p.newProratedCost - p.oldCredit > 0 ? Math.round((p.newProratedCost - p.oldCredit) * 100) / 100 : 0);
  assert.strictEqual(p.leftoverCredit, 0);
});

test('downgrade mid-cycle: nothing due, leftover credit (dueNow == 0)', () => {
  const p = computeProration({ currentPlan: { price: 30 }, newPlan: { price: 10 }, periodStart: start, periodEnd: end, now: mid });
  assert.strictEqual(p.dueNow, 0);
  assert.ok(p.leftoverCredit > 0, `leftoverCredit=${p.leftoverCredit}`);
});

test('no usable period dates → assume full period: full credit, charge the difference', () => {
  const p = computeProration({ currentPlan: { price: 10 }, newPlan: { price: 30 } });
  assert.strictEqual(p.fraction, 1);
  assert.strictEqual(p.oldCredit, 10);
  assert.strictEqual(p.newProratedCost, 30);
  assert.strictEqual(p.dueNow, 20); // 30 new − 10 full credit
});

test('period already elapsed → zero credit and zero prorated cost', () => {
  const after = new Date('2026-02-15T00:00:00Z');
  const p = computeProration({ currentPlan: { price: 30 }, newPlan: { price: 30 }, periodStart: start, periodEnd: end, now: after });
  assert.strictEqual(p.fraction, 0);
  assert.strictEqual(p.oldCredit, 0);
  assert.strictEqual(p.newProratedCost, 0);
  assert.strictEqual(p.dueNow, 0);
});

test('exact-start (full period remaining) → full credit and full new cost', () => {
  const p = computeProration({ currentPlan: { price: 20 }, newPlan: { price: 50 }, periodStart: start, periodEnd: end, now: start });
  assert.strictEqual(p.fraction, 1);
  assert.strictEqual(p.oldCredit, 20);
  assert.strictEqual(p.newProratedCost, 50);
  assert.strictEqual(p.dueNow, 30);
});

test('money values are rounded to 2 decimals', () => {
  const oddEnd = new Date(start.getTime() + 7 * day);
  const oddNow = new Date(start.getTime() + 3 * day); // 4/7 remaining
  const p = computeProration({ currentPlan: { price: 9.99 }, newPlan: { price: 19.99 }, periodStart: start, periodEnd: oddEnd, now: oddNow });
  for (const v of [p.oldCredit, p.newProratedCost, p.dueNow]) {
    assert.strictEqual(v, Math.round(v * 100) / 100);
  }
});
