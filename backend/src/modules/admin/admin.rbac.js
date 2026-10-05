const { hasRole, hasAbility } = require('../auth/rbac');

// Per-route ability gate for the admin panel (BUG-1). super_admin always passes (so the
// existing super-admin user is never affected). Other admins pass only if their role grants
// the ability for the route's section + action. Unmapped routes default to super_admin-only
// (fail-safe). Abilities use the original SendQ vocabulary (see config/original-rbac.js).

// CRUD sections derive `<base>_<read|create|update|delete>` from the HTTP method.
const CRUD = (base) => ({ base });
// FIXED sections use a single ability regardless of method (settings, reports/logs).
const FIXED = (ability) => ({ ability });

// Order: longer / more-specific prefixes first.
const SECTIONS = [
  ['/admin-groups', CRUD('admin_group')],
  ['/admins', CRUD('admin')],
  ['/roles', CRUD('admin')],
  ['/customers', CRUD('customer')],
  ['/subscriptions', CRUD('subscription')],
  ['/invoices', CRUD('subscription')],
  ['/transactions', CRUD('subscription')],
  ['/sending-credit-plans', CRUD('plan')],
  ['/email-verification-plans', CRUD('plan')],
  ['/plans', CRUD('plan')],
  ['/payment-gateways', CRUD('payment_method')],
  ['/payment-methods', CRUD('payment_method')],
  ['/payment-services', CRUD('payment_method')],
  ['/email-verification-servers', CRUD('sending_server')],
  ['/sending-servers', CRUD('sending_server')],
  ['/bounce-handlers', CRUD('bounce_handler')],
  ['/feedback-handlers', CRUD('fbl_handler')],
  ['/sending-domains', CRUD('sending_domain')],
  ['/template-gallery', CRUD('template')],
  ['/form-templates', CRUD('template')],
  ['/custom-emails', CRUD('template')],
  ['/templates', CRUD('template')],
  ['/currencies', CRUD('currency')],
  ['/admin-languages', CRUD('language')],
  ['/translations', CRUD('language')],
  ['/languages', CRUD('language')],
  // single-ability sections
  ['/taxes', FIXED('setting_general')],
  ['/mail-settings', FIXED('setting_general')],
  ['/settings', FIXED('setting_general')],
  ['/captcha', FIXED('setting_general')],
  ['/appearance', FIXED('setting_general')],
  ['/oauth', FIXED('setting_general')],
  ['/webhooks', FIXED('setting_general')],
  ['/plugins', FIXED('setting_upgrade_manager')],
  ['/blacklist', FIXED('report_blacklist')],
  ['/tracking-log', FIXED('report_tracking_log')],
  ['/bounce-log', FIXED('report_bounce_log')],
  ['/feedback-log', FIXED('report_feedback_log')],
  ['/open-log', FIXED('report_open_log')],
  ['/click-log', FIXED('report_click_log')],
  ['/unsubscribe-log', FIXED('report_unsubscribe_log')],
];

const actionFor = (method) => {
  switch ((method || 'GET').toUpperCase()) {
    case 'POST': return 'create';
    case 'PUT':
    case 'PATCH': return 'update';
    case 'DELETE': return 'delete';
    default: return 'read';
  }
};

// Returns the ability required for a request, or null (→ super_admin-only).
const requiredAbility = (method, pathname) => {
  const p = String(pathname || '').replace(/^\/api\/admin/, '') || '/';
  for (const [prefix, cfg] of SECTIONS) {
    if (p === prefix || p.startsWith(`${prefix}/`)) {
      return cfg.ability || `${cfg.base}_${actionFor(method)}`;
    }
  }
  return null;
};

const requireAdminAbility = (req, res, next) => {
  if (hasRole(req.user, 'super_admin')) return next(); // super_admin: unconditional
  const ability = requiredAbility(req.method, req.path);
  if (ability && hasAbility(req.user, ability)) return next();
  return res.status(403).json({ message: 'You do not have permission to access this resource.' });
};

module.exports = { requireAdminAbility, requiredAbility };
