// Lazy Stripe client. Never crashes the app if the key or package is absent —
// callers get a clear 503 instead, so the billing routes load fine without Stripe.
let stripeClient = null;

const getStripe = () => {
  if (stripeClient) return stripeClient;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    const err = new Error('Stripe is not configured. Set STRIPE_SECRET_KEY in the backend .env.');
    err.status = 503;
    throw err;
  }

  let Stripe;
  try {
    Stripe = require('stripe');
  } catch {
    const err = new Error('Stripe package is not installed. Run `npm install` inside backend.');
    err.status = 503;
    throw err;
  }

  stripeClient = Stripe(key);
  return stripeClient;
};

const stripeConfigured = () => Boolean(process.env.STRIPE_SECRET_KEY);

module.exports = { getStripe, stripeConfigured };
