const { test } = require('node:test');
const assert = require('node:assert');
const { HookManager } = require('../src/modules/plugins/hook-manager');

test('actions run in priority order and collect results', async () => {
  const h = new HookManager();
  const order = [];
  h.addAction('e', () => { order.push('b'); return 2; }, 20);
  h.addAction('e', () => { order.push('a'); return 1; }, 5);
  const results = await h.doAction('e');
  assert.deepStrictEqual(order, ['a', 'b']);
  assert.deepStrictEqual(results, [1, 2]);
});

test('a throwing action is isolated — others still run', async () => {
  const h = new HookManager();
  let ran = false;
  h.addAction('e', () => { throw new Error('boom'); });
  h.addAction('e', () => { ran = true; });
  await h.doAction('e');
  assert.strictEqual(ran, true);
});

test('filters chain the value through callbacks in order', async () => {
  const h = new HookManager();
  h.addFilter('price', (v) => v + 1);
  h.addFilter('price', (v) => v * 2);
  assert.strictEqual(await h.applyFilters('price', 10), 22); // (10+1)*2
});

test('a throwing filter is skipped; the value is preserved', async () => {
  const h = new HookManager();
  h.addFilter('x', () => { throw new Error('no'); });
  h.addFilter('x', (v) => `${v}!`);
  assert.strictEqual(await h.applyFilters('x', 'hi'), 'hi!');
});

test('unknown hooks: hasAction false, doAction → []', async () => {
  const h = new HookManager();
  assert.strictEqual(h.hasAction('none'), false);
  assert.deepStrictEqual(await h.doAction('none'), []);
  h.addAction('z', () => {});
  assert.strictEqual(h.hasAction('z'), true);
  assert.strictEqual(h.countAction('z'), 1);
});

test('non-function callbacks are ignored', () => {
  const h = new HookManager();
  h.addAction('e', 'not-a-fn');
  assert.strictEqual(h.countAction('e'), 0);
});
