const { test } = require('node:test');
const assert = require('node:assert');
const { normalizeAbConfig, winnerDelayMs, splitRecipients, pickWinner, variantCampaign } = require('../src/modules/campaigns/ab-test.service');

test('normalizeAbConfig: requires 2+ subject-bearing variants, clamps inputs', () => {
  assert.strictEqual(normalizeAbConfig(null), null);
  assert.strictEqual(normalizeAbConfig({ enabled: false, variants: [{ subject: 'a' }, { subject: 'b' }] }), null);
  assert.strictEqual(normalizeAbConfig({ variants: [{ subject: 'only one' }] }), null);
  const cfg = normalizeAbConfig({
    variants: [{ subject: 'A subj' }, { subject: 'B subj', from_name: 'Bob' }, { subject: '' }],
    test_percent: 200, winner_metric: 'clicks', winner_wait_hours: 999,
  });
  assert.strictEqual(cfg.variants.length, 2); // the empty-subject variant is dropped
  assert.deepStrictEqual(cfg.variants.map((v) => v.key), ['A', 'B']);
  assert.strictEqual(cfg.test_percent, 90); // clamped
  assert.strictEqual(cfg.winner_metric, 'clicks');
  assert.strictEqual(cfg.winner_wait_hours, 168); // clamped
});

test('winnerDelayMs: hours → ms, with a test-only ms override', () => {
  assert.strictEqual(winnerDelayMs({ winner_wait_hours: 2 }), 2 * 3600 * 1000);
  assert.strictEqual(winnerDelayMs({ winner_wait_hours: 4, winner_wait_ms: 3000 }), 3000);
});

test('splitRecipients: tests a % evenly across variants, rest is holdout', () => {
  const ids = Array.from({ length: 10 }, (_, i) => i + 1);
  const { cohorts, holdout, testTotal } = splitRecipients(ids, { testPercent: 40, variantKeys: ['A', 'B'] });
  assert.strictEqual(testTotal, 4);
  assert.strictEqual(cohorts.A.length, 2);
  assert.strictEqual(cohorts.B.length, 2);
  assert.strictEqual(holdout.length, 6);
  // deterministic round-robin by input order
  assert.deepStrictEqual(cohorts.A, [1, 3]);
  assert.deepStrictEqual(cohorts.B, [2, 4]);
  assert.deepStrictEqual(holdout, [5, 6, 7, 8, 9, 10]);
});

test('splitRecipients: guarantees at least one per variant on a tiny audience', () => {
  const { cohorts, holdout, testTotal } = splitRecipients([1, 2, 3], { testPercent: 1, variantKeys: ['A', 'B'] });
  assert.strictEqual(testTotal, 2); // bumped from 0 to cover both variants
  assert.strictEqual(cohorts.A.length, 1);
  assert.strictEqual(cohorts.B.length, 1);
  assert.strictEqual(holdout.length, 1);
});

test('pickWinner: highest rate wins, ties break on count then key', () => {
  assert.strictEqual(pickWinner({ A: { sent: 10, opens: 6 }, B: { sent: 10, opens: 3 } }, 'opens'), 'A');
  assert.strictEqual(pickWinner({ A: { sent: 10, clicks: 1 }, B: { sent: 10, clicks: 8 } }, 'clicks'), 'B');
  // equal rate (both 50%), B has more raw opens → B
  assert.strictEqual(pickWinner({ A: { sent: 2, opens: 1 }, B: { sent: 10, opens: 5 } }, 'opens'), 'B');
  // fully tied → first key
  assert.strictEqual(pickWinner({ A: { sent: 10, opens: 5 }, B: { sent: 10, opens: 5 } }, 'opens'), 'A');
});

test('variantCampaign: overrides subject/from_name/html, keeps the rest (incl. id)', () => {
  const base = { id: 7, subject: 'base', from_name: 'Base', html: '<p>base</p>', track_open: true };
  const vc = variantCampaign(base, { key: 'B', subject: 'B subject', from_name: 'Bee' });
  assert.strictEqual(vc.id, 7);
  assert.strictEqual(vc.subject, 'B subject');
  assert.strictEqual(vc.from_name, 'Bee');
  assert.strictEqual(vc.html, '<p>base</p>'); // not overridden → base html
  assert.strictEqual(vc.track_open, true);
});
