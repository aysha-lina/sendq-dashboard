const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const prisma = require('../../config/database.config');
const { sanitizeUser } = require('./auth.middleware');
const { attachAccess } = require('./rbac');
const { getTokenVersion, bumpTokenVersion } = require('./token-version');
const { fireWebhooks } = require('../webhooks/webhook.dispatcher');
const oauth = require('./oauth.service');

const frontendBase = () => (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
const googleRedirectUri = () => `${frontendBase()}/auth/google/callback`;
const { sendMail } = require('../email-engine/smtp.service');
const twofa = require('./twofa.service');

// Issues a JWT embedding the user's current token_version, so it can be revoked
// (bump the version to invalidate all previously-issued tokens).
const signToken = async (userId) => {
  const tv = await getTokenVersion(userId);
  return jwt.sign({ id: userId, tv }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

// ─── Captcha (parity with PHP Setting::get + Tool::showReCaptcha) ──────────────
// Reads captcha config from the shared sendq_settings table, falling back to env.
const getSetting = async (name, fallback = '') => {
  const row = await prisma.setting.findUnique({ where: { name } }).catch(() => null);
  return row?.value ?? fallback;
};

const getCaptchaConfig = async () => {
  const flag = (await getSetting('registration_recaptcha')).toString().toLowerCase();
  const enabled = flag === 'yes' || flag === '1' || flag === 'true';
  const provider = (await getSetting('captcha_engine')) || 'recaptcha';
  const siteKey = (await getSetting('recaptcha_site_key')) || process.env.RECAPTCHA_SITE_KEY || '';
  const secretKey = (await getSetting('recaptcha_secret_key')) || process.env.RECAPTCHA_SECRET || '';
  return { enabled, provider, siteKey, secretKey };
};

// Public: tells the frontend whether to render the captcha and which site key to use.
exports.captchaConfig = async (req, res) => {
  const { enabled, provider, siteKey } = await getCaptchaConfig();
  res.json({ enabled: enabled && !!siteKey, provider, site_key: siteKey });
};

// ─── Google OAuth login ──────────────────────────────────────────────────────────
// Public: tells the frontend whether to show the "Sign in with Google" button.
exports.oauthConfig = async (req, res) => {
  const config = await oauth.loadGoogleConfig();
  res.json({ google: Boolean(config.enabled && config.clientId) });
};

// GET /api/auth/oauth/google/start — redirect the browser to Google's consent screen.
exports.googleOAuthStart = async (req, res) => {
  const config = await oauth.loadGoogleConfig();
  if (!config.enabled || !config.clientId) {
    return res.redirect(`${frontendBase()}/login?oauth_error=${encodeURIComponent('Google login is not enabled.')}`);
  }
  res.redirect(oauth.buildGoogleAuthUrl(config, googleRedirectUri(), oauth.signState()));
};

// POST /api/auth/oauth/google/exchange — the frontend callback posts { code, state }; we
// verify state, exchange the code server-side, find-or-create the user, and return a JWT.
exports.googleOAuthExchange = async (req, res) => {
  const { code, state } = req.body || {};
  if (!code || !oauth.verifyState(state)) {
    return res.status(422).json({ message: 'Invalid or expired Google sign-in request. Please try again.' });
  }
  const config = await oauth.loadGoogleConfig();
  if (!config.enabled || !config.clientId) {
    return res.status(422).json({ message: 'Google login is not enabled.' });
  }
  try {
    const tokens = await oauth.exchangeCodeForToken(config, code, googleRedirectUri());
    const profile = await oauth.fetchGoogleProfile(tokens.access_token);
    if (!profile.email) return res.status(422).json({ message: 'Your Google account has no email address.' });
    const user = await oauth.findOrCreateGoogleUser(profile);
    if (user.status !== 'active') return res.status(403).json({ message: 'Your account is inactive.' });
    res.json({ token: await oauth.signLoginToken(user.id), user: await attachAccess(sanitizeUser(user)) });
  } catch (err) {
    res.status(401).json({ message: err.message || 'Google authentication failed.' });
  }
};

// Verify a captcha token against the provider. Returns true when the captcha is
// disabled (nothing to verify) or when verification succeeds.
const verifyCaptcha = async (token) => {
  const { enabled, provider, secretKey } = await getCaptchaConfig();
  if (!enabled) return true;          // captcha not enabled in settings → nothing to check
  if (!secretKey) return true;        // enabled but misconfigured → don't lock people out
  if (!token) return false;
  const url = provider === 'hcaptcha'
    ? 'https://hcaptcha.com/siteverify'
    : 'https://www.google.com/recaptcha/api/siteverify';
  try {
    const params = new URLSearchParams({ secret: secretKey, response: token });
    const resp = await fetch(url, { method: 'POST', body: params });
    const data = await resp.json();
    return !!data.success;
  } catch {
    return true; // provider unreachable → do not block registration
  }
};

// Short-lived token issued after password check when 2FA is required.
const signChallenge = (userId) =>
  jwt.sign({ id: userId, twofa_pending: true }, process.env.JWT_SECRET, { expiresIn: '10m' });

// Per-email brute-force lockout (PHP: 5 attempts / 2-minute decay). Backed by
// Redis so it survives restarts and works across instances, with an in-memory
// fallback when Redis isn't ready (never blocks login).
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_DECAY_MS = 2 * 60 * 1000;
const attemptKey = (email) => String(email || '').toLowerCase();
const redisKey = (email) => `login_fail:${attemptKey(email)}`;

// Only use Redis when the shared connection is actually ready — otherwise a
// missing/booting Redis would hang the login request.
const readyRedis = () => {
  try {
    const c = require('../../queues/connection').getConnection();
    return c && c.status === 'ready' ? c : null;
  } catch { return null; }
};

// In-memory fallback store.
const loginAttempts = new Map();
const getLockMem = (email) => {
  const rec = loginAttempts.get(attemptKey(email));
  if (!rec) return null;
  if (Date.now() - rec.first > LOGIN_DECAY_MS) { loginAttempts.delete(attemptKey(email)); return null; }
  return rec;
};

const checkLock = async (email) => {
  const r = readyRedis();
  if (r) {
    try {
      const count = Number(await r.get(redisKey(email))) || 0;
      if (count >= LOGIN_MAX_ATTEMPTS) {
        const ttl = await r.ttl(redisKey(email));
        return { locked: true, retryIn: ttl > 0 ? ttl : Math.ceil(LOGIN_DECAY_MS / 1000) };
      }
      return { locked: false };
    } catch { /* fall through to memory */ }
  }
  const rec = getLockMem(email);
  if (rec && rec.count >= LOGIN_MAX_ATTEMPTS) {
    return { locked: true, retryIn: Math.ceil((LOGIN_DECAY_MS - (Date.now() - rec.first)) / 1000) };
  }
  return { locked: false };
};

const noteFailed = async (email) => {
  const r = readyRedis();
  if (r) {
    try {
      const count = await r.incr(redisKey(email));
      if (count === 1) await r.pexpire(redisKey(email), LOGIN_DECAY_MS);
      return;
    } catch { /* fall through */ }
  }
  const rec = getLockMem(email) || { count: 0, first: Date.now() };
  rec.count += 1;
  loginAttempts.set(attemptKey(email), rec);
};

const clearAttempts = async (email) => {
  const r = readyRedis();
  if (r) { try { await r.del(redisKey(email)); return; } catch { /* fall through */ } }
  loginAttempts.delete(attemptKey(email));
};

exports.login = [
  body('email').isEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password required'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const { email, password } = req.body;

    const lock = await checkLock(email);
    if (lock.locked) {
      return res.status(429).json({ message: `Too many failed attempts. Please try again in ${lock.retryIn}s.`, retry_in: lock.retryIn });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { customer: true },
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      await noteFailed(email);
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    await clearAttempts(email);

    if (user.status === 'inactive') {
      return res.status(403).json({ message: 'Please verify your email address before logging in.', code: 'EMAIL_UNVERIFIED', email: user.email });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ message: 'Your account is inactive.' });
    }

    // Two-factor gate: don't issue the real token until the code is verified.
    if (user.two_factor_enabled) {
      if (user.two_factor_method === 'email') {
        await twofa.sendEmailCode(user);
      }
      return res.json({ twoFactorRequired: true, method: user.two_factor_method, challenge: signChallenge(user.id) });
    }

    res.json({ token: await signToken(user.id), user: await attachAccess(sanitizeUser(user)) });
  },
];

// POST /auth/2fa/verify — exchange a 2FA challenge + code for the real token.
exports.verifyTwoFactor = [
  body('challenge').notEmpty().withMessage('Challenge required'),
  body('code').notEmpty().withMessage('Code required'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    let decoded;
    try {
      decoded = jwt.verify(req.body.challenge, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ message: 'Your verification session expired. Please log in again.' });
    }
    if (!decoded.twofa_pending) return res.status(400).json({ message: 'Invalid challenge.' });

    const user = await prisma.user.findUnique({ where: { id: decoded.id }, include: { customer: true } });
    if (!user || !user.two_factor_enabled) return res.status(400).json({ message: 'Invalid challenge.' });

    if (!twofa.verifyCode(user, req.body.code, { method: user.two_factor_method, secret: user.two_factor_secret })) {
      return res.status(422).json({ message: 'Invalid or expired verification code.' });
    }

    if (user.two_factor_method === 'email') await twofa.clearEmailCode(user.id);
    res.json({ token: await signToken(user.id), user: await attachAccess(sanitizeUser(user)) });
  },
];

const sendVerificationEmail = async ({ user, token }) => {
  const apiUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 5000}`;
  const verifyUrl = `${apiUrl}/api/auth/verify-email?token=${token}`;
  const fromAddress = process.env.MAIL_FROM || process.env.SMTP_USER || 'noreply@sendq.io';
  await sendMail({
    provider: {},
    message: {
      from: fromAddress,
      to: user.email,
      subject: 'Verify your SendQ email address',
      html: `<p>Hi ${user.first_name || ''},</p>
<p>Thanks for signing up! Please verify your email address by clicking the link below:</p>
<p><a href="${verifyUrl}" style="display:inline-block;padding:12px 24px;background:#7c4ddb;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;">Verify email address</a></p>
<p>Or copy this link into your browser:<br />${verifyUrl}</p>
<p>This link expires in 24 hours.</p>
<p>If you didn't create a SendQ account, you can safely ignore this email.</p>`,
    },
  });
};

exports.register = [
  body('email').isEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('first_name').notEmpty().withMessage('Full name required'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const {
      email, password, first_name, timezone = 'UTC', recaptcha_token,
    } = req.body;
    const last_name = req.body.last_name && req.body.last_name.trim() ? req.body.last_name.trim() : '-';
    // Organization / company name — sent as `company` or `name`.
    const company = (req.body.company || req.body.name || '').trim() || null;

    // Verify captcha against the provider configured in admin Settings (parity with PHP).
    const captchaOk = await verifyCaptcha(recaptcha_token);
    if (!captchaOk) return res.status(422).json({ message: 'Captcha verification failed. Please try again.' });

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(422).json({ message: 'Email already registered.' });

    const user = await prisma.user.create({
      data: {
        uid: uuidv4(),
        email,
        password: await bcrypt.hash(password, 12),
        api_token: uuidv4().replace(/-/g, '').substring(0, 60),
        status: 'inactive',
        first_name,
        last_name,
        customer: {
          create: {
            uid: uuidv4(),
            first_name,
            last_name,
            company,
            timezone,
            status: 'active',
          },
        },
      },
      include: { customer: true },
    });

    const token = crypto.randomBytes(32).toString('hex');
    await prisma.userActivation.create({ data: { user_id: user.id, token } });

    try {
      await sendVerificationEmail({ user, token });
    } catch (err) {
      console.error('[auth] Failed to send verification email:', err.message);
    }

    fireWebhooks('customer.registered', {
      customer_id: user.customer?.id, email, first_name, last_name, company,
    });

    res.status(201).json({ message: 'Registration successful. Please check your email to verify your account.', email });
  },
];

exports.me = async (req, res) => {
  res.json({ user: req.user });
};

exports.forgotPassword = [
  body('email').isEmail().withMessage('Valid email required'),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    try {
      const { email } = req.body;
      const user = await prisma.user.findUnique({ where: { email } });

      if (user) {
        const token = crypto.randomBytes(32).toString('hex');
        await prisma.passwordReset.upsert({
          where: { email },
          create: { email, token },
          update: { token, created_at: new Date() },
        });

        const appUrl = process.env.APP_URL || 'http://localhost:5173';
        const resetUrl = `${appUrl}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;
        const fromAddress = process.env.MAIL_FROM || process.env.SMTP_USER || 'noreply@sendq.io';

        await sendMail({
          provider: {},
          message: {
            from: fromAddress,
            to: email,
            subject: 'Reset your SendQ password',
            html: `<p>Hi ${user.first_name || ''},</p><p>You requested a password reset.</p><p><a href="${resetUrl}">Click here to reset your password</a></p><p>This link expires in 1 hour.</p>`,
          },
        });
      }

      res.json({ message: 'If that email is registered, a reset link has been sent.' });
    } catch (err) {
      next(err);
    }
  },
];

exports.resetPassword = [
  body('email').isEmail().withMessage('Valid email required'),
  body('token').notEmpty().withMessage('Token required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    try {
      const { email, token, password } = req.body;
      const record = await prisma.passwordReset.findUnique({ where: { email } });

      if (!record || record.token !== token) {
        return res.status(400).json({ message: 'Invalid or expired reset token.' });
      }

      const ONE_HOUR = 60 * 60 * 1000;
      if (Date.now() - new Date(record.created_at).getTime() > ONE_HOUR) {
        await prisma.passwordReset.delete({ where: { email } });
        return res.status(400).json({ message: 'Reset token has expired. Please request a new one.' });
      }

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) return res.status(400).json({ message: 'Invalid or expired reset token.' });

      await prisma.user.update({
        where: { id: user.id },
        data: { password: await bcrypt.hash(password, 12) },
      });
      await prisma.passwordReset.delete({ where: { email } });
      await bumpTokenVersion(user.id); // invalidate any existing sessions

      res.json({ message: 'Password reset successfully. You can now log in.' });
    } catch (err) {
      next(err);
    }
  },
];

const verificationPage = (state) => {
  const appUrl = process.env.APP_URL || 'http://localhost:5173';
  if (state === 'success') {
    return { redirect: `${appUrl}/login?verified=1` };
  }
  const titles = { expired: 'Link expired', invalid: 'Invalid link', already: 'Already verified' };
  const bodies = {
    expired: 'This verification link has expired. Please request a new one from the login page.',
    invalid: 'This verification link is invalid or has already been used.',
    already: 'Your email address is already verified. You can log in.',
  };
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${titles[state] || 'Error'}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f6f7fb;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}.card{background:#fff;border-radius:16px;padding:48px 40px;max-width:440px;width:100%;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.08)}.icon{font-size:3rem;margin-bottom:20px}h1{font-size:1.4rem;font-weight:700;color:#172033;margin-bottom:10px}p{font-size:.95rem;color:#64748b;line-height:1.6}a{color:#7c4ddb;text-decoration:none;font-weight:600}.btn{display:inline-block;margin-top:20px;padding:10px 24px;background:#7c4ddb;color:#fff;border-radius:8px;font-weight:600;text-decoration:none}</style></head><body><div class="card"><div class="icon">${state === 'already' ? 'ℹ️' : '⚠️'}</div><h1>${titles[state] || 'Error'}</h1><p>${bodies[state] || ''}</p><a class="btn" href="${process.env.APP_URL || 'http://localhost:5173'}/login">Go to login</a></div></body></html>`;
};

exports.verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).send(verificationPage('invalid'));

    const activation = await prisma.userActivation.findUnique({ where: { token } });
    if (!activation) return res.status(400).send(verificationPage('invalid'));

    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    if (Date.now() - new Date(activation.created_at).getTime() > TWENTY_FOUR_HOURS) {
      await prisma.userActivation.delete({ where: { token } }).catch(() => {});
      return res.status(400).send(verificationPage('expired'));
    }

    const user = await prisma.user.findUnique({ where: { id: activation.user_id } });
    if (!user) return res.status(400).send(verificationPage('invalid'));

    if (user.status === 'active') {
      await prisma.userActivation.delete({ where: { token } }).catch(() => {});
      return res.send(verificationPage('already'));
    }

    await prisma.user.update({ where: { id: user.id }, data: { status: 'active' } });
    await prisma.userActivation.delete({ where: { token } }).catch(() => {});

    const result = verificationPage('success');
    return res.redirect(result.redirect);
  } catch (err) {
    next(err);
  }
};

exports.resendVerification = [
  body('email').isEmail().withMessage('Valid email required'),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    try {
      const { email } = req.body;
      const user = await prisma.user.findUnique({ where: { email } });

      if (user && user.status === 'inactive') {
        const token = crypto.randomBytes(32).toString('hex');
        await prisma.userActivation.upsert({
          where: { token: (await prisma.userActivation.findFirst({ where: { user_id: user.id } }))?.token || '' },
          create: { user_id: user.id, token },
          update: { token, updated_at: new Date() },
        }).catch(async () => {
          await prisma.userActivation.deleteMany({ where: { user_id: user.id } });
          await prisma.userActivation.create({ data: { user_id: user.id, token } });
        });

        try {
          await sendVerificationEmail({ user, token });
        } catch (err) {
          console.error('[auth] Failed to resend verification email:', err.message);
        }
      }

      res.json({ message: 'If that email is awaiting verification, a new link has been sent.' });
    } catch (err) {
      next(err);
    }
  },
];

exports.renewApiToken = async (req, res, next) => {
  try {
    const apiToken = uuidv4().replace(/-/g, '').substring(0, 60);
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { api_token: apiToken },
      include: { customer: true },
    });

    res.json({ user: await attachAccess(sanitizeUser(user)), api_token: apiToken });
  } catch (err) {
    next(err);
  }
};
