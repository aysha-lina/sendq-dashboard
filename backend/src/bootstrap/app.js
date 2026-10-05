const express = require('express');
const { registerMiddleware, publicLimiter } = require('./middleware');
const authRoutes = require('../modules/auth/auth.routes');
const campaignRoutes = require('../modules/campaigns/campaign.routes');
const subscriberRoutes = require('../modules/subscribers/subscriber.routes');
const analyticsRoutes = require('../modules/analytics/analytics.routes');
const billingRoutes = require('../modules/billing/billing.routes');
const accountRoutes = require('../modules/account/account.routes');
const adminRoutes = require('../modules/admin/admin.routes');
const sendingRoutes = require('../modules/sending/sending.routes');
const trackingRoutes = require('../modules/tracking/tracking.routes');
const legacyListController = require('../modules/legacy/list.controller');
const { protect } = require('../modules/auth/auth.middleware');
const { wrapAsync, wrapHandlers: w } = require('../utils/route-async');

const createApp = () => {
  const app = express();
  // Behind a reverse proxy (nginx) in production — trust the first proxy hop so the real
  // client IP is read from X-Forwarded-For (correct rate-limiting + no express-rate-limit
  // ValidationError). One hop only, so a client can't spoof X-Forwarded-For.
  app.set('trust proxy', 1);
  app.set('etag', false);
  app.set('json replacer', (key, value) => (typeof value === 'bigint' ? value.toString() : value));

  // Stripe webhook needs the raw body for signature verification, so it must be
  // registered BEFORE the JSON body parser in registerMiddleware.
  app.post(
    '/api/billing/webhook',
    express.raw({ type: 'application/json' }),
    ...w(require('../modules/billing/billing.controller').webhook),
  );

  registerMiddleware(app);

  // Serve uploaded files (e.g. profile avatars).
  app.use('/uploads', express.static(require('path').join(process.cwd(), 'uploads')));

  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', app: process.env.APP_NAME || 'SendQ' });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/campaigns', wrapAsync(protect), campaignRoutes);
  app.use('/api/subscribers', wrapAsync(protect), subscriberRoutes);
  app.use('/api/analytics', wrapAsync(protect), analyticsRoutes);
  app.use('/api/billing', wrapAsync(protect), billingRoutes);
  app.use('/api/account', wrapAsync(protect), accountRoutes);
  app.use('/api/admin', wrapAsync(protect), adminRoutes);
  app.use('/api/sending', wrapAsync(protect), sendingRoutes);
  app.use('/api/integration', wrapAsync(protect), require('../modules/integration/integration.routes'));
  app.use('/api/store', wrapAsync(protect), require('../modules/store/store.routes'));
  app.use('/track', trackingRoutes);
  app.post('/api/v1/public/subscribers', publicLimiter, ...w(legacyListController.publicSubscribe));
  app.get('/api/v1/public/forms/:formUid', publicLimiter, ...w(legacyListController.getPublicForm));
  app.get('/api/v1/public/profile/:subscriberUid', publicLimiter, ...w(legacyListController.getPublicProfile));
  app.post('/api/v1/public/profile/:subscriberUid', publicLimiter, ...w(legacyListController.updatePublicProfile));
  app.get('/api/v1/public/confirm/:token', publicLimiter, ...w(legacyListController.confirmSubscriber));
  app.get('/api/v1/public/translations/:locale', publicLimiter, ...w(legacyListController.publicTranslations));
  app.get('/api/v1/public/settings', publicLimiter, ...w(require('../modules/admin/admin.controller').publicSettings));
  app.get('/api/v1/public/sender-verify/:token', publicLimiter, ...w(require('../modules/sending/senders.controller').verifySenderToken));
  app.use('/api/inbound', require('../modules/webhooks/inbound.routes'));
  app.use('/api/v1', wrapAsync(protect), require('../modules/legacy/legacy.routes'));

  // Plugin runtime: a router plugins register their own routes into, then load all
  // active plugins (they hook into core events + may add routes here). Never throws.
  const pluginRouter = express.Router();
  app.use('/api/plugins', pluginRouter);
  require('../modules/plugins/plugin-runtime')
    .loadActivePlugins({ router: pluginRouter })
    .catch((err) => console.error('[plugins] load failed:', err.message));

  app.use((req, res) => {
    res.status(404).json({ message: `Route ${req.method} ${req.path} not found.` });
  });

  app.use((err, req, res, _next) => {
    console.error('Unhandled error:', err);
    if (
      err?.code === 'P2021' ||
      err?.code === 'P2022' ||
      err?.message?.includes('does not exist') ||
      err?.message?.includes("doesn't exist")
    ) {
      return res.status(503).json({
        message: 'Database schema is not up to date. Stop the backend, then run npm run prisma:generate and npm run prisma:push inside backend.',
      });
    }

    // A non-numeric/malformed id (e.g. Number('abc') → NaN, which Prisma drops so the
    // `id` argument reads as missing/invalid) should be a clean 404, not a 500 crash.
    // Scoped to id-argument validation so genuine query bugs still surface as 500.
    if (
      err?.code === 'P2023' ||
      (err?.name === 'PrismaClientValidationError' && /Argument `[\w]*id` (is missing|: Got invalid)/i.test(err?.message || ''))
    ) {
      return res.status(404).json({ message: 'Resource not found.' });
    }

    res.status(err.status || 500).json({
      message: process.env.NODE_ENV === 'production' ? 'Internal server error.' : err.message,
    });
  });

  return app;
};

module.exports = createApp;
