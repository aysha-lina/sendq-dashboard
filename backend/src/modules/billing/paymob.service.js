// Paymob Unified Intention API client (region-aware: Oman/Egypt/UAE/KSA/Pakistan).
// Flow: POST /v1/intention (Bearer = Secret Key) → client_secret → Unified Checkout
// URL (publicKey + clientSecret). No SDK. Config comes from the admin-saved keys
// (PaymentGateway.gateway_data) with env fallback.
const crypto = require('crypto');

// Currencies with 3 decimal places use a ×1000 subunit; everything else ×100.
const THREE_DECIMAL = ['OMR', 'BHD', 'KWD', 'TND', 'JOD', 'IQD', 'LYD'];
const toSubunit = (amount, currency) => {
  const factor = THREE_DECIMAL.includes(String(currency).toUpperCase()) ? 1000 : 100;
  return Math.round(Number(amount) * factor);
};

// Normalise a config object (DB gateway_data) with env fallback.
const cfgFrom = (c = {}) => ({
  region: c.region || process.env.PAYMOB_REGION || 'accept.paymob.com',
  secretKey: c.secret_key || process.env.PAYMOB_SECRET_KEY || '',
  publicKey: c.public_key || process.env.PAYMOB_PUBLIC_KEY || '',
  integrationIds: String(c.integration_ids || c.integration_id || process.env.PAYMOB_INTEGRATION_ID || '')
    .split(/[\s,]+/).map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0),
  hmacSecret: c.hmac_secret || process.env.PAYMOB_HMAC_SECRET || '',
});

const paymobConfigured = (c) => {
  const cfg = cfgFrom(c);
  return Boolean(cfg.secretKey && cfg.publicKey && cfg.integrationIds.length);
};

const requireConfig = (cfg) => {
  if (!(cfg.secretKey && cfg.publicKey && cfg.integrationIds.length)) {
    const err = new Error('Paymob is not configured. Add the Public Key, Secret Key and Integration ID(s) in admin → Payment gateways → Paymob.');
    err.status = 503;
    throw err;
  }
};

// Create a payment intention + return the Unified Checkout URL.
// merchantOrderId carries "customerId:planId:timestamp" (unique special_reference).
const createCheckout = async ({ config, amount, currency = 'OMR', merchantOrderId, billing, redirectionUrl }) => {
  const cfg = cfgFrom(config);
  requireConfig(cfg);
  const base = `https://${cfg.region}`;
  const amountSub = toSubunit(amount, currency);

  const body = {
    amount: amountSub,
    currency: String(currency).toUpperCase(),
    payment_methods: cfg.integrationIds,
    items: [{ name: 'Subscription', amount: amountSub, quantity: 1 }],
    billing_data: {
      first_name: billing?.first_name || 'NA',
      last_name: billing?.last_name || 'NA',
      email: billing?.email || 'NA',
      phone_number: billing?.phone || 'NA',
      apartment: 'NA', floor: 'NA', street: 'NA', building: 'NA',
      shipping_method: 'NA', postal_code: 'NA', city: 'NA', country: 'NA', state: 'NA',
    },
    special_reference: merchantOrderId,
    ...(redirectionUrl ? { redirection_url: redirectionUrl } : {}),
  };

  const r = await fetch(`${base}/v1/intention/`, {
    method: 'POST',
    headers: { Authorization: `Token ${cfg.secretKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.client_secret) {
    throw new Error(`Paymob intention failed: ${d.detail || d.message || JSON.stringify(d).slice(0, 300)}`);
  }

  return {
    checkoutUrl: `${base}/unifiedcheckout/?publicKey=${encodeURIComponent(cfg.publicKey)}&clientSecret=${encodeURIComponent(d.client_secret)}`,
    intentionId: d.id,
    clientSecret: d.client_secret,
  };
};

// Verify a Paymob transaction-processed callback HMAC over the documented field set.
const verifyHmac = (config, obj, received) => {
  const cfg = cfgFrom(config);
  if (!cfg.hmacSecret || !received) return false;
  const o = obj.obj || obj;
  const concat = [
    o.amount_cents, o.created_at, o.currency, o.error_occured, o.has_parent_transaction,
    o.id, o.integration_id, o.is_3d_secure, o.is_auth, o.is_capture, o.is_refunded,
    o.is_standalone_payment, o.is_voided, o.order?.id ?? o.order, o.owner, o.pending,
    o.source_data?.pan, o.source_data?.sub_type, o.source_data?.type, o.success,
  ].map((v) => (v === undefined || v === null ? '' : String(v))).join('');
  const expected = crypto.createHmac('sha512', cfg.hmacSecret).update(concat).digest('hex');
  try { return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(received))); } catch { return false; }
};

module.exports = { paymobConfigured, createCheckout, verifyHmac };
