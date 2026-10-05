const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const prisma = require('../../config/database.config');

// Google OAuth 2.0 (OpenID Connect) login. The client secret never leaves the backend:
// the browser only carries the one-time `code`, which we exchange server-side.
const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO = 'https://openidconnect.googleapis.com/v1/userinfo';

// Build the consent-screen URL the browser is redirected to. Pure.
const buildGoogleAuthUrl = (config, redirectUri, state) => {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
    prompt: 'select_account',
  });
  return `${GOOGLE_AUTH}?${params.toString()}`;
};

// Exchange the auth code for tokens (must use the SAME redirect_uri as the auth request).
const exchangeCodeForToken = async (config, code, redirectUri) => {
  const res = await fetch(GOOGLE_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }).toString(),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) {
    throw new Error(`Google token exchange failed (${res.status})${json.error ? `: ${json.error}` : ''}`);
  }
  return json;
};

// Fetch the user's Google profile with the access token.
const fetchGoogleProfile = async (accessToken) => {
  const res = await fetch(GOOGLE_USERINFO, { headers: { Authorization: `Bearer ${accessToken}` } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.sub) throw new Error(`Google profile fetch failed (${res.status}).`);
  return json; // { sub, email, email_verified, given_name, family_name, name, picture }
};

// Find-or-create a local user from a Google profile. `db` is injectable for tests.
//   1) match existing google_id  →  2) match existing email (link google_id)  →  3) create new
// Google-verified emails create an ACTIVE account (no email-verification step).
const findOrCreateGoogleUser = async (profile, { db = prisma } = {}) => {
  const email = String(profile.email || '').toLowerCase();

  const byGoogle = await db.user.findFirst({ where: { google_id: profile.sub }, include: { customer: true } });
  if (byGoogle) return byGoogle;

  if (email) {
    const byEmail = await db.user.findUnique({ where: { email }, include: { customer: true } });
    if (byEmail) {
      return db.user.update({ where: { id: byEmail.id }, data: { google_id: profile.sub }, include: { customer: true } });
    }
  }

  const password = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 12); // unusable (OAuth-only)
  return db.user.create({
    data: {
      uid: uuidv4(),
      email,
      password,
      google_id: profile.sub,
      api_token: uuidv4().replace(/-/g, '').substring(0, 60),
      status: 'active',
      first_name: profile.given_name || null,
      last_name: profile.family_name || null,
      customer: {
        create: {
          uid: uuidv4(),
          first_name: profile.given_name || 'User',
          last_name: profile.family_name || null,
          timezone: 'UTC',
          status: 'active',
        },
      },
    },
    include: { customer: true },
  });
};

// CSRF state: a short-lived signed token issued at `start` and verified at the callback.
const signState = () => jwt.sign({ oauth: 'google', n: crypto.randomBytes(8).toString('hex') }, process.env.JWT_SECRET, { expiresIn: '10m' });
const verifyState = (state) => {
  try { return jwt.verify(String(state || ''), process.env.JWT_SECRET).oauth === 'google'; } catch { return false; }
};

const signLoginToken = async (userId) => {
  const { getTokenVersion } = require('./token-version');
  const tv = await getTokenVersion(userId);
  return jwt.sign({ id: userId, tv }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
};

const loadGoogleConfig = async () => {
  const rows = await prisma.setting.findMany({ where: { name: { in: ['oauth.google_enabled', 'oauth.google_client_id', 'oauth.google_client_secret'] } } });
  const map = Object.fromEntries(rows.map((r) => [r.name, r.value]));
  return {
    enabled: map['oauth.google_enabled'] === 'yes',
    clientId: map['oauth.google_client_id'] || '',
    clientSecret: map['oauth.google_client_secret'] || '',
  };
};

module.exports = {
  buildGoogleAuthUrl, exchangeCodeForToken, fetchGoogleProfile, findOrCreateGoogleUser,
  signState, verifyState, signLoginToken, loadGoogleConfig,
};
