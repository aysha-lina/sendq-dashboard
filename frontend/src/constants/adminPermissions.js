// Admin-group permission matrix — mirrors the original SendQ "Group options" screen.
// Each group is a resource; each field is a permission with an option set + default.
export const SCOPE = [
  { value: 'no', label: 'No' },
  { value: 'own', label: 'Own' },
  { value: 'all', label: 'All' },
];
export const BOOL = [
  { value: 'no', label: 'No' },
  { value: 'yes', label: 'Yes' },
];

const scope = (key, label, def = 'own') => ({ key, label, options: SCOPE, default: def });
const bool = (key, label, def = 'yes') => ({ key, label, options: BOOL, default: def });

export const PERMISSION_GROUPS = [
  { key: 'admin_group', label: 'Admin group', fields: [
    scope('read', 'Read', 'all'), bool('create', 'Create'), scope('update', 'Update', 'all'), scope('delete', 'Delete', 'own'),
  ] },
  { key: 'admin', label: 'Admin', fields: [
    scope('read', 'Read'), bool('create', 'Create'), scope('update', 'Update'), scope('delete', 'Delete'), scope('login_as', 'Login as'),
  ] },
  { key: 'customer', label: 'Customer', fields: [
    scope('read', 'Read'), bool('create', 'Create'), scope('update', 'Update'), scope('delete', 'Delete'), scope('login_as', 'Login as'),
  ] },
  { key: 'subscription', label: 'Subscription', fields: [
    scope('read', 'Read'), bool('create', 'Create'), scope('update', 'Update'), scope('disable', 'Disable'),
    scope('enable', 'Enable'), scope('delete', 'Delete'), scope('messages_paid', 'messages.paid'), scope('messages_unpaid', 'messages.unpaid'),
  ] },
  { key: 'plan', label: 'Plan', fields: [
    scope('read', 'Read'), bool('create', 'Create'), scope('update', 'Update'), scope('delete', 'Delete'), scope('copy', 'Copy', 'all'),
  ] },
  { key: 'payment_method', label: 'Payment method', fields: [
    bool('read', 'Read'), bool('update', 'Update'),
  ] },
  { key: 'sending_server', label: 'Sending server', fields: [
    scope('read', 'Read', 'all'), bool('create', 'Create'), scope('update', 'Update'), scope('delete', 'Delete'),
  ] },
  { key: 'bounce_handler', label: 'Bounce handler', fields: [
    scope('read', 'Read'), bool('create', 'Create'), scope('update', 'Update'), scope('delete', 'Delete'),
  ] },
  { key: 'fbl_handler', label: 'messages.fbl_handler', fields: [
    scope('read', 'Read'), bool('create', 'Create'), scope('update', 'Update'), scope('delete', 'Delete'),
  ] },
  { key: 'sending_domain', label: 'Sending domain', fields: [
    scope('read', 'Read'), bool('create', 'Create'), scope('update', 'Update'), scope('delete', 'Delete'),
  ] },
  { key: 'email_verification_server', label: 'Email verification server', fields: [
    scope('read', 'Read', 'all'), bool('create', 'Create'), scope('update', 'Update'), scope('delete', 'Delete'),
  ] },
  { key: 'template', label: 'Template', fields: [
    bool('read', 'Read'), bool('create', 'Create'), scope('update', 'Update'), scope('delete', 'Delete'),
  ] },
  { key: 'layout', label: 'Layout', fields: [
    bool('read', 'Read'), bool('update', 'Update'),
  ] },
  { key: 'setting', label: 'Setting', fields: [
    bool('general', 'General'), bool('sending', 'Sending'), bool('system_urls', 'System URLs'),
    bool('access_offline', 'Access when site is offline'), bool('background_job', 'Background Job'), bool('upgrade_manager', 'Upgrade Manager', 'no'),
  ] },
  { key: 'language', label: 'Language', fields: [
    bool('read', 'Read'), bool('create', 'Create'), bool('update', 'Update'), bool('delete', 'Delete'),
  ] },
  { key: 'currency', label: 'Currency', fields: [
    scope('read', 'Read'), bool('create', 'Create'), scope('update', 'Update'), scope('delete', 'Delete'),
  ] },
  { key: 'report', label: 'Report', fields: [
    bool('blacklist', 'Blacklist'), bool('delivery_log', 'Delivery log'), bool('bounce_log', 'Bounce log'), bool('feedback_log', 'Feedback log'),
    bool('open_log', 'Open log'), bool('click_log', 'Click log'), bool('unsubscribe_log', 'Unsubscribe log'),
  ] },
];

// Build the default permission map from each field's `default`.
export const defaultPermissions = () => {
  const out = {};
  PERMISSION_GROUPS.forEach((g) => {
    out[g.key] = {};
    g.fields.forEach((f) => { out[g.key][f.key] = f.default; });
  });
  return out;
};
