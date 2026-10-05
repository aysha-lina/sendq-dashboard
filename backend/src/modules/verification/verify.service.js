const dns = require('dns').promises;

// Email verification. Ships with a built-in syntax + MX-record verifier (no
// external service required) and adapters for ZeroBounce / NeverBounce that
// activate when an API key is configured on the verification server.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLE_LOCALS = ['admin', 'info', 'support', 'sales', 'contact', 'noreply', 'no-reply', 'postmaster', 'abuse', 'webmaster', 'office'];
const DISPOSABLE = ['mailinator.com', '10minutemail.com', 'guerrillamail.com', 'tempmail.com', 'trashmail.com', 'yopmail.com', 'getnada.com'];

// The server's API key can be stored as raw text or JSON in `options`.
const parseKey = (options) => {
  if (!options) return null;
  try { const o = JSON.parse(options); return o.api_key || o.key || o.apiKey || null; }
  catch { return String(options).trim() || null; }
};

const builtinVerify = async (email) => {
  if (!EMAIL_RE.test(email || '')) return { status: 'undeliverable', reason: 'Invalid syntax' };
  const [local, domain] = email.toLowerCase().split('@');
  if (DISPOSABLE.includes(domain)) return { status: 'risky', reason: 'Disposable domain' };
  try {
    const mx = await dns.resolveMx(domain);
    if (!mx || mx.length === 0) return { status: 'undeliverable', reason: 'No MX records' };
    if (ROLE_LOCALS.includes(local)) return { status: 'risky', reason: 'Role-based address' };
    return { status: 'deliverable', reason: 'MX present' };
  } catch (err) {
    if (['ENOTFOUND', 'ENODATA'].includes(err.code)) return { status: 'undeliverable', reason: 'Domain has no mail server' };
    return { status: 'unknown', reason: 'DNS lookup failed' };
  }
};

const zeroBounce = async (email, key) => {
  if (!key) return { status: 'unknown', reason: 'No API key configured' };
  const r = await fetch(`https://api.zerobounce.net/v2/validate?api_key=${encodeURIComponent(key)}&email=${encodeURIComponent(email)}`);
  const d = await r.json();
  const map = { valid: 'deliverable', invalid: 'undeliverable', 'catch-all': 'risky', spamtrap: 'risky', abuse: 'risky', do_not_mail: 'risky', unknown: 'unknown' };
  return { status: map[d.status] || 'unknown', reason: d.sub_status || d.status || 'zerobounce' };
};

const neverBounce = async (email, key) => {
  if (!key) return { status: 'unknown', reason: 'No API key configured' };
  const r = await fetch(`https://api.neverbounce.com/v4/single/check?key=${encodeURIComponent(key)}&email=${encodeURIComponent(email)}`);
  const d = await r.json();
  const map = { valid: 'deliverable', invalid: 'undeliverable', catchall: 'risky', disposable: 'risky', unknown: 'unknown' };
  return { status: map[d.result] || 'unknown', reason: d.result || 'neverbounce' };
};

const verifyEmail = async (email, server) => {
  const type = (server?.type || 'builtin').toLowerCase();
  const key = parseKey(server?.options);
  try {
    if (type.includes('zerobounce')) return await zeroBounce(email, key);
    if (type.includes('neverbounce')) return await neverBounce(email, key);
    return await builtinVerify(email);
  } catch (err) {
    return { status: 'unknown', reason: err.message };
  }
};

module.exports = { verifyEmail, builtinVerify };
