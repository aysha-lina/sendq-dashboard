const crypto = require('crypto');
const { authenticator } = require('otplib');
const qrcode = require('qrcode');
const prisma = require('../../config/database.config');
const { sendMail } = require('../email-engine/smtp.service');

const APP_NAME = process.env.APP_NAME || 'SendQ';
const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// ─── TOTP (Google Authenticator etc.) ────────────────────────────────────────────
const generateTotpSecret = () => authenticator.generateSecret();
const totpAuthUri = (email, secret) => authenticator.keyuri(email, APP_NAME, secret);
const verifyTotp = (token, secret) => {
  if (!token || !secret) return false;
  try { return authenticator.check(String(token).replace(/\s/g, ''), secret); } catch { return false; }
};
const qrDataUrl = (otpauth) => qrcode.toDataURL(otpauth);

// ─── Email one-time codes ────────────────────────────────────────────────────────
const generateEmailCode = () => String(crypto.randomInt(100000, 1000000));

const sendEmailCode = async (user) => {
  const code = generateEmailCode();
  await prisma.user.update({
    where: { id: user.id },
    data: { two_factor_code: code, two_factor_code_expires_at: new Date(Date.now() + CODE_TTL_MS) },
  });
  const from = process.env.MAIL_FROM || process.env.SMTP_USER || 'noreply@sendq.io';
  await sendMail({
    provider: {},
    message: {
      from,
      to: user.email,
      subject: `${APP_NAME} verification code`,
      html: `<p>Your ${APP_NAME} verification code is:</p>
<p style="font-size:28px;font-weight:700;letter-spacing:4px;">${code}</p>
<p>This code expires in 10 minutes. If you didn't try to sign in, change your password.</p>`,
    },
  }).catch((err) => console.error('[2fa] email send failed:', err.message));
  return code;
};

const verifyEmailCode = (user, code) => Boolean(
  user.two_factor_code
  && String(user.two_factor_code) === String(code).trim()
  && user.two_factor_code_expires_at
  && new Date(user.two_factor_code_expires_at) > new Date(),
);

// Verify a code against whichever method the user/secret implies.
const verifyCode = (user, code, { method, secret } = {}) => {
  const m = method || user.two_factor_method;
  if (m === 'totp') return verifyTotp(code, secret || user.two_factor_secret);
  return verifyEmailCode(user, code);
};

const clearEmailCode = (userId) => prisma.user.update({
  where: { id: userId }, data: { two_factor_code: null, two_factor_code_expires_at: null },
});

module.exports = {
  generateTotpSecret, totpAuthUri, verifyTotp, qrDataUrl,
  sendEmailCode, verifyEmailCode, verifyCode, clearEmailCode,
};
