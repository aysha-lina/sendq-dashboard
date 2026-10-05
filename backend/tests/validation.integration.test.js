// Integration tests for the S5/S6 input-validation hardening.
//
// These mount the REAL route handlers / routers on a bare Express app and drive
// them with Supertest. They run WITHOUT a database: every assertion targets the
// validation layer, which returns 422 *before* any Prisma query executes. For
// well-formed input we only assert that validation did NOT reject (status !== 422)
// — the request then falls through to Prisma and fails for lack of a DB, which is
// irrelevant to what these tests cover.

const { test } = require('node:test');
const assert = require('node:assert');
const express = require('express');
const request = require('supertest');

const { wrapHandlers: w } = require('../src/utils/route-async');
const subscriberController = require('../src/modules/subscribers/subscriber.controller');
const legacyListController = require('../src/modules/legacy/list.controller');
const billingRouter = require('../src/modules/billing/billing.routes');

// ─── S6: authenticated subscriber update ────────────────────────────────────────
function subscriberApp() {
  const app = express();
  app.use(express.json());
  // Stand in for the auth middleware so the validators run with a tenant context.
  app.use((req, _res, next) => { req.customer = { id: 1 }; next(); });
  app.put('/subscribers/:uid', ...w(subscriberController.update));
  return app;
}

test('S6 subscriber update: rejects an invalid status with 422', async () => {
  const res = await request(subscriberApp()).put('/subscribers/abc').send({ status: 'pwned' });
  assert.strictEqual(res.status, 422);
  assert.ok(res.body.errors.some((e) => e.path === 'status'), 'status error expected');
});

test('S6 subscriber update: rejects a malformed email with 422', async () => {
  const res = await request(subscriberApp()).put('/subscribers/abc').send({ email: 'not-an-email' });
  assert.strictEqual(res.status, 422);
  assert.ok(res.body.errors.some((e) => e.path === 'email'), 'email error expected');
});

test('S6 subscriber update: rejects an over-long first_name with 422', async () => {
  const res = await request(subscriberApp()).put('/subscribers/abc').send({ first_name: 'x'.repeat(300) });
  assert.strictEqual(res.status, 422);
});

test('S6 subscriber update: a well-formed body passes validation (not 422)', async () => {
  const res = await request(subscriberApp())
    .put('/subscribers/abc')
    .send({ status: 'unsubscribed', email: 'ok@x.com', first_name: 'Ada' });
  assert.notStrictEqual(res.status, 422); // proceeds past validation (then 404/500 w/o DB)
});

// ─── S5: public (unauthenticated) profile update ────────────────────────────────
function publicProfileApp() {
  const app = express();
  app.use(express.json());
  app.post('/public/profile/:subscriberUid', ...w(legacyListController.updatePublicProfile));
  return app;
}

test('S5 public profile: rejects an over-long last_name with 422', async () => {
  const res = await request(publicProfileApp()).post('/public/profile/u1').send({ last_name: 'y'.repeat(300) });
  assert.strictEqual(res.status, 422);
});

test('S5 public profile: rejects a non-object fields payload with 422', async () => {
  const res = await request(publicProfileApp()).post('/public/profile/u1').send({ fields: 'oops' });
  assert.strictEqual(res.status, 422);
  assert.ok(res.body.errors.some((e) => e.path === 'fields'), 'fields error expected');
});

test('S5 public profile: a well-formed body passes validation (not 422)', async () => {
  const res = await request(publicProfileApp())
    .post('/public/profile/u1')
    .send({ first_name: 'Ada', fields: { COMPANY: 'Acme' } });
  assert.notStrictEqual(res.status, 422);
});

// ─── S6: billing checkout plan_id ───────────────────────────────────────────────
function billingApp() {
  const app = express();
  app.use(express.json());
  app.use('/billing', billingRouter);
  return app;
}

for (const path of ['/billing/checkout', '/billing/paypal/checkout', '/billing/paymob/checkout', '/billing/offline/checkout']) {
  test(`S6 billing ${path}: rejects a missing plan_id with 422`, async () => {
    const res = await request(billingApp()).post(path).send({});
    assert.strictEqual(res.status, 422);
  });

  test(`S6 billing ${path}: rejects a non-integer plan_id with 422`, async () => {
    const res = await request(billingApp()).post(path).send({ plan_id: 'abc' });
    assert.strictEqual(res.status, 422);
  });
}

test('S6 billing checkout: an integer plan_id passes validation (not 422)', async () => {
  const res = await request(billingApp()).post('/billing/checkout').send({ plan_id: 1 });
  assert.notStrictEqual(res.status, 422); // proceeds to controller (then errors w/o DB)
});
