const prisma = require('../../config/database.config');
const { getActivePlan } = require('./billing.middleware');
const { getStripe, stripeConfigured } = require('./billing.stripe');
const paypal = require('./paypal.service');
const paymob = require('./paymob.service');
const { loadGatewayConfig } = require('./gateway.config');
const { taxedTotal } = require('./tax.service');
const { fireWebhooks } = require('../webhooks/webhook.dispatcher');
const { renderInvoicePdf } = require('./invoice-render');

const siteNameSetting = async () => {
  const s = await prisma.setting.findUnique({ where: { name: 'site_name' } }).catch(() => null);
  return (s && s.value) || 'SendQ';
};

const isMissingTableError = (err) => err?.code === 'P2021';

// Apply the customer's tax rate to a subtotal. Returns the subtotal unchanged when tax is
// disabled/unconfigured (the default), so existing behaviour is preserved until tax is set up.
const taxedAmount = async (subtotal, customerId) => {
  const customer = customerId ? await prisma.customer.findUnique({ where: { id: customerId } }).catch(() => null) : null;
  return (await taxedTotal(subtotal, customer)).total;
};

const frontendUrl = () => process.env.FRONTEND_URL || 'http://localhost:5173';

// Compute a subscription end date from a plan's billing frequency.
const computeEndsAt = (plan, from = new Date()) => {
  const amount = Number(plan.frequency_amount) || 1;
  const unit = (plan.frequency_unit || 'month').toLowerCase();
  const date = new Date(from);
  if (unit.startsWith('day')) date.setDate(date.getDate() + amount);
  else if (unit.startsWith('week')) date.setDate(date.getDate() + amount * 7);
  else if (unit.startsWith('year')) date.setFullYear(date.getFullYear() + amount);
  else date.setMonth(date.getMonth() + amount); // default: months
  return date;
};

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Prorate a mid-cycle plan change. Credits the unused portion of the CURRENT plan
// against the prorated cost of the NEW plan for the remainder of the current period.
// Pure function (no I/O) so it can be unit-tested. Mirrors the PHP createChangePlanInvoice math.
const computeProration = ({ currentPlan, newPlan, periodStart, periodEnd, now = new Date() }) => {
  const oldPrice = Number(currentPlan?.price) || 0;
  const newPrice = Number(newPlan?.price) || 0;
  const start = periodStart ? new Date(periodStart).getTime() : NaN;
  const end = periodEnd ? new Date(periodEnd).getTime() : NaN;
  const t = now.getTime();
  // Fraction of the current period still unused. No usable dates → treat as a full new charge.
  let fraction = 1;
  if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
    fraction = Math.min(1, Math.max(0, (end - t) / (end - start)));
  }
  const oldCredit = round2(oldPrice * fraction); // unused value of the current plan
  const newProratedCost = round2(newPrice * fraction); // new plan for the remaining period
  const dueNow = round2(Math.max(0, newProratedCost - oldCredit)); // upgrade → owed now
  const leftoverCredit = round2(Math.max(0, oldCredit - newProratedCost)); // downgrade → credit
  return { fraction: round2(fraction), oldPrice, newPrice, oldCredit, newProratedCost, dueNow, leftoverCredit };
};

// Map a plan's frequency to a Stripe recurring interval.
const mapStripeInterval = (plan) => {
  const count = Math.max(Number(plan.frequency_amount) || 1, 1);
  const unit = (plan.frequency_unit || 'month').toLowerCase();
  let interval = 'month';
  if (unit.startsWith('day')) interval = 'day';
  else if (unit.startsWith('week')) interval = 'week';
  else if (unit.startsWith('year')) interval = 'year';
  return { interval, interval_count: count };
};

// A plan auto-renews when it has a price and a billing frequency.
const isRecurringPlan = (plan) => (Number(plan.price) || 0) > 0 && Boolean(plan.frequency_unit);

// Ensure a single PaymentGateway row of type 'stripe' exists (it's data, not schema).
const ensureStripeGateway = async () => {
  const existing = await prisma.paymentGateway.findFirst({ where: { type: 'stripe' } });
  if (existing) return existing;
  return prisma.paymentGateway.create({
    data: { type: 'stripe', name: 'Stripe', status: 'active' },
  });
};

// Persist the Stripe customer/subscription ids so renewals & cancellation work.
// Mirrors the original app's PaymentMethod.autobilling_data autobilling design.
const storeRecurringPaymentMethod = async ({ customerId, stripeCustomerId, stripeSubscriptionId, planId }) => {
  const gateway = await ensureStripeGateway();
  // Retire any previous auto-charge methods for this customer.
  await prisma.paymentMethod.updateMany({
    where: { customer_id: customerId, can_auto_charge: true },
    data: { can_auto_charge: false },
  });
  await prisma.paymentMethod.create({
    data: {
      customer_id: customerId,
      payment_gateway_id: gateway.id,
      can_auto_charge: true,
      autobilling_data: JSON.stringify({
        provider: 'stripe',
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
        plan_id: planId,
      }),
    },
  });
};

// Find the active recurring payment method matching a Stripe subscription id.
const findMethodByStripeSub = async (stripeSubscriptionId) => {
  const methods = await prisma.paymentMethod.findMany({ where: { can_auto_charge: true } });
  return methods.find((m) => {
    try { return JSON.parse(m.autobilling_data || '{}').stripe_subscription_id === stripeSubscriptionId; }
    catch { return false; }
  }) || null;
};

// Attempt an OFF-SESSION charge of the customer's stored Stripe card (for a prorated
// upgrade). Returns { ok, reason }. Resolves the payment method from autobilling_data,
// else the subscription's / customer's default. Never throws — callers fall back to a
// pending invoice when there's no card on file or the charge can't be made.
const chargeStoredCard = async ({ customerId, amount, currencyCode }) => {
  try {
    const pm = await prisma.paymentMethod.findFirst({
      where: { customer_id: customerId, can_auto_charge: true },
      orderBy: { created_at: 'desc' },
    });
    if (!pm) return { ok: false, reason: 'no_card' };
    const data = JSON.parse(pm.autobilling_data || '{}');
    if (data.provider && data.provider !== 'stripe') return { ok: false, reason: 'unsupported_provider' };
    if (!data.stripe_customer_id) return { ok: false, reason: 'no_stripe_customer' };
    if (!stripeConfigured()) return { ok: false, reason: 'stripe_not_configured' };

    const stripe = getStripe();
    let paymentMethodId = data.stripe_payment_method_id;
    if (!paymentMethodId && data.stripe_subscription_id) {
      const sub = await stripe.subscriptions.retrieve(data.stripe_subscription_id).catch(() => null);
      paymentMethodId = sub?.default_payment_method || undefined;
    }
    if (!paymentMethodId) {
      const cu = await stripe.customers.retrieve(data.stripe_customer_id).catch(() => null);
      paymentMethodId = cu?.invoice_settings?.default_payment_method || undefined;
    }
    if (!paymentMethodId) return { ok: false, reason: 'no_payment_method' };

    const pi = await stripe.paymentIntents.create({
      amount: Math.round(Number(amount) * 100),
      currency: String(currencyCode || 'usd').toLowerCase(),
      customer: data.stripe_customer_id,
      payment_method: paymentMethodId,
      off_session: true,
      confirm: true,
      description: 'Plan change (prorated)',
    });
    return pi.status === 'succeeded' ? { ok: true, paymentIntentId: pi.id } : { ok: false, reason: pi.status };
  } catch (err) {
    return { ok: false, reason: err.code || err.message };
  }
};

// Create an invoice WITH an itemised line (base amount + tax) + a transaction. Shared by
// the paid (activate) and offline (pending) paths so every invoice has line items (BUG-13).
const createPlanInvoice = async ({ customerId, plan, subscriptionId = null, number = null, invoiceStatus, transactionStatus, method }) => {
  const currencyId = plan.currency_id || (await prisma.currency.findFirst())?.id || null;
  if (!currencyId) return null;
  const customer = await prisma.customer.findUnique({ where: { id: customerId } }).catch(() => null);
  const taxed = await taxedTotal(plan.price, customer); // { subtotal, rate, tax, total }
  const invoice = await prisma.invoice.create({
    data: {
      customer_id: customerId,
      currency_id: currencyId,
      subscription_id: subscriptionId,
      status: invoiceStatus,
      title: `Subscription: ${plan.name}`,
      description: plan.description || null,
      type: 'subscription',
      number,
      billing_first_name: customer?.first_name || null,
      billing_last_name: customer?.last_name || null,
      billing_email: customer?.work_email || customer?.billing_email || null,
      billing_address: customer?.billing_address || customer?.address || null,
      fee: taxed.total,
    },
  });
  await prisma.invoiceItem.create({
    data: {
      invoice_id: invoice.id,
      item_id: String(plan.id),
      item_type: 'plan',
      amount: taxed.subtotal,
      tax: taxed.tax,
      discount: 0,
      title: plan.name,
      description: plan.description || null,
    },
  });
  await prisma.transaction.create({ data: { invoice_id: invoice.id, status: transactionStatus, method } });
  return invoice;
};

// Record a paid invoice + transaction for a subscription. Idempotent on externalRef
// (Stripe session id for first payment, Stripe invoice id for renewals).
const recordInvoice = async ({ customerId, plan, subscriptionId, externalRef, method = 'stripe' }) => {
  if (externalRef) {
    const dup = await prisma.invoice.findFirst({ where: { customer_id: customerId, number: externalRef } });
    if (dup) return false; // already recorded
  }
  const invoice = await createPlanInvoice({
    customerId, plan, subscriptionId, number: externalRef || null,
    invoiceStatus: 'paid', transactionStatus: 'success', method,
  });
  return Boolean(invoice);
};

// Activate a plan for a customer after a confirmed payment. Expires the prior
// active subscription, creates the new one, and records an invoice + transaction.
// Idempotent on externalRef (won't double-apply the same payment).
const activatePaidPlan = async ({ customerId, plan, sessionId, externalRef, method = 'stripe', recurring }) => {
  const ref = externalRef || sessionId;
  if (ref) {
    const dup = await prisma.invoice.findFirst({ where: { customer_id: customerId, number: ref } });
    if (dup) return dup.subscription_id; // already applied
  }

  const replaced = await prisma.subscription.updateMany({
    where: { customer_id: customerId, status: 'active' },
    data: { status: 'expired', terminated_at: new Date(), terminated_reason: 'Replaced by new plan' },
  });

  const now = new Date();
  const subscription = await prisma.subscription.create({
    data: {
      customer_id: customerId,
      plan_id: plan.id,
      status: 'active',
      starts_at: now,
      ends_at: computeEndsAt(plan, now),
      current_period_ends_at: computeEndsAt(plan, now),
      is_recurring: recurring ?? Boolean(plan.frequency_unit),
    },
  });

  await recordInvoice({ customerId, plan, subscriptionId: subscription.id, externalRef: ref, method });
  // Outbound webhook: plan change vs first/new subscription.
  fireWebhooks(replaced.count > 0 ? 'customer.changed_plan' : 'customer.subscribed', {
    customer_id: customerId, plan_id: plan.id, plan_name: plan.name, subscription_id: subscription.id, method,
  }, { customerId });
  return subscription.id;
};

// Extend the current subscription by one billing period on a renewal payment.
const renewSubscription = async ({ stripeSubscriptionId, stripeInvoiceId }) => {
  const pm = await findMethodByStripeSub(stripeSubscriptionId);
  if (!pm?.customer_id) return;
  const data = JSON.parse(pm.autobilling_data || '{}');
  const plan = await prisma.plan.findUnique({ where: { id: Number(data.plan_id) } });
  if (!plan) return;

  let sub = await prisma.subscription.findFirst({
    where: { customer_id: pm.customer_id, plan_id: plan.id, status: 'active' },
    orderBy: { created_at: 'desc' },
  });

  if (sub) {
    const base = sub.current_period_ends_at && sub.current_period_ends_at > new Date()
      ? sub.current_period_ends_at : new Date();
    sub = await prisma.subscription.update({
      where: { id: sub.id },
      data: { ends_at: computeEndsAt(plan, base), current_period_ends_at: computeEndsAt(plan, base) },
    });
  } else {
    const id = await activatePaidPlan({ customerId: pm.customer_id, plan, externalRef: stripeInvoiceId, recurring: true });
    sub = { id };
  }

  await recordInvoice({ customerId: pm.customer_id, plan, subscriptionId: sub.id, externalRef: stripeInvoiceId });
};

exports.current = async (req, res) => {
  const customerId = req.customer?.id;
  const plan = await getActivePlan(customerId);

  let subscription = null;
  try {
    subscription = await prisma.subscription.findFirst({
      where: { customer_id: customerId, status: 'active' },
      orderBy: { created_at: 'desc' },
    });
  } catch (err) {
    if (!isMissingTableError(err)) throw err;
  }

  let sentToday = 0;
  if (customerId) {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    try {
      sentToday = await prisma.emailLog.count({
        where: { customer_id: customerId, status: 'sent', sent_at: { gte: dayStart } },
      });
    } catch (err) {
      if (!isMissingTableError(err)) throw err;
    }
  }

  res.json({ plan, subscription, sentToday });
};

// ─── GET /api/billing/plans/db — selectable plans from the database ──────────────
exports.planList = async (req, res) => {
  let plans = [];
  try {
    plans = await prisma.plan.findMany({
      where: { status: 'active', visible: true },
      orderBy: { custom_order: 'asc' },
      include: { currency: true },
    });
  } catch (err) {
    if (!isMissingTableError(err)) throw err;
  }
  const [paypalCfg, paymobCfg] = await Promise.all([loadGatewayConfig('paypal'), loadGatewayConfig('paymob')]);
  res.json({
    plans,
    stripeConfigured: stripeConfigured(),
    paypalConfigured: paypal.paypalConfigured(paypalCfg),
    paymobConfigured: paymob.paymobConfigured(paymobCfg),
    offlineEnabled: true,
  });
};

// ─── GET /api/billing/invoices — current customer's invoices ─────────────────────
exports.invoices = async (req, res) => {
  let invoices = [];
  try {
    invoices = await prisma.invoice.findMany({
      where: { customer_id: req.customer.id },
      orderBy: { created_at: 'desc' },
      include: { currency: true, transactions: true },
    });
  } catch (err) {
    if (!isMissingTableError(err)) throw err;
  }
  res.json({ invoices });
};

// GET /api/billing/invoices/:uid/pdf — download a PDF of the customer's own invoice.
exports.invoicePdf = async (req, res) => {
  const invoice = await prisma.invoice.findFirst({
    where: { uid: req.params.uid, customer_id: req.customer.id },
    include: { currency: true, customer: true },
  });
  if (!invoice) return res.status(404).json({ message: 'Invoice not found.' });
  const items = await prisma.invoiceItem.findMany({ where: { invoice_id: invoice.id } }).catch(() => []);
  const pdf = await renderInvoicePdf({ invoice, items, customer: invoice.customer, currency: invoice.currency, siteName: await siteNameSetting() });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoice.number || invoice.uid.slice(0, 8)}.pdf"`);
  res.send(pdf);
};

// ─── POST /api/billing/checkout — create a Stripe Checkout session ───────────────
exports.checkout = async (req, res) => {
  const planId = Number(req.body.plan_id);
  if (!planId) return res.status(422).json({ message: 'plan_id is required.' });

  const plan = await prisma.plan.findUnique({ where: { id: planId }, include: { currency: true } });
  if (!plan) return res.status(404).json({ message: 'Plan not found.' });

  const price = Number(plan.price) || 0;

  // Free plans need no payment — activate immediately.
  if (price <= 0 || plan.no_payment_required_when_free) {
    await activatePaidPlan({ customerId: req.customer.id, plan, method: 'free' });
    return res.json({ free: true, message: 'Plan activated.' });
  }

  const stripe = getStripe();
  const currency = (plan.currency?.code || 'usd').toLowerCase();
  const recurring = isRecurringPlan(plan);
  const amount = await taxedAmount(price, req.customer.id);

  const session = await stripe.checkout.sessions.create({
    mode: recurring ? 'subscription' : 'payment',
    line_items: [{
      quantity: 1,
      price_data: {
        currency,
        product_data: { name: plan.name, description: plan.description || undefined },
        unit_amount: Math.round(amount * 100),
        ...(recurring ? { recurring: mapStripeInterval(plan) } : {}),
      },
    }],
    success_url: `${frontendUrl()}/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${frontendUrl()}/billing?checkout=cancel`,
    customer_email: req.user?.email || undefined,
    client_reference_id: String(req.customer.id),
    metadata: { customer_id: String(req.customer.id), plan_id: String(plan.id), recurring: String(recurring) },
    // Carry metadata onto the Stripe Subscription so renewal webhooks can resolve it.
    ...(recurring ? { subscription_data: { metadata: { customer_id: String(req.customer.id), plan_id: String(plan.id) } } } : {}),
  });

  res.json({ url: session.url, id: session.id });
};

// ─── POST /api/billing/confirm — verify a session after redirect & activate ──────
exports.confirm = async (req, res) => {
  const sessionId = req.body.session_id;
  if (!sessionId) return res.status(422).json({ message: 'session_id is required.' });

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  const paid = session.payment_status === 'paid' || session.status === 'complete';
  if (!paid) {
    return res.status(402).json({ message: 'Payment not completed.' });
  }
  if (String(session.metadata?.customer_id) !== String(req.customer.id)) {
    return res.status(403).json({ message: 'This payment belongs to another account.' });
  }

  const plan = await prisma.plan.findUnique({ where: { id: Number(session.metadata.plan_id) } });
  if (!plan) return res.status(404).json({ message: 'Plan no longer exists.' });

  const recurring = session.mode === 'subscription';
  if (recurring && session.subscription) {
    await storeRecurringPaymentMethod({
      customerId: req.customer.id,
      stripeCustomerId: session.customer,
      stripeSubscriptionId: session.subscription,
      planId: plan.id,
    });
  }
  await activatePaidPlan({ customerId: req.customer.id, plan, sessionId, recurring });
  res.json({ message: `You're now on the ${plan.name} plan${recurring ? ' (auto-renews)' : ''}.` });
};

// ─── PayPal: create order ────────────────────────────────────────────────────────
exports.paypalCheckout = async (req, res) => {
  const planId = Number(req.body.plan_id);
  if (!planId) return res.status(422).json({ message: 'plan_id is required.' });
  const plan = await prisma.plan.findUnique({ where: { id: planId }, include: { currency: true } });
  if (!plan) return res.status(404).json({ message: 'Plan not found.' });

  const price = Number(plan.price) || 0;
  if (price <= 0 || plan.no_payment_required_when_free) {
    await activatePaidPlan({ customerId: req.customer.id, plan, method: 'free' });
    return res.json({ free: true, message: 'Plan activated.' });
  }

  const config = await loadGatewayConfig('paypal');
  const order = await paypal.createOrder({
    config,
    amount: await taxedAmount(price, req.customer.id),
    currency: plan.currency?.code || 'USD',
    name: plan.name,
    customId: `${req.customer.id}:${plan.id}`,
    returnUrl: `${frontendUrl()}/billing?gateway=paypal`,
    cancelUrl: `${frontendUrl()}/billing?checkout=cancel`,
  });
  res.json({ url: order.approveUrl, id: order.id });
};

// ─── PayPal: capture order after approval & activate ─────────────────────────────
exports.paypalConfirm = async (req, res) => {
  const orderId = req.body.order_id;
  if (!orderId) return res.status(422).json({ message: 'order_id is required.' });

  const config = await loadGatewayConfig('paypal');
  const result = await paypal.captureOrder({ config, orderId });
  if (result.status !== 'COMPLETED') {
    return res.status(402).json({ message: `Payment not completed (status: ${result.status}).` });
  }
  // custom_id carries "customerId:planId" — verify ownership.
  const [customerId, planId] = String(result.customId || '').split(':');
  if (String(customerId) !== String(req.customer.id)) {
    return res.status(403).json({ message: 'This payment belongs to another account.' });
  }
  const plan = await prisma.plan.findUnique({ where: { id: Number(planId) } });
  if (!plan) return res.status(404).json({ message: 'Plan no longer exists.' });

  await activatePaidPlan({ customerId: req.customer.id, plan, externalRef: `paypal:${orderId}`, method: 'paypal' });
  res.json({ message: `You're now on the ${plan.name} plan.` });
};

// Shared: load a plan and short-circuit free plans (activate immediately).
const loadPlanOrFree = async (req, res) => {
  const planId = Number(req.body.plan_id);
  if (!planId) { res.status(422).json({ message: 'plan_id is required.' }); return null; }
  const plan = await prisma.plan.findUnique({ where: { id: planId }, include: { currency: true } });
  if (!plan) { res.status(404).json({ message: 'Plan not found.' }); return null; }
  const price = Number(plan.price) || 0;
  if (price <= 0 || plan.no_payment_required_when_free) {
    await activatePaidPlan({ customerId: req.customer.id, plan, method: 'free' });
    res.json({ free: true, message: 'Plan activated.' });
    return null;
  }
  return plan;
};

// ─── Paymob (Unified Checkout) ───────────────────────────────────────────────────
exports.paymobCheckout = async (req, res) => {
  const plan = await loadPlanOrFree(req, res);
  if (!plan) return;
  const customer = await prisma.customer.findUnique({ where: { id: req.customer.id } }).catch(() => null);
  const config = await loadGatewayConfig('paymob');
  const { checkoutUrl } = await paymob.createCheckout({
    config,
    amount: await taxedAmount(Number(plan.price), req.customer.id),
    currency: plan.currency?.code || 'OMR',
    merchantOrderId: `${req.customer.id}:${plan.id}:${Date.now()}`,
    redirectionUrl: `${frontendUrl()}/billing?gateway=paymob`,
    billing: {
      first_name: customer?.first_name, last_name: customer?.last_name,
      email: req.user?.email, phone: customer?.phone,
    },
  });
  res.json({ url: checkoutUrl });
};

// Frontend posts the Paymob callback params here after redirect; we verify + activate.
exports.paymobConfirm = async (req, res) => {
  const data = req.body || {};
  const obj = data.obj || data;
  const hmac = data.hmac || req.query.hmac;
  const config = await loadGatewayConfig('paymob');
  if (!paymob.verifyHmac(config, data, hmac)) {
    return res.status(402).json({ message: 'Payment verification failed.' });
  }
  if (!(obj.success === true || obj.success === 'true')) {
    return res.status(402).json({ message: 'Payment was not successful.' });
  }
  // merchant_order_id carries "customerId:planId:timestamp".
  const merchant = String(obj.order?.merchant_order_id || obj.merchant_order_id || '');
  const [customerId, planId] = merchant.split(':');
  if (String(customerId) !== String(req.customer.id)) {
    return res.status(403).json({ message: 'This payment belongs to another account.' });
  }
  const plan = await prisma.plan.findUnique({ where: { id: Number(planId) } });
  if (!plan) return res.status(404).json({ message: 'Plan no longer exists.' });
  await activatePaidPlan({ customerId: req.customer.id, plan, externalRef: `paymob:${obj.id}`, method: 'paymob' });
  res.json({ message: `You're now on the ${plan.name} plan.` });
};

// ─── Offline / manual payment (admin approves the invoice) ───────────────────────
exports.offlineCheckout = async (req, res) => {
  const plan = await loadPlanOrFree(req, res);
  if (!plan) return;
  // Create a PENDING subscription + itemised invoice; an admin activates it from Subscriptions.
  const subscription = await prisma.subscription.create({
    data: { customer_id: req.customer.id, plan_id: plan.id, status: 'pending', is_recurring: Boolean(plan.frequency_unit) },
  });
  await createPlanInvoice({
    customerId: req.customer.id, plan, subscriptionId: subscription.id,
    invoiceStatus: 'pending', transactionStatus: 'pending', method: 'offline',
  });
  res.json({ message: 'Your order has been placed. An administrator will review and activate your subscription shortly.' });
};

// ─── POST /api/billing/webhook — Stripe webhook (raw body, mounted in app.js) ────
exports.webhook = async (req, res) => {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  // Fail CLOSED in production: never trust an unsigned payment event. Only the dev
  // environment is allowed to parse unsigned bodies (for local Stripe-CLI testing).
  if (!secret && process.env.NODE_ENV === 'production') {
    return res.status(503).json({ message: 'Stripe webhook secret is not configured.' });
  }
  let event;

  try {
    event = secret
      ? stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], secret)
      : JSON.parse(req.body.toString());
  } catch (err) {
    return res.status(400).json({ message: `Webhook signature verification failed: ${err.message}` });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const ok = (session.payment_status === 'paid' || session.status === 'complete')
        && session.metadata?.customer_id && session.metadata?.plan_id;
      if (ok) {
        const plan = await prisma.plan.findUnique({ where: { id: Number(session.metadata.plan_id) } });
        if (plan) {
          const recurring = session.mode === 'subscription';
          if (recurring && session.subscription) {
            await storeRecurringPaymentMethod({
              customerId: Number(session.metadata.customer_id),
              stripeCustomerId: session.customer,
              stripeSubscriptionId: session.subscription,
              planId: plan.id,
            });
          }
          await activatePaidPlan({ customerId: Number(session.metadata.customer_id), plan, sessionId: session.id, recurring });
        }
      }
      break;
    }
    case 'invoice.payment_succeeded':
    case 'invoice.paid': {
      const invoice = event.data.object;
      // Only renewals — the first cycle is handled by checkout.session.completed.
      if (invoice.subscription && invoice.billing_reason === 'subscription_cycle') {
        await renewSubscription({ stripeSubscriptionId: invoice.subscription, stripeInvoiceId: invoice.id });
      }
      break;
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      const pm = await findMethodByStripeSub(sub.id);
      if (pm?.customer_id) {
        await prisma.subscription.updateMany({
          where: { customer_id: pm.customer_id, status: 'active' },
          data: { status: 'expired', terminated_at: new Date(), terminated_reason: 'Stripe subscription cancelled' },
        });
        await prisma.paymentMethod.update({ where: { id: pm.id }, data: { can_auto_charge: false } });
      }
      break;
    }
    default:
      break;
  }

  res.json({ received: true });
};

// ─── POST /api/billing/cancel — cancel a subscription ────────────────────────────
// Default: stop auto-renew at period end (needs a recurring payment method).
// body.immediate=true: end the active subscription NOW (works for any plan, incl. offline).
exports.cancel = async (req, res) => {
  const pm = await prisma.paymentMethod.findFirst({
    where: { customer_id: req.customer.id, can_auto_charge: true },
    orderBy: { created_at: 'desc' },
  });
  const data = pm ? JSON.parse(pm.autobilling_data || '{}') : {};

  // Immediate cancellation (PHP `cancelNow`): works for ANY active subscription —
  // offline/manual plans have no payment method, so don't gate on `pm` here.
  if (req.body.immediate) {
    const active = await prisma.subscription.findFirst({ where: { customer_id: req.customer.id, status: 'active' } });
    if (!active) return res.status(404).json({ message: 'No active subscription to cancel.' });
    if (data.stripe_subscription_id) {
      await getStripe().subscriptions.cancel(data.stripe_subscription_id).catch(() => {});
    }
    await prisma.subscription.updateMany({
      where: { customer_id: req.customer.id, status: 'active' },
      data: { status: 'cancelled', is_recurring: false, terminated_at: new Date(), terminated_reason: 'Cancelled immediately by customer' },
    });
    // Void unpaid invoices (renewal / change-plan) so nothing remains owed.
    await prisma.invoice.updateMany({
      where: { customer_id: req.customer.id, status: 'pending' },
      data: { status: 'cancelled' },
    }).catch(() => {});
    if (pm) await prisma.paymentMethod.update({ where: { id: pm.id }, data: { can_auto_charge: false } }).catch(() => {});
    fireWebhooks('customer.canceled', { customer_id: req.customer.id, immediate: true }, { customerId: req.customer.id });
    return res.json({ message: 'Your subscription has been cancelled and ended immediately.' });
  }

  // At-period-end cancel: only recurring (card-backed) subscriptions auto-renew.
  if (!pm) return res.status(404).json({ message: 'No active recurring subscription to cancel.' });
  if (data.stripe_subscription_id) {
    await getStripe().subscriptions.update(data.stripe_subscription_id, { cancel_at_period_end: true });
  }
  // Stop auto-renew locally; the plan stays active until the current period ends.
  await prisma.subscription.updateMany({
    where: { customer_id: req.customer.id, status: 'active' },
    data: { is_recurring: false },
  });

  fireWebhooks('customer.canceled', { customer_id: req.customer.id }, { customerId: req.customer.id });
  res.json({ message: 'Auto-renew cancelled. Your plan stays active until the end of the current period.' });
};

// Create an itemised change-plan invoice: new-plan prorated cost as the amount, the
// current plan's unused credit as a discount, `fee` = the net due (after tax).
const createChangePlanInvoice = async ({ customerId, subscriptionId, newPlan, proration, taxedTotalDue, status }) => {
  const currencyId = newPlan.currency_id || (await prisma.currency.findFirst())?.id || null;
  if (!currencyId) return null;
  const customer = await prisma.customer.findUnique({ where: { id: customerId } }).catch(() => null);
  const invoice = await prisma.invoice.create({
    data: {
      customer_id: customerId,
      currency_id: currencyId,
      subscription_id: subscriptionId,
      status,
      title: `Plan change: ${newPlan.name}`,
      description: `Prorated change to ${newPlan.name} (${proration.oldCredit} credit applied)`,
      type: 'change_plan',
      billing_first_name: customer?.first_name || null,
      billing_last_name: customer?.last_name || null,
      billing_email: customer?.work_email || customer?.billing_email || null,
      fee: taxedTotalDue,
    },
  });
  await prisma.invoiceItem.create({
    data: {
      invoice_id: invoice.id,
      item_id: String(newPlan.id),
      item_type: 'plan',
      amount: proration.newProratedCost,
      tax: round2(taxedTotalDue - proration.dueNow),
      discount: proration.oldCredit,
      title: `${newPlan.name} (prorated)`,
      description: 'Mid-cycle plan change',
    },
  });
  await prisma.transaction.create({
    data: { invoice_id: invoice.id, status: status === 'paid' ? 'success' : 'pending', method: 'change_plan' },
  });
  return invoice;
};

// ─── POST /api/billing/change-plan — prorated mid-cycle plan change ──────────────
// body: { plan_id, preview?: boolean }. preview returns the breakdown without writing.
exports.changePlan = async (req, res) => {
  const newPlan = await prisma.plan.findUnique({ where: { id: Number(req.body.plan_id) }, include: { currency: true } });
  if (!newPlan) return res.status(404).json({ message: 'Plan not found.' });

  const sub = await prisma.subscription.findFirst({
    where: { customer_id: req.customer.id, status: 'active' },
    orderBy: { created_at: 'desc' },
  });
  if (!sub) return res.status(409).json({ message: 'No active subscription to change. Use checkout to subscribe.' });
  if (sub.plan_id === newPlan.id) return res.status(422).json({ message: 'You are already on this plan.' });

  const currentPlan = await prisma.plan.findUnique({ where: { id: sub.plan_id } });
  const proration = computeProration({
    currentPlan, newPlan, periodStart: sub.starts_at, periodEnd: sub.current_period_ends_at || sub.ends_at,
  });
  const customer = await prisma.customer.findUnique({ where: { id: req.customer.id } }).catch(() => null);
  const amountDue = (await taxedTotal(proration.dueNow, customer)).total;

  const summary = {
    currentPlan: currentPlan ? { id: currentPlan.id, name: currentPlan.name, price: proration.oldPrice } : null,
    newPlan: { id: newPlan.id, name: newPlan.name, price: proration.newPrice },
    proration, amountDue,
  };

  if (req.body.preview) return res.json({ preview: true, ...summary });

  // Downgrade / lateral (credit covers the new prorated cost): switch immediately, free.
  if (proration.dueNow <= 0) {
    await prisma.subscription.update({ where: { id: sub.id }, data: { plan_id: newPlan.id } });
    await createChangePlanInvoice({ customerId: req.customer.id, subscriptionId: sub.id, newPlan, proration, taxedTotalDue: 0, status: 'paid' });
    fireWebhooks('customer.changed_plan', { customer_id: req.customer.id, plan_id: newPlan.id, plan_name: newPlan.name }, { customerId: req.customer.id });
    return res.json({ ...summary, changed: true, message: `Switched to ${newPlan.name}. Your billing period is unchanged${proration.leftoverCredit > 0 ? `; ${proration.leftoverCredit} credit applied` : ''}.` });
  }

  // Upgrade (balance due): try to settle NOW by charging the card on file off-session.
  // On success → apply the switch immediately + a PAID invoice. Otherwise fall back to a
  // PENDING invoice settled via the existing offline/admin activation flow (PHP behaviour).
  const charge = await chargeStoredCard({ customerId: req.customer.id, amount: amountDue, currencyCode: newPlan.currency?.code });
  if (charge.ok) {
    await prisma.subscription.update({ where: { id: sub.id }, data: { plan_id: newPlan.id } });
    await createChangePlanInvoice({ customerId: req.customer.id, subscriptionId: sub.id, newPlan, proration, taxedTotalDue: amountDue, status: 'paid' });
    fireWebhooks('customer.changed_plan', { customer_id: req.customer.id, plan_id: newPlan.id, plan_name: newPlan.name }, { customerId: req.customer.id });
    return res.json({ ...summary, changed: true, charged: amountDue, message: `Upgraded to ${newPlan.name}. ${amountDue} was charged to your card on file.` });
  }

  const invoice = await createChangePlanInvoice({ customerId: req.customer.id, subscriptionId: sub.id, newPlan, proration, taxedTotalDue: amountDue, status: 'pending' });
  return res.json({
    ...summary, requiresPayment: true,
    invoice: invoice ? { uid: invoice.uid, number: invoice.number } : null,
    message: `Upgrading to ${newPlan.name} costs ${amountDue} now (prorated; ${proration.oldCredit} credit applied). Complete the pending invoice to finish the change.`,
  });
};

// ─── Sending credits (buy credit packs) ─────────────────────────────────────
exports.creditPlans = async (req, res) => {
  let plans = [];
  try {
    plans = await prisma.sendingCreditPlan.findMany({ orderBy: { price: 'asc' } });
  } catch { plans = []; }
  res.json({
    data: plans.map((p) => ({ uid: p.uid, name: p.name, credits: Number(p.credits), price: Number(p.price), currency_id: p.currency_id })),
  });
};

exports.credits = async (req, res) => {
  const rows = await prisma.$queryRawUnsafe('SELECT sending_credits AS c FROM sendq_customers WHERE id = ?', req.customer.id);
  res.json({ credits: Number(rows?.[0]?.c || 0) });
};

const creditBalance = async (customerId) => {
  const rows = await prisma.$queryRawUnsafe('SELECT sending_credits AS c FROM sendq_customers WHERE id = ?', customerId);
  return Number(rows?.[0]?.c || 0);
};

exports.buyCredits = async (req, res) => {
  const plan = await prisma.sendingCreditPlan.findFirst({ where: { uid: req.params.uid } });
  if (!plan) return res.status(404).json({ message: 'Credit plan not found.' });

  const customer = await prisma.customer.findUnique({ where: { id: req.customer.id } }).catch(() => null);
  const currencyId = plan.currency_id || (await prisma.currency.findFirst())?.id || null;
  const price = Number(plan.price);
  const isFree = price <= 0;
  const taxed = await taxedTotal(price, customer);

  // Record an invoice: PAID for free packs, PENDING for paid packs. Paid packs
  // do NOT grant credits here — the credits are added only once the invoice is
  // marked paid/approved (admin approval or a real gateway payment). This closes
  // the loophole where paid credit packs were granted for free.
  let invoice = null;
  if (currencyId) {
    invoice = await prisma.invoice.create({
      data: {
        customer_id: req.customer.id,
        currency_id: currencyId,
        status: isFree ? 'paid' : 'pending',
        title: `Sending credits: ${plan.name}`,
        description: `${Number(plan.credits).toLocaleString()} sending credits`,
        type: 'credit',
        fee: taxed.total,
        billing_first_name: customer?.first_name || null,
        billing_last_name: customer?.last_name || null,
        billing_email: customer?.work_email || customer?.billing_email || null,
      },
    });
    await prisma.invoiceItem.create({
      data: { invoice_id: invoice.id, item_id: String(plan.id), item_type: 'credit_plan', amount: taxed.subtotal, tax: taxed.tax, discount: 0, title: plan.name },
    });
    await prisma.transaction.create({ data: { invoice_id: invoice.id, status: isFree ? 'success' : 'pending', method: req.body.method || 'offline' } });
  }

  if (isFree) {
    await prisma.$executeRawUnsafe('UPDATE sendq_customers SET sending_credits = sending_credits + ? WHERE id = ?', Number(plan.credits), req.customer.id);
    return res.status(201).json({
      message: `Added ${Number(plan.credits).toLocaleString()} sending credits.`,
      credits: await creditBalance(req.customer.id),
      invoice_uid: invoice?.uid || null,
      pending: false,
    });
  }

  // Paid pack: pending until the invoice is approved/paid — no credits granted yet.
  return res.status(201).json({
    message: 'Your credit purchase is pending payment. Credits will be added once the invoice is approved/paid.',
    credits: await creditBalance(req.customer.id),
    invoice_uid: invoice?.uid || null,
    pending: true,
  });
};

// Exported for unit testing (pure proration math).
exports.computeProration = computeProration;
