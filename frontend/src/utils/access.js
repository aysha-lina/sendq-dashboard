// Client-side mirror of the backend admin RBAC (backend admin.rbac.js + auth/rbac.js).
// This is UX-only — the server still enforces every admin route (returns 403). Its job
// is to hide admin nav items and pages the current user has no ability for (S7), so a
// limited admin doesn't see links that would just 403.

export const hasRole = (user, code) => Array.isArray(user?.roles) && user.roles.some((r) => r.code === code);

// Mirrors backend hasAbility: super_admin bypass; otherwise the user must hold the
// ability with a non-"no"/non-empty scope (abilities are stored as `ability:scope`).
export const hasAbility = (user, ability) => {
  if (hasRole(user, 'super_admin')) return true;
  if (!Array.isArray(user?.permissions)) return false;
  return user.permissions.some((p) => {
    const [name, scope] = String(p).split(':');
    if (name !== ability) return false;
    return scope === undefined || (scope !== 'no' && scope !== '');
  });
};

const CRUD = (base) => ({ base });
const FIXED = (ability) => ({ ability });

// Same section→ability map as backend admin.rbac.js (longer prefixes first).
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

// Required READ ability for an admin path (frontend paths mirror the backend /api/admin
// paths). null → the section is unmapped → super_admin-only.
const requiredReadAbility = (path) => {
  const p = String(path || '').replace(/^\/admin/, '') || '/';
  for (const [prefix, cfg] of SECTIONS) {
    if (p === prefix || p.startsWith(`${prefix}/`)) return cfg.ability || `${cfg.base}_read`;
  }
  return null;
};

// Can this user open the given admin path? super_admin always; the bare /admin dashboard
// needs any admin permission; mapped sections need the read ability; unmapped → false.
export const canAccessAdminPath = (user, path) => {
  if (hasRole(user, 'super_admin')) return true;
  const clean = String(path || '').split('?')[0].replace(/\/$/, '') || '/admin';
  if (clean === '/admin') return Array.isArray(user?.permissions) && user.permissions.length > 0;
  const ability = requiredReadAbility(clean);
  return ability ? hasAbility(user, ability) : false;
};

// True if the user has any admin reach at all (super_admin or any admin permission).
export const isAdminUser = (user) => hasRole(user, 'super_admin')
  || (Array.isArray(user?.permissions) && user.permissions.length > 0);
