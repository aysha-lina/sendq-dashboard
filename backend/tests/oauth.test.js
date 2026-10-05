const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
const oauth = require('../src/modules/auth/oauth.service');

test('buildGoogleAuthUrl: correct endpoint + params (pure)', () => {
  const u = new URL(oauth.buildGoogleAuthUrl({ clientId: 'CID' }, 'https://app/cb', 'STATE'));
  assert.strictEqual(u.origin + u.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
  assert.strictEqual(u.searchParams.get('client_id'), 'CID');
  assert.strictEqual(u.searchParams.get('redirect_uri'), 'https://app/cb');
  assert.strictEqual(u.searchParams.get('response_type'), 'code');
  assert.strictEqual(u.searchParams.get('scope'), 'openid email profile');
  assert.strictEqual(u.searchParams.get('state'), 'STATE');
});

test('signState/verifyState: round-trips; rejects tampered/empty (CSRF)', () => {
  const s = oauth.signState();
  assert.strictEqual(oauth.verifyState(s), true);
  assert.strictEqual(oauth.verifyState(`${s}x`), false);
  assert.strictEqual(oauth.verifyState('garbage'), false);
  assert.strictEqual(oauth.verifyState(''), false);
});

let origFetch;
beforeEach(() => { origFetch = global.fetch; });
afterEach(() => { global.fetch = origFetch; });

test('exchangeCodeForToken: posts to Google token endpoint, returns tokens', async () => {
  let captured;
  global.fetch = async (url, opts) => { captured = { url, opts }; return { ok: true, json: async () => ({ access_token: 'AT', id_token: 'IT' }) }; };
  const tok = await oauth.exchangeCodeForToken({ clientId: 'CID', clientSecret: 'SEC' }, 'CODE', 'https://app/cb');
  assert.strictEqual(tok.access_token, 'AT');
  assert.match(captured.url, /oauth2\.googleapis\.com\/token/);
  assert.strictEqual(captured.opts.method, 'POST');
  const body = new URLSearchParams(captured.opts.body);
  assert.strictEqual(body.get('code'), 'CODE');
  assert.strictEqual(body.get('client_secret'), 'SEC');
  assert.strictEqual(body.get('redirect_uri'), 'https://app/cb');
  assert.strictEqual(body.get('grant_type'), 'authorization_code');
});

test('exchangeCodeForToken: throws on error response', async () => {
  global.fetch = async () => ({ ok: false, status: 400, json: async () => ({ error: 'invalid_grant' }) });
  await assert.rejects(() => oauth.exchangeCodeForToken({ clientId: 'C', clientSecret: 'S' }, 'bad', 'cb'), /Google token exchange failed/);
});

test('fetchGoogleProfile: sends Bearer, returns profile', async () => {
  let auth;
  global.fetch = async (url, opts) => { auth = opts.headers.Authorization; return { ok: true, json: async () => ({ sub: '123', email: 'a@b.com' }) }; };
  const p = await oauth.fetchGoogleProfile('AT');
  assert.strictEqual(p.sub, '123');
  assert.strictEqual(auth, 'Bearer AT');
});

test('fetchGoogleProfile: throws when no sub', async () => {
  global.fetch = async () => ({ ok: false, status: 401, json: async () => ({}) });
  await assert.rejects(() => oauth.fetchGoogleProfile('bad'), /Google profile fetch failed/);
});

// ── find-or-create with a mock db (no real database) ─────────────────────────────
const mockDb = (overrides = {}) => {
  const calls = { update: null, create: null };
  return {
    calls,
    user: {
      findFirst: overrides.findFirst || (async () => null),
      findUnique: overrides.findUnique || (async () => null),
      update: async (a) => { calls.update = a; return { id: a.where.id, ...a.data, linked: true }; },
      create: async (a) => { calls.create = a; return { id: 99, ...a.data }; },
    },
  };
};

test('findOrCreateGoogleUser: existing by google_id → returned, no write', async () => {
  const db = mockDb({ findFirst: async () => ({ id: 1, email: 'x@y.com' }) });
  const u = await oauth.findOrCreateGoogleUser({ sub: 'g1', email: 'x@y.com' }, { db });
  assert.strictEqual(u.id, 1);
  assert.strictEqual(db.calls.create, null);
  assert.strictEqual(db.calls.update, null);
});

test('findOrCreateGoogleUser: existing by email → links google_id', async () => {
  const db = mockDb({ findUnique: async () => ({ id: 2, email: 'x@y.com' }) });
  const u = await oauth.findOrCreateGoogleUser({ sub: 'g2', email: 'X@Y.com' }, { db });
  assert.strictEqual(db.calls.update.where.id, 2);
  assert.strictEqual(db.calls.update.data.google_id, 'g2');
  assert.strictEqual(u.linked, true);
});

test('findOrCreateGoogleUser: new → creates ACTIVE user + customer, lowercased email', async () => {
  const db = mockDb();
  const u = await oauth.findOrCreateGoogleUser({ sub: 'g3', email: 'New@Z.com', given_name: 'New', family_name: 'Z' }, { db });
  assert.strictEqual(db.calls.create.data.google_id, 'g3');
  assert.strictEqual(db.calls.create.data.email, 'new@z.com');
  assert.strictEqual(db.calls.create.data.status, 'active');
  assert.ok(db.calls.create.data.customer.create, 'customer is created alongside the user');
  assert.ok(db.calls.create.data.password, 'an (unusable) password hash is set');
  assert.strictEqual(u.id, 99);
});
