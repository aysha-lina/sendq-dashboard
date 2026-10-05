// HTTP API senders for the provider "*-api" sending-server types.
// SendGrid / Mailgun / SparkPost send over the provider REST API (Node global fetch,
// no SDK dependency). Amazon SES "api" is handled by deriving its SMTP password and
// routing back through nodemailer (see descriptorFor → ses branch in mail.dispatcher).
const crypto = require('crypto');

// ─── helpers ──────────────────────────────────────────────────────────────────────
const parseAddress = (raw) => {
  const s = String(raw || '').trim();
  const m = s.match(/^"?([^"<]*?)"?\s*<\s*([^>]+?)\s*>$/);
  if (m) return { name: m[1].trim() || undefined, email: m[2].trim() };
  return { email: s };
};

const parseOptions = (opts) => {
  if (!opts) return {};
  if (typeof opts === 'object') return opts;
  try { return JSON.parse(opts); } catch { return {}; }
};

// AWS SES SMTP password is derived from the IAM secret access key via a documented
// SigV4-style derivation. Lets the "amazon-api" type send through SES SMTP unchanged.
const sesSmtpPassword = (secret, region) => {
  const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();
  let sig = hmac(`AWS4${secret}`, '11111111');
  sig = hmac(sig, region);
  sig = hmac(sig, 'ses');
  sig = hmac(sig, 'aws4_request');
  sig = hmac(sig, 'SendRawEmail');
  return Buffer.concat([Buffer.from([0x04]), sig]).toString('base64');
};

const mailgunBase = (opts) => ((opts.region || opts.mailgun_region) === 'eu' ? 'https://api.eu.mailgun.net' : 'https://api.mailgun.net');

// Minimal HTML→text for providers (e.g. BlastEngine) that require a plain part.
const htmlToText = (html) => String(html || '')
  .replace(/<style[\s\S]*?<\/style>/gi, '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim() || ' ';

// BlastEngine bearer token = base64( lowercase( sha256(username + api_key) ) ).
const blastengineToken = (username, apiKey) =>
  Buffer.from(crypto.createHash('sha256').update(`${username}${apiKey}`).digest('hex').toLowerCase()).toString('base64');

// ─── descriptor: map a sending-server record → transport descriptor ─────────────────
// Returns either { api: '…', … } (HTTP API) or an SMTP shape consumed by smtp.factory.
const descriptorFor = (s = {}) => {
  const type = String(s.type || 'smtp').toLowerCase();
  const opts = parseOptions(s.options);

  if (type === 'sendgrid-api') return { api: 'sendgrid', apiKey: s.api_key };
  if (type === 'mailgun-api') return { api: 'mailgun', apiKey: s.api_key, domain: s.domain, base: mailgunBase(opts) };
  if (type === 'sparkpost-api') return { api: 'sparkpost', apiKey: s.api_key };
  if (type === 'blastengine-api') return { api: 'blastengine', username: s.username, apiKey: s.api_key };
  if (type === 'elasticemail-api') return { api: 'elasticemail', apiKey: s.api_key };
  // blastengine-smtp falls through to the generic SMTP shape below (host/smtp_*).
  if (type === 'sendmail') return { type: 'sendmail', path: s.sendmail_path };

  if (type === 'amazon-api' || type === 'ses' || type.includes('ses')) {
    const region = s.aws_region || 'us-east-1';
    // amazon-api: derive SES SMTP creds; amazon-smtp already has smtp_username/password.
    const user = s.smtp_username || s.aws_access_key_id;
    const password = s.smtp_password || (s.aws_secret_access_key ? sesSmtpPassword(s.aws_secret_access_key, region) : undefined);
    return {
      type: 'smtp',
      host: s.host || `email-smtp.${region}.amazonaws.com`,
      port: Number(s.smtp_port) || 587,
      secure: (s.smtp_protocol || '').toLowerCase() === 'ssl',
      user,
      password,
    };
  }

  if (type === 'gmail') return { type: 'gmail', user: s.smtp_username, password: s.smtp_password };

  return {
    type: 'smtp',
    host: s.host,
    port: Number(s.smtp_port) || 587,
    secure: (s.smtp_protocol || '').toLowerCase() === 'ssl',
    user: s.smtp_username,
    password: s.smtp_password,
  };
};

const isApi = (provider) => Boolean(provider && provider.api);

// ─── send over the provider HTTP API ────────────────────────────────────────────────
const sendViaApi = async (provider, message) => {
  const from = parseAddress(message.from);
  const to = parseAddress(message.to).email;
  const replyTo = message.replyTo ? parseAddress(message.replyTo).email : undefined;
  const { subject, html, text } = message;

  if (provider.api === 'sendgrid') {
    if (!provider.apiKey) throw new Error('SendGrid API key is missing.');
    const content = [];
    if (text) content.push({ type: 'text/plain', value: text });
    content.push({ type: 'text/html', value: html || ' ' });
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${provider.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: from.email, ...(from.name ? { name: from.name } : {}) },
        ...(replyTo ? { reply_to: { email: replyTo } } : {}),
        subject,
        content,
      }),
    });
    if (!res.ok) throw new Error(`SendGrid API ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return { messageId: res.headers.get('x-message-id') || `sendgrid-${Date.now()}` };
  }

  if (provider.api === 'mailgun') {
    if (!provider.apiKey || !provider.domain) throw new Error('Mailgun API key and domain are required.');
    const body = new URLSearchParams({ from: message.from, to, subject: subject || '', html: html || '' });
    if (text) body.set('text', text);
    if (replyTo) body.set('h:Reply-To', replyTo);
    const res = await fetch(`${provider.base}/v3/${provider.domain}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`api:${provider.apiKey}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    if (!res.ok) throw new Error(`Mailgun API ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const json = await res.json().catch(() => ({}));
    return { messageId: json.id || `mailgun-${Date.now()}` };
  }

  if (provider.api === 'sparkpost') {
    if (!provider.apiKey) throw new Error('SparkPost API key is missing.');
    const res = await fetch('https://api.sparkpost.com/api/v1/transmissions', {
      method: 'POST',
      headers: { Authorization: provider.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: {
          from: { email: from.email, ...(from.name ? { name: from.name } : {}) },
          subject,
          html: html || ' ',
          ...(text ? { text } : {}),
          ...(replyTo ? { reply_to: replyTo } : {}),
        },
        recipients: [{ address: { email: to } }],
      }),
    });
    if (!res.ok) throw new Error(`SparkPost API ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const json = await res.json().catch(() => ({}));
    return { messageId: json.results?.id || `sparkpost-${Date.now()}` };
  }

  if (provider.api === 'blastengine') {
    if (!provider.username || !provider.apiKey) throw new Error('BlastEngine username and API key are required.');
    const res = await fetch('https://app.engn.jp/api/v1/deliveries/transaction', {
      method: 'POST',
      headers: { Authorization: `Bearer ${blastengineToken(provider.username, provider.apiKey)}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: { email: from.email, name: from.name || '' },
        to,
        subject,
        encode: 'UTF-8',
        text_part: text || htmlToText(html), // BlastEngine requires a plain part
        html_part: html || ' ',
      }),
    });
    if (!res.ok) throw new Error(`BlastEngine API ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const json = await res.json().catch(() => ({}));
    return { messageId: json.delivery_id != null ? String(json.delivery_id) : `blastengine-${Date.now()}` };
  }

  if (provider.api === 'elasticemail') {
    if (!provider.apiKey) throw new Error('Elastic Email API key is missing.');
    const body = new URLSearchParams({
      apikey: provider.apiKey,
      from: from.email,
      ...(from.name ? { fromName: from.name } : {}),
      to,
      subject: subject || '',
      bodyHtml: html || ' ',
      ...(text ? { bodyText: text } : {}),
      ...(replyTo ? { replyTo } : {}),
    });
    const res = await fetch('https://api.elasticemail.com/v2/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
      throw new Error(`Elastic Email API ${res.status}: ${json.error || (await res.text().catch(() => '')).slice(0, 200)}`);
    }
    const mid = json.data?.messageid || json.data?.transactionid;
    return { messageId: mid ? String(mid) : `elasticemail-${Date.now()}` };
  }

  throw new Error(`Unknown API provider: ${provider.api}`);
};

// ─── lightweight authenticated ping (Test Connection for API types) ─────────────────
const verifyApi = async (provider) => {
  if (provider.api === 'sendgrid') {
    const res = await fetch('https://api.sendgrid.com/v3/scopes', { headers: { Authorization: `Bearer ${provider.apiKey}` } });
    if (!res.ok) throw new Error(`SendGrid auth failed (${res.status}).`);
    return 'SendGrid API key is valid.';
  }
  if (provider.api === 'mailgun') {
    const res = await fetch(`${provider.base}/v3/domains`, { headers: { Authorization: `Basic ${Buffer.from(`api:${provider.apiKey}`).toString('base64')}` } });
    if (!res.ok) throw new Error(`Mailgun auth failed (${res.status}).`);
    return 'Mailgun API key is valid.';
  }
  if (provider.api === 'sparkpost') {
    const res = await fetch('https://api.sparkpost.com/api/v1/account', { headers: { Authorization: provider.apiKey } });
    if (!res.ok) throw new Error(`SparkPost auth failed (${res.status}).`);
    return 'SparkPost API key is valid.';
  }
  if (provider.api === 'blastengine') {
    if (!provider.username || !provider.apiKey) throw new Error('BlastEngine username and API key are required.');
    const res = await fetch('https://app.engn.jp/api/v1/deliveries?page=1', { headers: { Authorization: `Bearer ${blastengineToken(provider.username, provider.apiKey)}` } });
    if (res.status === 401 || res.status === 403) throw new Error(`BlastEngine auth failed (${res.status}).`);
    return 'BlastEngine credentials accepted.';
  }
  if (provider.api === 'elasticemail') {
    if (!provider.apiKey) throw new Error('Elastic Email API key is missing.');
    const res = await fetch(`https://api.elasticemail.com/v2/account/load?apikey=${encodeURIComponent(provider.apiKey)}`);
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) throw new Error('Elastic Email auth failed.');
    return 'Elastic Email API key is valid.';
  }
  throw new Error(`Unknown API provider: ${provider.api}`);
};

// Mask sending-server secrets for detail responses (return presence flags, not values).
const SECRET_FIELDS = ['smtp_password', 'api_key', 'api_secret_key', 'aws_secret_access_key'];
const maskSecrets = (server = {}) => {
  const out = { ...server };
  for (const f of SECRET_FIELDS) {
    out[`${f}_set`] = Boolean(server[f]);
    if (server[f]) out[f] = '';
  }
  return out;
};

module.exports = { descriptorFor, isApi, sendViaApi, verifyApi, sesSmtpPassword, parseAddress, maskSecrets };
