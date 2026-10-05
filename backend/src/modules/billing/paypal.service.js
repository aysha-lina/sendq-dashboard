// PayPal REST (Orders v2) client via fetch — no SDK. Config comes from the
// admin-saved keys (PaymentGateway.gateway_data) with env fallback.

const cfgFrom = (c = {}) => ({
  clientId: c.client_id || process.env.PAYPAL_CLIENT_ID || '',
  secret: c.secret || process.env.PAYPAL_SECRET || '',
  env: String(c.environment || c.env || process.env.PAYPAL_ENV || 'sandbox').toLowerCase(),
});

const paypalConfigured = (c) => {
  const cfg = cfgFrom(c);
  return Boolean(cfg.clientId && cfg.secret);
};

const baseUrl = (cfg) => (
  ['live', 'production'].includes(cfg.env) ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com'
);

const requireConfig = (cfg) => {
  if (!(cfg.clientId && cfg.secret)) {
    const err = new Error('PayPal is not configured. Add the Client ID and Secret in admin → Payment gateways → Paypal.');
    err.status = 503;
    throw err;
  }
};

const getAccessToken = async (cfg) => {
  requireConfig(cfg);
  const creds = Buffer.from(`${cfg.clientId}:${cfg.secret}`).toString('base64');
  const r = await fetch(`${baseUrl(cfg)}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const d = await r.json();
  if (!d.access_token) throw new Error(`PayPal auth failed: ${d.error_description || d.error || 'unknown'}`);
  return d.access_token;
};

// Create a one-time CAPTURE order; returns { id, approveUrl }.
const createOrder = async ({ config, amount, currency = 'USD', name, returnUrl, cancelUrl, customId }) => {
  const cfg = cfgFrom(config);
  const token = await getAccessToken(cfg);
  const r = await fetch(`${baseUrl(cfg)}/v2/checkout/orders`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        amount: { currency_code: currency.toUpperCase(), value: Number(amount).toFixed(2) },
        description: name,
        custom_id: customId,
      }],
      application_context: {
        brand_name: 'SendQ',
        user_action: 'PAY_NOW',
        return_url: returnUrl,
        cancel_url: cancelUrl,
      },
    }),
  });
  const d = await r.json();
  if (!d.id) throw new Error(`PayPal order create failed: ${d.message || JSON.stringify(d.details || d)}`);
  const approve = (d.links || []).find((l) => l.rel === 'approve');
  return { id: d.id, approveUrl: approve?.href };
};

// Capture an approved order; returns { status, captureId, customId, raw }.
const captureOrder = async ({ config, orderId }) => {
  const cfg = cfgFrom(config);
  const token = await getAccessToken(cfg);
  const r = await fetch(`${baseUrl(cfg)}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  const d = await r.json();
  const capture = d?.purchase_units?.[0]?.payments?.captures?.[0];
  return { status: d.status, captureId: capture?.id, customId: capture?.custom_id, raw: d };
};

module.exports = { paypalConfigured, createOrder, captureOrder, getAccessToken, cfgFrom };
