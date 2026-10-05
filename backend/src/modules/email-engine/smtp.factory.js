const nodemailer = require('nodemailer');

const baseAuth = (provider) => ({
  user: provider.user || process.env.SMTP_USER,
  pass: provider.password || process.env.SMTP_PASSWORD,
});

const createTransport = (provider = {}) => {
  const type = provider.type || process.env.SMTP_PROVIDER || 'smtp';

  if (type === 'gmail') {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: baseAuth(provider),
    });
  }

  // SendMail (UNIX): pipe through the host's sendmail binary, no network/auth.
  if (type === 'sendmail') {
    return nodemailer.createTransport({
      sendmail: true,
      newline: 'unix',
      path: provider.path || process.env.SENDMAIL_PATH || '/usr/sbin/sendmail',
    });
  }

  if (type === 'ses') {
    return nodemailer.createTransport({
      host: provider.host || process.env.SES_SMTP_HOST || 'email-smtp.us-east-1.amazonaws.com',
      port: Number(provider.port || process.env.SES_SMTP_PORT || 587),
      secure: false,
      auth: baseAuth(provider),
    });
  }

  // Respect an explicitly-configured `secure` on the provider (a server set to non-SSL
  // must NOT inherit the env's SMTP_SECURE — that forced TLS onto plaintext ports).
  const secure = provider.secure !== undefined
    ? Boolean(provider.secure)
    : String(process.env.SMTP_SECURE || 'false') === 'true';
  return nodemailer.createTransport({
    host: provider.host || process.env.SMTP_HOST,
    port: Number(provider.port || process.env.SMTP_PORT || 587),
    secure,
    auth: baseAuth(provider),
  });
};

module.exports = { createTransport };
