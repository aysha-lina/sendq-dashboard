const dns = require('dns').promises;
const net = require('net');
const prisma = require('../../config/database.config');
const { hooks } = require('../plugins/hook-manager');

// ─── SSRF guard ──────────────────────────────────────────────────────────────
// Webhook URLs are user-supplied, so block any that resolve to private, loopback,
// link-local, or cloud-metadata addresses — otherwise a webhook could be pointed
// at internal services (127.0.0.1, 169.254.169.254, 192.168.x, …).
const isPrivateIp = (ip) => {
  if (!ip) return true;
  const v = ip.replace(/^::ffff:/i, ''); // unwrap IPv4-mapped IPv6
  if (net.isIPv4(v)) {
    const [a, b] = v.split('.').map(Number);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;          // link-local + cloud metadata
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true;                          // multicast / reserved
    return false;
  }
  const low = v.toLowerCase();
  return low === '::1' || low === '::' || low.startsWith('fe80') || low.startsWith('fc') || low.startsWith('fd');
};

const isSafeWebhookUrl = async (rawUrl) => {
  let url;
  try { url = new URL(rawUrl); } catch { return false; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return false;
  if (net.isIP(host)) return !isPrivateIp(host);
  try {
    const records = await dns.lookup(host, { all: true });
    // Block if ANY resolved address is private (defends against DNS rebinding).
    return records.length > 0 && records.every((r) => !isPrivateIp(r.address));
  } catch {
    return false; // unresolvable → don't send
  }
};

// Outbound webhook delivery. Fires every active webhook subscribed to an event,
// honouring its configured method / URL / auth / headers / body / retries.
// Fire-and-forget: never throws to the caller and never blocks the request.

const buildAuthHeaders = (w) => {
  const h = {};
  if (w.request_auth_type === 'bearer' && w.request_auth_bearer_token) {
    h.Authorization = `Bearer ${w.request_auth_bearer_token}`;
  } else if (w.request_auth_type === 'basic' && w.request_auth_basic_username) {
    h.Authorization = `Basic ${Buffer.from(`${w.request_auth_basic_username}:${w.request_auth_basic_password || ''}`).toString('base64')}`;
  } else if ((w.request_auth_type === 'header' || w.request_auth_type === 'custom') && w.request_auth_custom_key) {
    h[w.request_auth_custom_key] = w.request_auth_custom_value || '';
  }
  return h;
};

const buildBody = (w, payload) => {
  if (w.request_body_type === 'plain' && w.request_body_plain) {
    return { body: w.request_body_plain, contentType: 'text/plain' };
  }
  if ((w.request_body_type === 'form' || w.request_body_type === 'params') && w.request_body_params) {
    try { return { body: new URLSearchParams(JSON.parse(w.request_body_params)).toString(), contentType: 'application/x-www-form-urlencoded' }; } catch { /* fall through */ }
  }
  return { body: JSON.stringify(payload), contentType: 'application/json' };
};

const sendOne = async (w, payload) => {
  if (!w.request_url) return;
  if (!(await isSafeWebhookUrl(w.request_url))) {
    console.error(`[webhook] blocked unsafe/internal URL: ${w.request_url}`);
    return;
  }
  const method = String(w.request_method || 'POST').toUpperCase();
  const { body, contentType } = buildBody(w, payload);
  let headers = { 'Content-Type': contentType, 'User-Agent': 'SendQ-Webhook/1.0', ...buildAuthHeaders(w) };
  if (w.request_headers) { try { headers = { ...headers, ...JSON.parse(w.request_headers) }; } catch { /* ignore bad header json */ } }

  const retries = Math.max(0, Number(w.setting_retry_times) || 0);
  const delayMs = Math.max(1000, (Number(w.setting_retry_after_seconds) || 60) * 1000);
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const res = await fetch(w.request_url, {
        method,
        headers,
        body: method === 'GET' ? undefined : body,
        signal: AbortSignal.timeout ? AbortSignal.timeout(15000) : undefined,
      });
      if (res.ok) return;
      throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      if (attempt === retries) { console.error(`[webhook] ${w.uid} (${w.event}) → ${w.request_url} failed: ${err.message}`); return; }
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
};

// Public API: fire all active webhooks for `event`. Optionally scope to a customer
// (a customer's own webhooks + global admin webhooks with customer_id NULL).
const fireWebhooks = (event, payload = {}, { customerId } = {}) => {
  setImmediate(async () => {
    const enriched = { event, fired_at: new Date().toISOString(), ...payload };
    // Let plugins react to the same lifecycle events.
    hooks.doAction(event, enriched).catch(() => {});
    try {
      const where = { event, status: 'active' };
      if (customerId != null) where.OR = [{ customer_id: customerId }, { customer_id: null }];
      const subs = await prisma.webhook.findMany({ where });
      if (!subs.length) return;
      await Promise.all(subs.map((w) => sendOne(w, enriched).catch(() => {})));
    } catch (err) {
      console.error('[webhook] dispatch error:', err.message);
    }
  });
};

module.exports = { fireWebhooks, buildAuthHeaders, buildBody, sendOne };
