import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend,
} from 'recharts';
import AppLayout from '../../components/layout/AppLayout';
import { adminApi, authApi } from '../../api/services';
import { toast, Spinner } from '../../components/ui';
import useAuthStore from '../../store/authStore';
import useClickOutside from '../../hooks/useClickOutside';
import { getServerType } from '../../constants/sendingServerTypes';
import { useTranslation } from '../../i18n';

const sections = [
  { key: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { key: 'users', label: 'Users', icon: 'manage_accounts', api: 'users' },
  { key: 'admins', label: 'Administrators', icon: 'admin_panel_settings', api: 'admins' },
  { key: 'admin-groups', label: 'Admin groups', icon: 'groups', api: 'adminGroups' },
  { key: 'roles', label: 'Roles & permissions', icon: 'verified_user', api: 'roles' },
  { key: 'customers', label: 'Customers', icon: 'business', api: 'customers' },
  { key: 'subscriptions', label: 'Subscriptions', icon: 'sync', api: 'subscriptions' },
  { key: 'invoices', label: 'Invoices', icon: 'receipt_long', api: 'invoices' },
  { key: 'domains', label: 'Domains', icon: 'language', api: 'domains' },
  { key: 'plans', label: 'Plans', icon: 'price_check', api: 'plans' },
  { key: 'taxes', label: 'Taxes', icon: 'percent', api: 'taxes' },
  { key: 'invoice-templates', label: 'Invoice templates', icon: 'article', api: 'invoiceTemplates' },
  { key: 'public-view', label: 'Public view', icon: 'visibility', api: 'publicView' },
  { key: 'email-verification-plans', label: 'Email verification plans', icon: 'mark_email_read', api: 'emailVerificationPlans' },
  { key: 'sending-credit-plans', label: 'Sending credit plans', icon: 'send', api: 'sendingCreditPlans' },
  { key: 'payments', label: 'Payments', icon: 'payments', api: 'payments' },
  { key: 'payment-methods', label: 'Payment methods', icon: 'credit_card', api: 'paymentMethods' },
  { key: 'payment-services', label: 'Payment services', icon: 'account_balance_wallet', api: 'paymentServices' },
  { key: 'sending-servers', label: 'Sending servers', icon: 'dns', api: 'sendingServers' },
  { key: 'sending-domains', label: 'Sending domains', icon: 'language', api: 'sendingDomains' },
  { key: 'tracking-domains', label: 'Tracking domains', icon: 'travel_explore', api: 'trackingDomains' },
  { key: 'email-verification-servers', label: 'Email verification servers', icon: 'mark_email_read', api: 'emailVerificationServers' },
  { key: 'bounce-handlers', label: 'Bounce handlers', icon: 'undo', api: 'bounceHandlers' },
  { key: 'feedback-handlers', label: 'Feedback loop handlers', icon: 'feedback', api: 'feedbackHandlers' },
  { key: 'blacklist', label: 'Blacklist', icon: 'person_off', api: 'blacklist' },
  { key: 'signatures', label: 'Signatures', icon: 'draw', api: 'signatures' },
  { key: 'templates', label: 'Templates & layouts', icon: 'view_quilt', api: 'templates' },
  { key: 'settings', label: 'Settings', icon: 'settings', api: 'settings' },
  // 'mail-settings' hidden: transactional SMTP is set in backend/.env (dedicated
  // server) and campaign SMTP is under Sending servers — this form wasn't wired.
  { key: 'captcha', label: 'Captcha', icon: 'lock', api: 'captcha' },
  { key: 'appearance', label: 'Appearance', icon: 'palette', api: 'appearance' },
  { key: 'license', label: 'License', icon: 'verified', api: 'license' },
  { key: 'plugins', label: 'Plugins', icon: 'extension', api: 'plugins' },
  { key: 'languages', label: 'Languages', icon: 'translate', api: 'languages' },
  { key: 'currencies', label: 'Currencies', icon: 'currency_exchange', api: 'currencies' },
  { key: 'reports', label: 'Reports', icon: 'monitoring', api: 'reports' },
  { key: 'tracking-log', label: 'Tracking log', icon: 'query_stats', api: 'trackingLog' },
  { key: 'open-log', label: 'Open log', icon: 'drafts', api: 'openLog' },
  { key: 'click-log', label: 'Click log', icon: 'ads_click', api: 'clickLog' },
  { key: 'bounce-log', label: 'Bounce log', icon: 'outgoing_mail', api: 'bounceLog' },
  { key: 'feedback-log', label: 'Feedback log', icon: 'feedback', api: 'feedbackLog' },
  { key: 'unsubscribe-log', label: 'Unsubscribe log', icon: 'unsubscribe', api: 'unsubscribeLog' },
  { key: 'notifications', label: 'Notifications', icon: 'notifications', api: 'notifications' },
  { key: 'logs', label: 'System logs', icon: 'history', api: 'logs' },
];

const _metricLabels = {
  users: 'Users',
  admins: 'Administrators',
  adminGroups: 'Admin groups',
  roles: 'Roles',
  customers: 'Customers',
  subscriptions: 'Subscriptions',
  plans: 'Plans',
  campaigns: 'Campaigns',
  lists: 'Lists',
  subscribers: 'Subscribers',
  emailLogs: 'Email logs',
  openLogs: 'Open logs',
  clickLogs: 'Click logs',
  bounceLogs: 'Bounce logs',
};

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
};

// "5 months ago" relative time (mirrors PHP diffForHumans).
const timeAgo = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const secs = Math.max(1, Math.floor((Date.now() - date.getTime()) / 1000));
  const units = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]];
  for (const [label, s] of units) {
    const n = Math.floor(secs / s);
    if (n >= 1) return `${n} ${label}${n > 1 ? 's' : ''} ago`;
  }
  return 'just now';
};

const valueText = (value) => {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return '-';
  return String(value);
};

const pickName = (row) => (
  row.name ||
  row.email ||
  [row.first_name, row.last_name].filter(Boolean).join(' ') ||
  row.user?.email ||
  row.customer?.first_name ||
  row.plan?.name ||
  '-'
);

const columnsFor = (sectionKey) => {
  const common = [
    { key: 'name', label: 'Name', render: pickName },
    { key: 'status', label: 'Status', render: (row) => row.status || '-' },
    { key: 'created_at', label: 'Created at', render: (row) => formatDate(row.created_at) },
  ];

  const map = {
    users: [
      { key: 'email', label: 'Email', render: (row) => row.email || '-' },
      { key: 'name', label: 'Name', render: pickName },
      { key: 'status', label: 'Status', render: (row) => row.status || '-' },
      { key: 'created_at', label: 'Created at', render: (row) => formatDate(row.created_at) },
    ],
    admins: [
      { key: 'name', label: 'Administrator', render: pickName },
      { key: 'email', label: 'Email', render: (row) => row.user?.email || '-' },
      { key: 'group', label: 'Group', render: (row) => row.adminGroup?.name || '-' },
      { key: 'status', label: 'Status', render: (row) => row.status || '-' },
    ],
    'admin-groups': [
      { key: 'name', label: 'Group', render: (row) => row.name || '-' },
      { key: 'permissions', label: 'Permissions', render: (row) => row.permissions ? 'Configured' : '-' },
      { key: 'created_at', label: 'Created at', render: (row) => formatDate(row.created_at) },
    ],
    roles: [
      { key: 'name', label: 'Role', render: (row) => row.name || row.code || '-' },
      { key: 'code', label: 'Code', render: (row) => row.code || '-' },
      { key: 'permissions', label: 'Permissions', render: (row) => row.rolePermissions?.length || 0 },
      { key: 'status', label: 'Status', render: (row) => row.status || '-' },
    ],
    customers: [
      { key: 'name', label: 'Customer', render: pickName },
      { key: 'email', label: 'Email', render: (row) => row.user?.email || '-' },
      { key: 'status', label: 'Status', render: (row) => (
        <span className={`admin-status-badge admin-status-${row.status || 'unknown'}`}>{row.status || '-'}</span>
      )},
      { key: 'created_at', label: 'Created at', render: (row) => formatDate(row.created_at) },
    ],
    subscriptions: [
      { key: 'customer', label: 'Customer', render: (row) => pickName(row.customer || {}) },
      { key: 'plan', label: 'Plan', render: (row) => row.plan?.name || '-' },
      { key: 'status', label: 'Status', render: (row) => (
        <span className={`admin-status-badge admin-status-${row.status || 'unknown'}`}>{row.status || '-'}</span>
      )},
      { key: 'ends_at', label: 'Ends at', render: (row) => formatDate(row.ends_at) },
    ],
    plans: [
      { key: 'name', label: 'Plan', render: (row) => row.name || '-' },
      { key: 'daily_email_limit', label: 'Daily limit', render: (row) => valueText(row.daily_email_limit) },
      { key: 'status', label: 'Status', render: (row) => (
        <span className={`admin-status-badge admin-status-${row.status || 'unknown'}`}>{row.status || '-'}</span>
      )},
      { key: 'created_at', label: 'Created at', render: (row) => formatDate(row.created_at) },
    ],
    currencies: [
      { key: 'name', label: 'Name', render: (row) => row.name || '-' },
      { key: 'code', label: 'Code', render: (row) => row.code || '-' },
      { key: 'format', label: 'Format', render: (row) => valueText(row.format) },
      { key: 'status', label: 'Status', render: (row) => (
        <span className={`admin-status-badge admin-status-${row.status || 'unknown'}`}>{row.status || '-'}</span>
      )},
    ],
    settings: [
      { key: 'name', label: 'Name', render: (row) => row.name || '-' },
      { key: 'value', label: 'Value', render: (row) => valueText(row.value) },
      { key: 'updated_at', label: 'Updated at', render: (row) => formatDate(row.updated_at) },
    ],
    blacklist: [
      { key: 'email', label: 'Email', render: (row) => row.email || '-' },
      { key: 'reason', label: 'Reason', render: (row) => valueText(row.reason) },
      { key: 'created_at', label: 'Created at', render: (row) => formatDate(row.created_at) },
    ],
    signatures: [
      { key: 'name', label: 'Name', render: (row) => row.name || '-' },
      { key: 'is_default', label: 'Default', render: (row) => (row.is_default ? 'Yes' : 'No') },
      { key: 'status', label: 'Status', render: (row) => row.status || '-' },
      { key: 'created_at', label: 'Created at', render: (row) => formatDate(row.created_at) },
    ],
    'sending-servers': [
      { key: 'name', label: 'Name', render: (row) => row.name || '-' },
      { key: 'type', label: 'Type', render: (row) => row.type || '-' },
      { key: 'host', label: 'Host', render: (row) => valueText(row.host) },
      { key: 'status', label: 'Status', render: (row) => row.status || '-' },
    ],
    'sending-domains': [
      { key: 'name', label: 'Domain', render: (row) => row.name || '-' },
      { key: 'status', label: 'Status', render: (row) => row.status || '-' },
      { key: 'created_at', label: 'Created at', render: (row) => formatDate(row.created_at) },
    ],
    'tracking-domains': [
      { key: 'name', label: 'Domain', render: (row) => row.name || '-' },
      { key: 'scheme', label: 'Scheme', render: (row) => row.scheme || '-' },
      { key: 'status', label: 'Status', render: (row) => row.status || '-' },
    ],
    'email-verification-servers': [
      { key: 'name', label: 'Name', render: (row) => row.name || '-' },
      { key: 'type', label: 'Type', render: (row) => row.type || '-' },
      { key: 'status', label: 'Status', render: (row) => row.status || '-' },
    ],
    'sending-credit-plans': [
      { key: 'name', label: 'Name', render: (row) => row.name || '-' },
      { key: 'status', label: 'Status', render: (row) => row.status || '-' },
      { key: 'created_at', label: 'Created at', render: (row) => formatDate(row.created_at) },
    ],
    payments: [
      { key: 'customer', label: 'Customer', render: (row) => pickName(row.customer || {}) },
      { key: 'amount', label: 'Amount', render: (row) => valueText(row.amount) },
      { key: 'status', label: 'Status', render: (row) => row.status || '-' },
      { key: 'created_at', label: 'Date', render: (row) => formatDate(row.created_at) },
    ],
    'payment-methods': [
      { key: 'name', label: 'Name', render: (row) => row.name || valueText(row.type) },
      { key: 'status', label: 'Status', render: (row) => row.status || '-' },
      { key: 'created_at', label: 'Created at', render: (row) => formatDate(row.created_at) },
    ],
    'payment-services': [
      { key: 'name', label: 'Name', render: (row) => row.name || valueText(row.type) },
      { key: 'status', label: 'Status', render: (row) => row.status || '-' },
      { key: 'created_at', label: 'Created at', render: (row) => formatDate(row.created_at) },
    ],
    invoices: [
      { key: 'customer', label: 'Customer', render: (row) => pickName(row.customer || {}) },
      { key: 'total', label: 'Total', render: (row) => valueText(row.total ?? row.amount) },
      { key: 'status', label: 'Status', render: (row) => row.status || '-' },
      { key: 'created_at', label: 'Date', render: (row) => formatDate(row.created_at) },
    ],
    templates: [
      { key: 'name', label: 'Template', render: (row) => row.name || '-' },
      { key: 'customer', label: 'Owner', render: (row) => (row.shared ? 'System' : pickName(row.customer || {})) },
      { key: 'created_at', label: 'Created at', render: (row) => formatDate(row.created_at) },
    ],
    domains: [
      { key: 'name', label: 'Domain', render: (row) => row.name || '-' },
      { key: 'customer', label: 'Customer', render: (row) => pickName(row.customer || {}) },
      { key: 'status', label: 'Status', render: (row) => row.status || '-' },
    ],
    notifications: [
      { key: 'title', label: 'Title', render: (row) => row.title || '-' },
      { key: 'level', label: 'Level', render: (row) => valueText(row.level) },
      { key: 'created_at', label: 'Date', render: (row) => formatDate(row.created_at) },
    ],
    logs: [
      { key: 'name', label: 'Event', render: (row) => row.name || '-' },
      { key: 'type', label: 'Type', render: (row) => row.type || '-' },
      { key: 'customer', label: 'Customer', render: (row) => pickName(row.customer || {}) },
      { key: 'created_at', label: 'Date', render: (row) => formatDate(row.created_at) },
    ],
    'tracking-log': [
      { key: 'campaign', label: 'Campaign', render: (row) => row.campaign?.name || '-' },
      { key: 'subscriber', label: 'Subscriber', render: (row) => row.subscriber?.email || '-' },
      { key: 'status', label: 'Status', render: (row) => row.status || '-' },
      { key: 'created_at', label: 'Date', render: (row) => formatDate(row.created_at) },
    ],
    'open-log': [
      { key: 'campaign', label: 'Campaign', render: (row) => row.campaign?.name || '-' },
      { key: 'subscriber', label: 'Subscriber', render: (row) => row.subscriber?.email || '-' },
      { key: 'ip', label: 'IP', render: (row) => valueText(row.ip) },
      { key: 'created_at', label: 'Date', render: (row) => formatDate(row.created_at) },
    ],
    'click-log': [
      { key: 'campaign', label: 'Campaign', render: (row) => row.campaign?.name || '-' },
      { key: 'subscriber', label: 'Subscriber', render: (row) => row.subscriber?.email || '-' },
      { key: 'url', label: 'URL', render: (row) => valueText(row.url) },
      { key: 'created_at', label: 'Date', render: (row) => formatDate(row.created_at) },
    ],
    'bounce-log': [
      { key: 'campaign', label: 'Campaign', render: (row) => row.campaign?.name || '-' },
      { key: 'subscriber', label: 'Subscriber', render: (row) => row.subscriber?.email || '-' },
      { key: 'reason', label: 'Reason', render: (row) => valueText(row.reason) },
      { key: 'created_at', label: 'Date', render: (row) => formatDate(row.created_at) },
    ],
    'unsubscribe-log': [
      { key: 'campaign', label: 'Campaign', render: (row) => row.campaign?.name || '-' },
      { key: 'subscriber', label: 'Subscriber', render: (row) => row.subscriber?.email || '-' },
      { key: 'ip_address', label: 'IP', render: (row) => valueText(row.ip_address) },
      { key: 'created_at', label: 'Date', render: (row) => formatDate(row.created_at) },
    ],
    'feedback-log': [
      { key: 'campaign', label: 'Campaign', render: (row) => row.campaign?.name || '-' },
      { key: 'subscriber', label: 'Subscriber', render: (row) => row.subscriber?.email || '-' },
      { key: 'feedback_type', label: 'Type', render: (row) => valueText(row.feedback_type) },
      { key: 'created_at', label: 'Date', render: (row) => formatDate(row.created_at) },
    ],
  };

  return map[sectionKey] || common;
};

// ─── Plan modal ───────────────────────────────────────────────────────────────
const PlanModal = ({ plan, onSave, onClose }) => {
  const { t } = useTranslation();
  const [name, setName] = useState(plan?.name || '');
  const [dailyLimit, setDailyLimit] = useState(String(plan?.daily_email_limit ?? 100));
  const [description, setDescription] = useState(plan?.description || '');
  const [status, setStatus] = useState(plan?.status || 'active');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!name.trim()) { setError(t('adm.plan_name_required', null, 'Plan name is required.')); return; }
    setSaving(true);
    setError('');
    try {
      await onSave({ name: name.trim(), daily_email_limit: Number(dailyLimit) || 100, description: description || null, status });
    } catch (err) {
      setError(err.response?.data?.message || t('adm.save_failed', null, 'Save failed.'));
      setSaving(false);
    }
  };

  return (
    <div className="admin-modal-backdrop" onMouseDown={onClose}>
      <div className="admin-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="admin-modal-head">
          <h2>{plan ? t('adm.edit_plan', null, 'Edit plan') : t('adm.create_plan', null, 'Create plan')}</h2>
          <button type="button" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {error && <p className="admin-modal-error">{error}</p>}
        <div className="admin-modal-body">
          <label className="admin-modal-label">
            {t('common.name', null, 'Name')} <em>*</em>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Starter" />
          </label>
          <label className="admin-modal-label">
            {t('adm.daily_email_limit', null, 'Daily email limit')}
            <input className="input" type="number" min="0" value={dailyLimit} onChange={(e) => setDailyLimit(e.target.value)} />
          </label>
          <label className="admin-modal-label">
            {t('adm.description', null, 'Description')}
            <textarea className="input admin-modal-textarea" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </label>
          <label className="admin-modal-label">
            {t('common.status', null, 'Status')}
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="active">{t('adm.status_active', null, 'Active')}</option>
              <option value="inactive">{t('adm.status_inactive', null, 'Inactive')}</option>
            </select>
          </label>
        </div>
        <div className="admin-modal-actions">
          <button type="button" className="btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? t('adm.saving', null, 'Saving…') : plan ? t('adm.save_changes', null, 'Save changes') : t('adm.create_plan', null, 'Create plan')}
          </button>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>{t('common.cancel', null, 'Cancel')}</button>
        </div>
      </div>
    </div>
  );
};

// ─── Assign plan modal ────────────────────────────────────────────────────────
const planPrice = (plan) => {
  const n = Number(plan.price);
  return Number.isFinite(n) ? (Number.isInteger(n) ? n : n.toFixed(2)) : 0;
};
const planFrequency = (plan) => {
  const amount = plan.frequency_amount || 1;
  const unit = plan.frequency_unit || (Number(plan.price) > 0 ? 'month' : 'year');
  return `${amount} ${unit}`;
};
const planCurrency = (plan) => plan.currency?.code || plan.currency_code || 'OMR';

const AssignPlanModal = ({ customer, onAssign, onClose }) => {
  const { t } = useTranslation();
  const [plans, setPlans] = useState([]);
  const [confirm, setConfirm] = useState(null); // selected plan pending confirmation
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    adminApi.plans({ per_page: 100 })
      .then(({ data }) => setPlans((data.data || []).filter((p) => p.status !== 'inactive')))
      .catch(() => setPlans([]));
  }, []);

  const customerName = customer ? (`${customer.first_name || ''} ${customer.last_name || ''}`.trim() || customer.user?.email || 'this customer') : 'this customer';

  const doAssign = async () => {
    setSaving(true);
    setError('');
    try {
      await onAssign(Number(confirm.id), null);
    } catch (err) {
      setError(err.response?.data?.message || t('adm.assign_failed', null, 'Assign failed.'));
      setSaving(false);
      setConfirm(null);
    }
  };

  return (
    <div className="plan-picker-backdrop" onMouseDown={onClose}>
      <div className="plan-picker" onMouseDown={(e) => e.stopPropagation()}>
        <div className="plan-picker-head">
          <span className="plan-picker-eyebrow">{t('adm.billing_information', null, 'Billing information')}</span>
          <button type="button" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="plan-picker-body">
          <h2 className="plan-picker-title">{t('adm.select_a_plan', null, 'Select a Plan')}</h2>
          <p className="plan-picker-intro">{t('adm.select_plan_intro', null, 'Select the plan you want to change below. Changing plan can be un-done so make sure you want to change.')}</p>
          {error && <p className="admin-modal-error">{error}</p>}

          {plans.length === 0 ? (
            <AdminEmpty text={t('adm.no_plans_yet', null, 'There are no plans yet')} />
          ) : (
            <div className="plan-card-grid">
              {plans.map((plan) => (
                <div key={plan.id} className="plan-card">
                  <h3 className="plan-card-name">{plan.name}</h3>
                  {plan.description && <p className="plan-card-desc">{plan.description}</p>}
                  <div className="plan-card-price">
                    <span className="plan-card-starting">{t('adm.starting_at', null, 'Starting At')}</span>
                    <span className="plan-card-amount">{planCurrency(plan)} {planPrice(plan)}</span>
                    <span className="plan-card-freq">{planFrequency(plan)}</span>
                  </div>
                  <button type="button" className="btn-secondary plan-card-select" onClick={() => setConfirm(plan)}>{t('adm.select', null, 'Select')}</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {confirm && (
        <div className="plan-confirm-backdrop" onMouseDown={() => !saving && setConfirm(null)}>
          <div className="plan-confirm" onMouseDown={(e) => e.stopPropagation()}>
            <div className="plan-confirm-head">
              <span><span className="material-symbols-rounded">help</span> {t('adm.are_you_sure', null, 'Are you sure?')}</span>
              <button type="button" onClick={() => !saving && setConfirm(null)} aria-label="Close">✕</button>
            </div>
            <div className="plan-confirm-body">
              <p>
                {t('adm.assign_confirm_pre', null, "You're about to assign")} <strong>{confirm.name}</strong> {t('adm.assign_confirm_mid', null, 'plan to')} <strong>{customerName}</strong>.
                {' '}{t('adm.assign_confirm_post', null, "This will cancel customer's current subscription if it exists. This can be undone.")}
              </p>
            </div>
            <div className="plan-confirm-actions">
              <button type="button" className="plan-confirm-cancel" onClick={() => setConfirm(null)} disabled={saving}>{t('common.cancel', null, 'Cancel')}</button>
              <button type="button" className="btn-primary" onClick={doAssign} disabled={saving}>{saving ? t('adm.assigning', null, 'Assigning…') : t('adm.confirm', null, 'Confirm')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Generic resource config + modal ───────────────────────────────────────────
// Each entry turns an admin section into a real CRUD module. `fields` drives the
// form; `api` maps to the adminApi methods; `save` overrides create/update when a
// module needs custom persistence (e.g. settings key/value upsert).
const resourceConfigs = {
  'sending-credit-plans': {
    label: 'Sending credit plan',
    createLabel: 'Add new Plan',
    save: (data, editing) => (editing ? adminApi.updateSendingCreditPlan(editing.uid, data) : adminApi.createSendingCreditPlan(data)),
    fields: [
      { name: 'name', label: 'Name', required: true, placeholder: 'Extra 10k credits' },
      { name: 'description', label: 'Description', type: 'textarea' },
      { name: 'credits', label: 'Sending credits', placeholder: '10000' },
      { name: 'price', label: 'Price', placeholder: '0' },
    ],
  },
  roles: {
    label: 'Role',
    createLabel: 'Add role',
    save: (data, editing) => (editing ? adminApi.updateRole(editing.uid, data) : adminApi.createRole(data)),
    fields: [
      { name: 'name', label: 'Name', required: true, placeholder: 'Marketing manager' },
      { name: 'description', label: 'Description', type: 'textarea', placeholder: 'What this role is for' },
      { name: 'status', label: 'Status', type: 'select', options: ['active', 'inactive'], default: 'active' },
    ],
  },
  currencies: {
    label: 'Currency',
    createLabel: 'Add currency',
    api: {
      create: adminApi.createCurrency,
      update: adminApi.updateCurrency,
      remove: adminApi.deleteCurrency,
    },
    fields: [
      { name: 'name', label: 'Name', required: true, placeholder: 'US Dollar' },
      { name: 'code', label: 'Code', required: true, placeholder: 'USD' },
      { name: 'format', label: 'Format', required: true, placeholder: '$#,###.##' },
      { name: 'status', label: 'Status', type: 'select', options: ['active', 'inactive'], default: 'active' },
    ],
  },
  settings: {
    label: 'Setting',
    createLabel: 'New setting',
    save: (data) => adminApi.updateSettings({ settings: [data] }),
    fields: [
      { name: 'name', label: 'Name', required: true, lockOnEdit: true, placeholder: 'site_name' },
      { name: 'value', label: 'Value', type: 'textarea', placeholder: 'Value' },
    ],
  },
  blacklist: {
    label: 'Blacklist entry',
    api: {
      create: adminApi.createBlacklist,
      remove: adminApi.deleteBlacklist,
    },
    fields: [
      { name: 'email', label: 'Email', required: true, placeholder: 'spammer@example.com' },
      { name: 'reason', label: 'Reason', type: 'textarea', placeholder: 'Why is this address blacklisted?' },
    ],
  },
  // Delete-only module (notifications are system-generated, not hand-created).
  notifications: {
    label: 'Notification',
    api: { remove: adminApi.deleteNotification },
    fields: [],
  },
  'sending-servers': {
    label: 'Sending server',
    api: {
      create: adminApi.createSendingServer,
      update: adminApi.updateSendingServer,
      remove: adminApi.deleteSendingServer,
    },
    fields: [
      { name: 'name', label: 'Name', required: true, placeholder: 'My SMTP server' },
      {
        name: 'type',
        label: 'Type',
        type: 'select',
        default: 'smtp',
        options: ['smtp', 'sendmail', 'amazon-ses', 'mailgun', 'sendgrid', 'sparkpost', 'elasticemail', 'blastengine'],
      },
      // SMTP
      { name: 'host', label: 'Host', placeholder: 'smtp.example.com', showIf: (f) => f.type === 'smtp' },
      { name: 'smtp_username', label: 'SMTP username', showIf: (f) => f.type === 'smtp' },
      { name: 'smtp_password', label: 'SMTP password', showIf: (f) => f.type === 'smtp' },
      { name: 'smtp_port', label: 'SMTP port', placeholder: '587', showIf: (f) => f.type === 'smtp' },
      { name: 'smtp_protocol', label: 'Encryption', type: 'select', options: ['', 'ssl', 'tls'], showIf: (f) => f.type === 'smtp' },
      // Sendmail
      { name: 'sendmail_path', label: 'Sendmail path', placeholder: '/usr/sbin/sendmail', showIf: (f) => f.type === 'sendmail' },
      // Amazon SES
      { name: 'aws_access_key_id', label: 'AWS access key ID', showIf: (f) => f.type === 'amazon-ses' },
      { name: 'aws_secret_access_key', label: 'AWS secret access key', showIf: (f) => f.type === 'amazon-ses' },
      { name: 'aws_region', label: 'AWS region', placeholder: 'us-east-1', showIf: (f) => f.type === 'amazon-ses' },
      // API providers
      { name: 'domain', label: 'Domain', showIf: (f) => ['mailgun'].includes(f.type) },
      { name: 'api_key', label: 'API key', showIf: (f) => ['mailgun', 'sendgrid', 'sparkpost', 'elasticemail', 'blastengine'].includes(f.type) },
      { name: 'username', label: 'Username', showIf: (f) => f.type === 'blastengine' },
      { name: 'api_secret_key', label: 'API secret key', showIf: (f) => f.type === 'blastengine' },
      // Quota + status (all types)
      { name: 'quota_value', label: 'Quota value', placeholder: '1000', default: '1000' },
      { name: 'quota_base', label: 'Quota base', placeholder: '1', default: '1' },
      { name: 'quota_unit', label: 'Quota unit', type: 'select', options: ['minute', 'hour', 'day', 'week', 'month'], default: 'hour' },
      { name: 'status', label: 'Status', type: 'select', options: ['active', 'inactive'], default: 'active' },
    ],
  },
};

// Capability helpers — a module may support only some of create/update/delete.
const canCreate = (cfg) => Boolean(cfg && (cfg.save || cfg.api?.create));
const canUpdate = (cfg) => Boolean(cfg && (cfg.save || cfg.api?.update));
const canDelete = (cfg) => Boolean(cfg && cfg.api?.remove);

const ResourceModal = ({ config, record, onSave, onClose }) => {
  const { t } = useTranslation();
  const editing = Boolean(record);
  const [form, setForm] = useState(() => config.fields.reduce((acc, field) => {
    acc[field.name] = record?.[field.name] ?? field.default ?? '';
    return acc;
  }, {}));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const setField = (name, value) => setForm((prev) => ({ ...prev, [name]: value }));

  const handleSubmit = async () => {
    const missing = config.fields.filter((f) => f.required && !String(form[f.name] ?? '').trim());
    if (missing.length) {
      setError(t('adm.fields_required', { fields: missing.map((f) => f.label).join(', ') }, `${missing.map((f) => f.label).join(', ')} required.`));
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave(form);
    } catch (err) {
      setError(err.response?.data?.message || t('adm.save_failed', null, 'Save failed.'));
      setSaving(false);
    }
  };

  return (
    <div className="admin-modal-backdrop" onClick={onClose}>
      <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-head">
          <h3>{editing ? t('adm.edit_resource', { label: config.label.toLowerCase() }, `Edit ${config.label.toLowerCase()}`) : t('adm.new_resource', { label: config.label.toLowerCase() }, `New ${config.label.toLowerCase()}`)}</h3>
          <button type="button" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {config.fields.filter((field) => !field.showIf || field.showIf(form)).map((field) => (
          <label key={field.name} className="admin-modal-field">
            <span>{field.label}{field.required ? ' *' : ''}</span>
            {field.type === 'select' ? (
              <select value={form[field.name]} onChange={(e) => setField(field.name, e.target.value)}>
                {(field.options || []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            ) : field.type === 'textarea' ? (
              <textarea
                rows={4}
                value={form[field.name]}
                placeholder={field.placeholder}
                onChange={(e) => setField(field.name, e.target.value)}
              />
            ) : (
              <input
                type="text"
                value={form[field.name]}
                placeholder={field.placeholder}
                disabled={editing && field.lockOnEdit}
                onChange={(e) => setField(field.name, e.target.value)}
              />
            )}
          </label>
        ))}
        {error && <p className="admin-modal-error">{error}</p>}
        <div className="admin-modal-actions">
          <button type="button" className="btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? t('adm.saving', null, 'Saving…') : t('common.save', null, 'Save')}
          </button>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>{t('common.cancel', null, 'Cancel')}</button>
        </div>
      </div>
    </div>
  );
};

// ─── Admin table ──────────────────────────────────────────────────────────────
const AdminEmpty = ({ text = 'No records found' }) => (
  <div className="admin-empty">
    <span className="material-symbols-rounded">auto_awesome</span>
    <p>{text}</p>
  </div>
);

const AdminTable = ({ sectionKey, rows, message, renderActions }) => {
  const { t } = useTranslation();
  const columns = columnsFor(sectionKey);

  if (!rows?.length) {
    return <AdminEmpty text={message || t('adm.no_records_found', null, 'No records found')} />;
  }

  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            {columns.map((column) => <th key={column.key}>{column.label}</th>)}
            {renderActions && <th className="admin-actions-th">{t('common.actions', null, 'Actions')}</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.uid || row.id || index}>
              {columns.map((column) => (
                <td key={column.key}>{column.render ? column.render(row) : valueText(row[column.key])}</td>
              ))}
              {renderActions && <td className="admin-actions-td">{renderActions(row)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ─── Dashboard sub-components ─────────────────────────────────────────────────
const _maxChartValue = (rows) => Math.max(1, ...rows.map((row) => Number(row.value) || 0));

const MiniBarChart = ({ rows = [], title }) => {
  const { t } = useTranslation();
  return (
  <div className="admin-chart-card">
    <h3>{title || t('adm.customers_growth', null, 'Customers growth')}</h3>
    {rows.some((r) => (Number(r.value) || 0) > 0) ? (
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={rows} margin={{ top: 10, right: 16, bottom: 4, left: -12 }}>
          <XAxis dataKey="label" stroke="#9aa0b5" tickLine={false} fontSize={12} />
          <YAxis stroke="#9aa0b5" tickLine={false} allowDecimals={false} fontSize={12} />
          <Tooltip cursor={{ fill: 'rgba(125,130,160,0.1)' }} />
          <Bar dataKey="value" name="Subscribers" fill="#86b87f" radius={[3, 3, 0, 0]} barSize={64} />
        </BarChart>
      </ResponsiveContainer>
    ) : (
      <AdminEmpty text={t('adm.no_customer_growth_data', null, 'No customer growth data yet')} />
    )}
  </div>
  );
};

const PIE_COLORS = ['#4fc3c0', '#c46a86', '#b6c06a', '#6f8ed0', '#9b6fc0', '#d0966a', '#6ac09b'];
const MiniPlanChart = ({ rows = [] }) => {
  const { t } = useTranslation();
  const total = rows.reduce((sum, row) => sum + (Number(row.value) || 0), 0);
  return (
    <div className="admin-chart-card">
      <h3>{t('adm.manage_plans', null, 'Manage Plans')}</h3>
      {total ? (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={rows}
              dataKey="value"
              nameKey="label"
              outerRadius={110}
              label={({ name, percent }) => `${name} ${Math.round(percent * 100)}%`}
              stroke="#2a2a40"
              strokeWidth={2}
            >
              {rows.map((row, i) => <Cell key={row.label} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <AdminEmpty text={t('adm.no_plans_yet', null, 'There are no plans yet')} />
      )}
    </div>
  );
};

const customerName = (c) => `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Customer';

// Build a human activity message from an audit-log row (mirrors PHP log messages).
const activityMessage = (a) => {
  const verb = { create: 'created', update: 'updated', delete: 'deleted' };
  const action = Object.keys(verb).find((k) => (a.type || '').includes(k));
  const label = (a.type || 'record').replace(/[._]/g, ' ');
  return `${label}${a.name ? ` "${a.name}"` : ''} was ${verb[action] || 'updated'}`;
};

const RecentList = ({ icon, title, intro, children }) => (
  <div className="admin-recent-col">
    <h4 className="admin-recent-title"><span className="material-symbols-rounded">{icon}</span> {title}</h4>
    <p className="admin-recent-intro">{intro}</p>
    {children}
  </div>
);

const ReportsPanel = ({ data }) => {
  const { t } = useTranslation();
  if (!data) return <AdminEmpty text={t('adm.no_report_data', null, 'No report data found')} />;
  return (
    <div className="admin-report-grid">
      {Object.entries(data).map(([key, value]) => (
        <article key={key} className="admin-report-card">
          <span>{valueText(value)}</span>
          <p>{key.replaceAll('_', ' ')}</p>
        </article>
      ))}
    </div>
  );
};

const RESOURCE_STATS_LEFT = [
  ['customers', 'people_outline', 'Customers'],
  ['subscriptions', 'assignment_turned_in', 'Subscriptions'],
  ['plans', 'assignment_turned_in', 'Manage Plans'],
  ['lists', 'contact_mail', 'Lists'],
  ['subscribers', 'people_outline', 'Subscribers'],
];
const RESOURCE_STATS_RIGHT = [
  ['admins', 'manage_accounts', 'Admins'],
  ['adminGroups', 'people', 'Admin groups'],
  ['sendingServers', 'dns', 'Sending servers'],
  ['sendingDomains', 'public', 'Sending domains'],
  ['campaigns', 'forward_to_inbox', 'Campaigns'],
];

const ResourceStatList = ({ rows, summary }) => (
  <ul className="admin-resource-list">
    {rows.map(([key, icon, label]) => (
      <li key={key}>
        <span className="admin-resource-label"><span className="material-symbols-rounded">{icon}</span> {label}</span>
        <strong>{Number(summary[key] || 0).toLocaleString()}</strong>
      </li>
    ))}
  </ul>
);

// ─── Admin plans (PHP clone of admin/plans) ──────────────────────────────────────
const BILLING_CYCLES = [
  { label: 'Monthly', amount: '1', unit: 'month' },
  { label: 'Quarterly', amount: '3', unit: 'month' },
  { label: 'Yearly', amount: '1', unit: 'year' },
  { label: 'Weekly', amount: '1', unit: 'week' },
  { label: 'Daily', amount: '1', unit: 'day' },
];
const cycleLabel = (amount, unit) => `${amount || 1} ${unit || 'month'}`;
const deliveryLabel = (d) => {
  if (d === 'customer') return "Use customer's delivery servers";
  if (d === 'none') return 'No delivery server selected';
  return 'Use SMTP for email delivery';
};
const creditsLabel = (c) => (c === 'unlimited' || c == null ? 'Unlimited' : Number(c).toLocaleString());

const CreatePlanModal = ({ onClose, onCreated }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [currencies, setCurrencies] = useState([]);
  const [form, setForm] = useState({ name: '', description: '', price: 0, cycle: 'Monthly', currency_id: '', trial: false, trial_amount: 1, trial_unit: 'day' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    adminApi.currencies({ per_page: 100 })
      .then(({ data }) => {
        const list = data.data || [];
        setCurrencies(list);
        const omr = list.find((c) => (c.code || '').toUpperCase() === 'OMR');
        setForm((f) => ({ ...f, currency_id: String((omr || list[0])?.id || '') }));
      })
      .catch(() => setCurrencies([]));
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name.trim()) { setError(t('adm.plan_name_required', null, 'Plan name is required.')); return; }
    const cyc = BILLING_CYCLES.find((c) => c.label === form.cycle) || BILLING_CYCLES[0];
    setSaving(true); setError('');
    try {
      const { data } = await adminApi.createPlan({
        name: form.name,
        description: form.description,
        price: form.price,
        frequency_amount: cyc.amount,
        frequency_unit: cyc.unit,
        currency_id: form.currency_id || null,
        trial_amount: form.trial ? form.trial_amount : null,
        trial_unit: form.trial ? form.trial_unit : null,
      });
      onCreated?.();
      navigate(`/admin/plans/${data.uid}/edit`);
    } catch (err) {
      setError(err.response?.data?.message || t('adm.could_not_create_plan', null, 'Could not create the plan.'));
      setSaving(false);
    }
  };

  return (
    <div className="plan-dialog-backdrop" onMouseDown={onClose}>
      <div className="plan-dialog" onMouseDown={(e) => e.stopPropagation()}>
        <div className="plan-dialog-head">
          <span>{t('adm.add_a_new_plan', null, 'Add a new plan')}</span>
          <button type="button" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="plan-dialog-body">
          <h2 className="sq-section-title">{t('adm.plan_details', null, 'Plan Details')}</h2>
          <p className="plan-dialog-intro">{t('adm.plan_details_intro', null, 'A plan, or service plan, is the group of services and limits that you have agreed to provide to your customer. A plan allows you to centrally plan and standardize your service offerings. Set up your plan details below:')}</p>
          {error && <p className="admin-modal-error">{error}</p>}

          <label className="admin-detail-field admin-detail-field-full"><span>{t('common.name', null, 'Name')}</span>
            <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} /></label>
          <label className="admin-detail-field admin-detail-field-full"><span>{t('adm.description', null, 'Description')}</span>
            <input className="input" value={form.description} onChange={(e) => set('description', e.target.value)} /></label>
          <label className="admin-detail-field admin-detail-field-full"><span>{t('adm.price', null, 'Price')}</span>
            <input className="input" type="number" value={form.price} onChange={(e) => set('price', e.target.value)} /></label>
          <label className="admin-detail-field admin-detail-field-full"><span>{t('adm.billing_cycle', null, 'Billing cycle')}</span>
            <select className="input" value={form.cycle} onChange={(e) => set('cycle', e.target.value)}>
              {BILLING_CYCLES.map((c) => <option key={c.label} value={c.label}>{c.label}</option>)}
            </select></label>
          <label className="admin-detail-field admin-detail-field-full"><span>{t('adm.currency', null, 'Currency')}</span>
            <select className="input" value={form.currency_id} onChange={(e) => set('currency_id', e.target.value)}>
              {currencies.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
            </select></label>

          <label className="plan-dialog-check">
            <input type="checkbox" checked={form.trial} onChange={(e) => set('trial', e.target.checked)} /> {t('adm.enable_trial_period', null, 'Enable trial period')}
          </label>
          {form.trial && (
            <div className="plan-dialog-trial">
              <span>{t('adm.trial_period_label', null, 'Trial period (amount / time unit)')}</span>
              <div className="plan-dialog-trial-row">
                <input className="input" type="number" min="1" value={form.trial_amount} onChange={(e) => set('trial_amount', e.target.value)} />
                <select className="input" value={form.trial_unit} onChange={(e) => set('trial_unit', e.target.value)}>
                  <option value="day">day</option><option value="week">week</option><option value="month">month</option><option value="year">year</option>
                </select>
              </div>
            </div>
          )}
        </div>
        <div className="plan-dialog-actions">
          <button type="button" className="btn-primary" onClick={submit} disabled={saving}>{saving ? t('adm.creating', null, 'Creating…') : t('adm.next', null, 'Next')}</button>
          <button type="button" className="plan-confirm-cancel" onClick={onClose} disabled={saving}>{t('common.cancel', null, 'Cancel')}</button>
        </div>
      </div>
    </div>
  );
};

const PlanCard = ({ plan, navigate, onToggle, onCopy, onDelete }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false), open);
  const active = plan.status === 'active';
  return (
    <div className="admin-plan-row">
      <button type="button" className={`role-toggle ${active ? 'is-on' : ''}`} onClick={() => onToggle(plan)} aria-pressed={active}><span className="role-toggle-knob" /></button>
      <div className="admin-plan-main">
        <button type="button" className="admin-plan-name" onClick={() => navigate(`/admin/plans/${plan.uid}/edit`)}>{plan.name}</button>
        <p className="admin-plan-desc">{plan.description}</p>
        <p className="admin-plan-meta">
          <span style={plan.delivery === 'none' ? { color: '#e0414b' } : undefined}>{deliveryLabel(plan.delivery)}</span> · {t('adm.subscriber_count', { count: Number(plan.subscriber_limit || 0).toLocaleString() }, `${Number(plan.subscriber_limit || 0).toLocaleString()} subscriber(s)`)}
        </p>
      </div>
      <div className="admin-plan-price">
        <strong>{plan.currency} {plan.price}</strong>
        <span>{cycleLabel(plan.frequency_amount, plan.frequency_unit)}</span>
      </div>
      <div className="admin-plan-credits">
        <strong>{creditsLabel(plan.sending_credits)}</strong>
        <span>{t('adm.sending_credits', null, 'sending credits')}</span>
      </div>
      <span className={`admin-status-badge admin-status-${plan.status}`}>{plan.status}</span>
      <div className="admin-plan-actions">
        <button type="button" className="btn-secondary" onClick={() => navigate(`/admin/plans/${plan.uid}/edit`)}><span className="material-symbols-rounded">edit</span> {t('common.edit', null, 'Edit')}</button>
        <div ref={ref} className="admin-dd">
          <button type="button" className="btn-secondary admin-icon-btn" onClick={() => setOpen((v) => !v)} aria-label="More"><span className="admin-caret">⌄</span></button>
          {open && (
            <div className="admin-dd-menu admin-dd-menu-end">
              <button type="button" onClick={() => { setOpen(false); onCopy(plan); }}><span className="material-symbols-rounded">content_copy</span> {t('adm.copy', null, 'Copy')}</button>
              <button type="button" onClick={() => { setOpen(false); onDelete(plan); }}><span className="material-symbols-rounded">delete_outline</span> {t('common.delete', null, 'Delete')}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const AdminPlansList = ({ rows, ...handlers }) => {
  const { t } = useTranslation();
  if (!rows || rows.length === 0) {
    return <div className="admin-empty"><span className="material-symbols-rounded">price_check</span><p>{t('adm.no_plans_yet', null, 'There are no plans yet')}</p></div>;
  }
  return (
    <>
      <p className="admin-sub-intro">{t('adm.plans_list_intro', null, 'Create service plans which shall be available for your users to subscribe to. Service plans represent the service quota, it defines the allocation of the application resources like sending credits, lists or campaigns limits.')}</p>
      <div className="admin-plan-list">{rows.map((p) => <PlanCard key={p.uid} plan={p} {...handlers} />)}</div>
    </>
  );
};

// ─── Sending credit plans / Email verification plans (simple plan lists) ──────────
const CreditPlansList = ({ rows, intro, onEdit, onDelete }) => {
  const { t } = useTranslation();
  return (
  <>
    {intro && <p className="admin-sub-intro">{intro}</p>}
    {(!rows || rows.length === 0) ? (
      <div className="admin-subs-empty">
        <span className="material-symbols-rounded">assignment_turned_in</span>
        <p>{t('adm.you_have_no_plan', null, 'You have no plan')}</p>
      </div>
    ) : (
      <div className="admin-plan-list">
        {rows.map((p) => (
          <div key={p.uid} className="admin-plan-row admin-credit-plan-row">
            <div className="admin-plan-main">
              <button type="button" className="admin-plan-name" onClick={() => onEdit(p)}>{p.name}</button>
              {p.description && <p className="admin-plan-desc">{p.description}</p>}
            </div>
            <div className="admin-plan-credits"><strong>{Number(p.credits || 0).toLocaleString()}</strong><span>{t('adm.credits', null, 'credits')}</span></div>
            <div className="admin-plan-price"><strong>{p.currency} {p.price}</strong><span>{t('adm.price_label', null, 'price')}</span></div>
            <div className="admin-plan-actions">
              <button type="button" className="btn-secondary" onClick={() => onEdit(p)}><span className="material-symbols-rounded">edit</span> {t('common.edit', null, 'Edit')}</button>
              <button type="button" className="admin-delete-btn" onClick={() => onDelete(p)}>{t('common.delete', null, 'Delete')}</button>
            </div>
          </div>
        ))}
      </div>
    )}
  </>
  );
};

// ─── Currencies list (PHP clone of admin/currencies) ─────────────────────────────
const CurrencyRow = ({ cur, onEdit, onDelete }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false), open);
  return (
    <div className="admin-cur-row">
      <div className="admin-cur-main">
        <button type="button" className="admin-cur-name" onClick={() => onEdit(cur)}>{cur.name}</button>
        <p className="admin-cur-sub">{t('adm.updated_at_prefix', null, 'Updated at')} {formatDate(cur.updated_at || cur.created_at)}</p>
      </div>
      <div className="admin-cur-cell"><strong>{cur.code}</strong><span>{t('adm.code', null, 'Code')}</span></div>
      <div className="admin-cur-cell"><strong>{cur.format}</strong><span>{t('adm.format', null, 'Format')}</span></div>
      <span className={`admin-status-badge admin-status-${cur.status}`}>{cur.status}</span>
      <div className="admin-cur-actions">
        <button type="button" className="btn-secondary admin-icon-btn" title={t('common.edit', null, 'Edit')} onClick={() => onEdit(cur)}><span className="material-symbols-rounded">edit</span></button>
        <div ref={ref} className="admin-dd">
          <button type="button" className="btn-secondary admin-icon-btn" onClick={() => setOpen((v) => !v)} aria-label="More"><span className="admin-caret">⌄</span></button>
          {open && (
            <div className="admin-dd-menu admin-dd-menu-end">
              <button type="button" onClick={() => { setOpen(false); onDelete(cur); }}><span className="material-symbols-rounded">delete_outline</span> {t('common.delete', null, 'Delete')}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const CurrenciesList = ({ rows, onEdit, onDelete }) => {
  const { t } = useTranslation();
  if (!rows || rows.length === 0) {
    return <div className="admin-empty"><span className="material-symbols-rounded">currency_exchange</span><p>{t('adm.no_currencies_yet', null, 'There are no currencies yet')}</p></div>;
  }
  return (
    <>
      <div className="admin-cur-list">{rows.map((c) => <CurrencyRow key={c.id} cur={c} onEdit={onEdit} onDelete={onDelete} />)}</div>
      <div className="admin-cur-footer">
        <span>{t('adm.items_per_page', null, 'items per page')}</span>
        <span className="admin-cur-footer-sep">|</span>
        <span>{t('adm.records_range', { from: rows.length ? 1 : 0, to: rows.length, total: rows.length }, `From ${rows.length ? 1 : 0} to ${rows.length}. Total ${rows.length} records`)}</span>
      </div>
    </>
  );
};

// ─── Admins (clone of admin/admins/_list) ────────────────────────────────────────
const AdminRow = ({ admin, navigate, onStatus, onOneClick, onDelete }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false), open);
  return (
    <div className="admin-adm-row">
      <div className="admin-adm-avatar">
        {admin.image ? <img src={admin.image} alt="" /> : <span className="material-symbols-rounded">account_circle</span>}
      </div>
      <div className="admin-adm-main">
        <button type="button" className="admin-adm-name" onClick={() => navigate(`/admin/admins/${admin.uid}/edit`)}>{admin.name}</button>
        <p className="admin-adm-email">{admin.email}</p>
      </div>
      <div className="admin-adm-cell">
        <strong className="admin-adm-group">{admin.group_name}</strong>
        <span>{t('adm.admin_group', null, 'Admin group')}</span>
      </div>
      <div className="admin-adm-cell">
        <strong>{admin.customers_count}</strong>
        <span>{t('adm.customers', null, 'Customers')}</span>
      </div>
      <div className="admin-adm-cell admin-adm-date">
        <strong>{formatDate(admin.created_at)}</strong>
        <span>{t('adm.created_at', null, 'Created at')}</span>
      </div>
      <span className={`admin-status-badge admin-status-${admin.status}`}>{admin.status}</span>
      <div className="admin-adm-actions">
        <button type="button" className="btn-secondary admin-icon-btn" title={t('common.edit', null, 'Edit')} onClick={() => navigate(`/admin/admins/${admin.uid}/edit`)}><span className="material-symbols-rounded">edit</span></button>
        <div ref={ref} className="admin-dd">
          <button type="button" className="btn-secondary admin-icon-btn" onClick={() => setOpen((v) => !v)} aria-label="More"><span className="admin-caret">⌄</span></button>
          {open && (
            <div className="admin-dd-menu admin-dd-menu-end">
              {admin.status === 'active'
                ? <button type="button" onClick={() => { setOpen(false); onStatus(admin, 'disable'); }}><span className="material-symbols-rounded">hide_source</span> {t('adm.disable', null, 'Disable')}</button>
                : <button type="button" onClick={() => { setOpen(false); onStatus(admin, 'enable'); }}><span className="material-symbols-rounded">play_arrow</span> {t('adm.enable', null, 'Enable')}</button>}
              <button type="button" onClick={() => { setOpen(false); onOneClick(admin); }}><span className="material-symbols-rounded">link</span> {t('adm.generate_one_click_url', null, 'Generate one-click login URL')}</button>
              {!admin.is_self && (
                <button type="button" onClick={() => { setOpen(false); onDelete(admin); }}><span className="material-symbols-rounded">delete_outline</span> {t('common.delete', null, 'Delete')}</button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const AdminsList = ({ rows, navigate, onStatus, onOneClick, onDelete }) => {
  const { t } = useTranslation();
  if (!rows || rows.length === 0) {
    return <div className="admin-empty"><span className="material-symbols-rounded">admin_panel_settings</span><p>{t('adm.no_admins_yet', null, 'There are no admins yet')}</p></div>;
  }
  return (
    <>
      <div className="admin-adm-list">{rows.map((a) => <AdminRow key={a.uid} admin={a} navigate={navigate} onStatus={onStatus} onOneClick={onOneClick} onDelete={onDelete} />)}</div>
      <div className="admin-cur-footer">
        <span>{t('adm.items_per_page', null, 'items per page')}</span>
        <span className="admin-cur-footer-sep">|</span>
        <span>{t('adm.records_range', { from: rows.length ? 1 : 0, to: rows.length, total: rows.length }, `From ${rows.length ? 1 : 0} to ${rows.length}. Total ${rows.length} records`)}</span>
      </div>
    </>
  );
};

// ─── Admin groups (clone of admin/admin_groups/_list) ─────────────────────────────
const AdminGroupRow = ({ group, navigate, onDelete }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false), open);
  return (
    <div className="admin-agp-row">
      <div className="admin-agp-main">
        <button type="button" className="admin-agp-name" onClick={() => navigate(`/admin/admin-groups/${group.id}/edit`)}>{group.name}</button>
        <p className="admin-agp-sub">{t('adm.created_at_prefix', null, 'Created at:')} {formatDate(group.created_at)}</p>
      </div>
      <div className="admin-agp-cell">
        <strong>{group.admins_count}</strong>
        <span>{t('adm.admins', null, 'Admins')}</span>
      </div>
      <div className="admin-agp-actions">
        <button type="button" className="btn-secondary" onClick={() => navigate(`/admin/admin-groups/${group.id}/edit`)}>{t('common.edit', null, 'Edit')}</button>
        <div ref={ref} className="admin-dd">
          <button type="button" className="btn-secondary admin-icon-btn" onClick={() => setOpen((v) => !v)} aria-label="More"><span className="admin-caret">⌄</span></button>
          {open && (
            <div className="admin-dd-menu admin-dd-menu-end">
              <button type="button" onClick={() => { setOpen(false); onDelete(group); }}><span className="material-symbols-rounded">delete_outline</span> {t('common.delete', null, 'Delete')}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const AdminGroupsList = ({ rows, navigate, onDelete }) => {
  const { t } = useTranslation();
  if (!rows || rows.length === 0) {
    return <div className="admin-empty"><span className="material-symbols-rounded">groups</span><p>{t('adm.no_admin_groups_yet', null, 'There are no admin groups yet')}</p></div>;
  }
  return (
    <>
      <div className="admin-agp-list">{rows.map((g) => <AdminGroupRow key={g.id} group={g} navigate={navigate} onDelete={onDelete} />)}</div>
      <div className="admin-cur-footer">
        <span>{t('adm.items_per_page', null, 'items per page')}</span>
        <span className="admin-cur-footer-sep">|</span>
        <span>{t('adm.records_range', { from: rows.length ? 1 : 0, to: rows.length, total: rows.length }, `From ${rows.length ? 1 : 0} to ${rows.length}. Total ${rows.length} records`)}</span>
      </div>
    </>
  );
};

// ─── Sending servers (clone of admin/sending_servers/index) ───────────────────────
const SendingServerRow = ({ srv, navigate, onStatus, onDelete, checked, onToggle }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false), open);
  const type = getServerType(srv.type);
  return (
    <div className="ss-row">
      <input type="checkbox" className="ss-row-check" checked={checked} onChange={onToggle} />
      <span className="ss-icon ss-icon-sm" style={{ background: type.color }}>{type.icon}</span>
      <div className="ss-row-main">
        <button type="button" className="ss-row-name" onClick={() => navigate(`/admin/sending-servers/${srv.id}/edit`)}>{srv.name}</button>
        <p>{t('adm.created_at_prefix', null, 'Created at:')} {formatDate(srv.created_at)}</p>
      </div>
      <div className="ss-row-cell"><strong>{srv.type_label}</strong><span>{t('adm.type', null, 'Type')}</span></div>
      <div className="ss-row-cell">{srv.hostname ? <><strong>{srv.hostname}</strong><span>{t('adm.hostname', null, 'Hostname')}</span></> : null}</div>
      <div className="ss-row-cell ss-row-sent"><strong>{t('adm.n_sent', { n: srv.sent }, `${srv.sent} sent`)}</strong><span>{t('adm.sending_limit_label', { limit: srv.sending_limit }, `Sending limit ${srv.sending_limit}`)}</span></div>
      <span className={`admin-status-badge admin-status-${srv.status}`}>{srv.status}</span>
      <div className="ss-row-actions">
        <button type="button" className="btn-secondary" onClick={() => navigate(`/admin/sending-servers/${srv.id}/edit`)}>
          <span className="material-symbols-rounded">edit</span> {t('common.edit', null, 'Edit')}
        </button>
        <div ref={ref} className="admin-dd">
          <button type="button" className="btn-secondary admin-icon-btn" onClick={() => setOpen((v) => !v)} aria-label="More"><span className="admin-caret">⌄</span></button>
          {open && (
            <div className="admin-dd-menu admin-dd-menu-end">
              {srv.status === 'active'
                ? <button type="button" onClick={() => { setOpen(false); onStatus(srv, 'disable'); }}><span className="material-symbols-rounded">hide_source</span> {t('adm.disable', null, 'Disable')}</button>
                : <button type="button" onClick={() => { setOpen(false); onStatus(srv, 'enable'); }}><span className="material-symbols-rounded">play_arrow</span> {t('adm.enable', null, 'Enable')}</button>}
              <button type="button" onClick={() => { setOpen(false); onDelete(srv); }}><span className="material-symbols-rounded">delete_outline</span> {t('common.delete', null, 'Delete')}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const SendingServersPanel = ({ rows, navigate, onStatus, onDelete, onBulkDelete }) => {
  const { t } = useTranslation();
  const [sort, setSort] = useState('created_at');
  const [dir, setDir] = useState('desc');
  const [typeFilter, setTypeFilter] = useState('all');
  const [keyword, setKeyword] = useState('');
  const [selected, setSelected] = useState(() => new Set());

  const types = [...new Set((rows || []).map((r) => r.type_label))].filter(Boolean);
  let view = rows || [];
  if (typeFilter !== 'all') view = view.filter((r) => r.type_label === typeFilter);
  const kw = keyword.trim().toLowerCase();
  if (kw) view = view.filter((r) => `${r.name} ${r.hostname} ${r.type_label}`.toLowerCase().includes(kw));
  view = [...view].sort((a, b) => {
    const av = sort === 'name' ? a.name : (a.created_at || '');
    const bv = sort === 'name' ? b.name : (b.created_at || '');
    const cmp = String(av).localeCompare(String(bv));
    return dir === 'desc' ? -cmp : cmp;
  });

  const allSel = view.length > 0 && view.every((r) => selected.has(r.id));
  const toggleAll = () => setSelected(allSel ? new Set() : new Set(view.map((r) => r.id)));
  const toggleRow = (r) => setSelected((p) => { const n = new Set(p); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; });
  const bulkDelete = () => { if (onBulkDelete) onBulkDelete(view.filter((r) => selected.has(r.id))); setSelected(new Set()); };

  return (
    <div className="ss-panel">
      <div className="ss-note"><span className="material-symbols-rounded">info</span> {t('adm.ss_note', null, 'Note: sending servers added by admin shall be used by users who are not permitted to add their own ones. You can select the sending servers to assign to a particular plan')}</div>
      <p className="ss-desc">{t('adm.ss_desc', null, 'This feature allows you to add a sending server which will actually send out your campaign emails. You can configure a standard SMTP connection or connect to a 3rd services like Amazon SES, SendGrid, Mailgun, ElasticEmail, Sparkpost… You can also take advantage of the the hosting server\'s email capability by creating a "PHP Mail" or "Sendmail" sending server')}</p>

      {selected.size > 0 && (
        <div className="admin-bulk-bar">
          <span>{t('adm.n_selected', { n: selected.size }, `${selected.size} selected`)}</span>
          <button type="button" className="btn-danger" onClick={bulkDelete}>
            <span className="material-symbols-rounded">delete_outline</span> {t('adm.delete_selected', null, 'Delete selected')}
          </button>
        </div>
      )}

      <div className="admin-filter-bar">
        <input type="checkbox" className="ss-check-all" checked={allSel} onChange={toggleAll} />
        <span className="admin-filter-label">{t('adm.sort_by', null, 'Sort by')}</span>
        <select className="input" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="created_at">{t('adm.created_at', null, 'Created at')}</option>
          <option value="name">{t('common.name', null, 'Name')}</option>
        </select>
        <button type="button" className="btn-secondary admin-icon-btn" title={t('adm.sort_direction', null, 'Sort direction')} onClick={() => setDir((d) => (d === 'desc' ? 'asc' : 'desc'))}>
          <span className="material-symbols-rounded">sort</span>
        </button>
        <span className="admin-filter-label">{t('adm.type', null, 'Type')}</span>
        <select className="input" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="all">{t('adm.all', null, 'All')}</option>
          {types.map((tp) => <option key={tp} value={tp}>{tp}</option>)}
        </select>
        <div className="admin-filter-search">
          <input className="input" placeholder={t('adm.type_to_search', null, 'Type to search')} value={keyword} onChange={(e) => setKeyword(e.target.value)} />
          <span className="material-symbols-rounded">search</span>
        </div>
        <button type="button" className="btn-secondary admin-filter-add" onClick={() => navigate('/admin/sending-servers/new')}>
          <span className="material-symbols-rounded">add</span> {t('adm.new_server', null, 'New server')}
        </button>
      </div>

      {view.length === 0 ? (
        <div className="admin-empty"><span className="material-symbols-rounded">dns</span><p>{t('adm.no_sending_servers_yet', null, 'There are no sending servers yet')}</p></div>
      ) : (
        <>
          <div className="ss-list">{view.map((s) => <SendingServerRow key={s.id} srv={s} navigate={navigate} onStatus={onStatus} onDelete={onDelete} checked={selected.has(s.id)} onToggle={() => toggleRow(s)} />)}</div>
          <div className="admin-cur-footer">
            <span>{t('adm.items_per_page', null, 'items per page')}</span>
            <span className="admin-cur-footer-sep">|</span>
            <span>{t('adm.records_range', { from: view.length ? 1 : 0, to: view.length, total: view.length }, `From ${view.length ? 1 : 0} to ${view.length}. Total ${view.length} records`)}</span>
          </div>
        </>
      )}
    </div>
  );
};

// ─── Generic handler list (bounce / feedback / email-verification servers) ─────────
const HandlerRow = ({ row, subtitle, navigate, editPath, onDelete, checked, onToggle }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false), open);
  return (
    <div className="hdl-row">
      <input type="checkbox" className="ss-row-check" checked={checked} onChange={onToggle} />
      <div className="hdl-main">
        <button type="button" className="hdl-name" onClick={() => navigate(editPath(row))}>{row.name}</button>
        <p>{subtitle}</p>
      </div>
      <span className={`admin-status-badge admin-status-${row.status || 'active'}`}>{row.status || 'active'}</span>
      <div className="hdl-actions">
        <button type="button" className="btn-secondary admin-icon-btn" title={t('common.edit', null, 'Edit')} onClick={() => navigate(editPath(row))}><span className="material-symbols-rounded">edit</span></button>
        <div ref={ref} className="admin-dd">
          <button type="button" className="btn-secondary admin-icon-btn" onClick={() => setOpen((v) => !v)} aria-label="More"><span className="admin-caret">⌄</span></button>
          {open && (
            <div className="admin-dd-menu admin-dd-menu-end">
              <button type="button" onClick={() => { setOpen(false); onDelete(row); }}><span className="material-symbols-rounded">delete_outline</span> {t('common.delete', null, 'Delete')}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const HandlerListPanel = ({ cfg, rows, navigate, onDelete, onBulkDelete }) => {
  const { t } = useTranslation();
  const [sort, setSort] = useState('created_at');
  const [dir, setDir] = useState('desc');
  const [typeFilter, setTypeFilter] = useState('all');
  const [keyword, setKeyword] = useState('');
  const [selected, setSelected] = useState(() => new Set());

  const types = cfg.hasType ? [...new Set((rows || []).map((r) => r.type))].filter(Boolean) : [];
  let view = rows || [];
  if (cfg.hasType && typeFilter !== 'all') view = view.filter((r) => r.type === typeFilter);
  const kw = keyword.trim().toLowerCase();
  if (kw) view = view.filter((r) => `${r.name || ''} ${r.host || ''} ${r.email || ''}`.toLowerCase().includes(kw));
  view = [...view].sort((a, b) => {
    const av = sort === 'name' ? (a.name || '') : (a[sort] || a.created_at || '');
    const bv = sort === 'name' ? (b.name || '') : (b[sort] || b.created_at || '');
    const cmp = String(av).localeCompare(String(bv));
    return dir === 'desc' ? -cmp : cmp;
  });

  const keyOf = (r) => r.uid || r.id;
  const allSel = view.length > 0 && view.every((r) => selected.has(keyOf(r)));
  const toggleAll = () => setSelected(allSel ? new Set() : new Set(view.map(keyOf)));
  const toggleRow = (r) => setSelected((p) => { const n = new Set(p); const k = keyOf(r); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const bulkDelete = () => { if (onBulkDelete) onBulkDelete(view.filter((r) => selected.has(keyOf(r)))); setSelected(new Set()); };

  return (
    <div className="hdl-panel">
      <p className="hdl-desc">{cfg.description}</p>

      {selected.size > 0 && (
        <div className="admin-bulk-bar">
          <span>{t('adm.n_selected', { n: selected.size }, `${selected.size} selected`)}</span>
          <button type="button" className="btn-danger" onClick={bulkDelete}>
            <span className="material-symbols-rounded">delete_outline</span> {t('adm.delete_selected', null, 'Delete selected')}
          </button>
        </div>
      )}

      <div className="admin-filter-bar">
        <input type="checkbox" className="ss-check-all" checked={allSel} onChange={toggleAll} />
        <span className="admin-filter-label">{t('adm.sort_by', null, 'Sort by')}</span>
        <select className="input" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="created_at">{t('adm.created_at', null, 'Created at')}</option>
          <option value="updated_at">{t('adm.updated_at', null, 'Updated at')}</option>
          <option value="name">{t('common.name', null, 'Name')}</option>
        </select>
        <button type="button" className="btn-secondary admin-icon-btn" title={t('adm.sort_direction', null, 'Sort direction')} onClick={() => setDir((d) => (d === 'desc' ? 'asc' : 'desc'))}>
          <span className="material-symbols-rounded">sort</span>
        </button>
        {cfg.hasType && (
          <>
            <span className="admin-filter-label">{t('adm.type', null, 'Type')}</span>
            <select className="input" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="all">{t('adm.all', null, 'All')}</option>
              {types.map((tp) => <option key={tp} value={tp}>{tp}</option>)}
            </select>
          </>
        )}
        <div className="admin-filter-search">
          <input className="input" placeholder={t('adm.type_to_search', null, 'Type to search')} value={keyword} onChange={(e) => setKeyword(e.target.value)} />
          <span className="material-symbols-rounded">search</span>
        </div>
        <button type="button" className="btn-secondary admin-filter-add" onClick={() => navigate(cfg.addPath)}>
          <span className="material-symbols-rounded">add</span> {cfg.addLabel}
        </button>
      </div>

      {view.length === 0 ? (
        <div className="hdl-empty">
          <span className="material-symbols-rounded">{cfg.emptyIcon}</span>
          <p>{cfg.emptyText}</p>
        </div>
      ) : (
        <>
          <div className="hdl-list">{view.map((r) => <HandlerRow key={keyOf(r)} row={r} subtitle={cfg.subtitle(r)} navigate={navigate} editPath={cfg.editPath} onDelete={onDelete} checked={selected.has(keyOf(r))} onToggle={() => toggleRow(r)} />)}</div>
          <div className="admin-cur-footer">
            <span>{t('adm.items_per_page', null, 'items per page')}</span>
            <span className="admin-cur-footer-sep">|</span>
            <span>{t('adm.records_range', { from: view.length ? 1 : 0, to: view.length, total: view.length }, `From ${view.length ? 1 : 0} to ${view.length}. Total ${view.length} records`)}</span>
          </div>
        </>
      )}
    </div>
  );
};

const HANDLER_DESC = 'Bounce/feedback handler is a mailbox used for receiving bounced messages or spam/abuse feedback. The application checks the mailbox to keep track of email delivery issue. Notice that bounce/feedback handler is used for SMTP or Sendmail sending server only. If you send through a third-party service like Amazon SES, SendGrid, Mailgun, Elasticmail, etc. you do not have to set up a bounce/feedback handler as it is already handled by the service and will be reflected in your campaign statistics automatically (then just ignore this setting)';

const BOUNCE_HANDLER_CFG = {
  description: HANDLER_DESC,
  addLabel: 'New bounce handler', addPath: '/admin/bounce-handlers/new',
  emptyIcon: 'cached', emptyText: 'You have no bounce handler', hasType: false,
  editPath: (r) => `/admin/bounce-handlers/${r.uid}/edit`,
  subtitle: (r) => r.email || r.host || '',
};
const FEEDBACK_HANDLER_CFG = {
  description: HANDLER_DESC,
  addLabel: 'New feedback loop handler', addPath: '/admin/feedback-handlers/new',
  emptyIcon: 'cached', emptyText: 'You have no feedback loop handler', hasType: false,
  editPath: (r) => `/admin/feedback-handlers/${r.uid}/edit`,
  subtitle: (r) => r.email || r.host || '',
};
const EVS_CFG = {
  description: "This feature allows you to connect to 3rd email verification services/servers. After adding the verification services/servers, you can go to the Mail List's setting page to manage verification processes",
  addLabel: 'Create new', addPath: '/admin/email-verification-servers/new',
  emptyIcon: 'dns', emptyText: 'You have no email verification server', hasType: true,
  editPath: (r) => `/admin/email-verification-servers/${r.uid}/edit`,
  subtitle: (r) => r.type || '',
};

// ─── Email verification plans (Recurring / One-time Pay tabs) ─────────────────────
const EVP_INTRO = {
  recurring: 'Email verification plans allow clients to subscribe and acquire additional credits by utilizing the email verification server. Each plan comes with a specified price, billing cycle, and a allocation of credits for utilizing the email verification service on emails.',
  one_time: 'Email verification plans allow clients to purchase credits for using the email verification service. The One-time Pay plan provides a fixed number of credits with no recurring billing. All purchased credits can be used at any time, with no expiration or time limit.',
};

const EvpPanel = ({ rows, navigate, onDelete }) => {
  const { t } = useTranslation();
  const [tab, setTab] = useState('recurring');
  const [keyword, setKeyword] = useState('');
  const [sortDir, setSortDir] = useState('asc');

  const list = (rows || [])
    .filter((p) => (p.type || 'recurring') === tab)
    .filter((p) => !keyword.trim() || (p.name || '').toLowerCase().includes(keyword.trim().toLowerCase()))
    .sort((a, b) => (sortDir === 'asc' ? 1 : -1) * String(a.name || '').localeCompare(String(b.name || '')));

  return (
    <>
      <ul className="campaign-detail-tabs admin-detail-tabs">
        <li className={tab === 'recurring' ? 'active' : ''}><button type="button" onClick={() => setTab('recurring')}><span className="material-symbols-rounded">event_repeat</span> {t('adm.recurring', null, 'Recurring')}</button></li>
        <li className={tab === 'one_time' ? 'active' : ''}><button type="button" onClick={() => setTab('one_time')}><span className="material-symbols-rounded">paid</span> {t('adm.one_time_pay', null, 'One-time Pay')}</button></li>
      </ul>

      <div className="evp-intro-row">
        <p className="admin-sub-intro">{EVP_INTRO[tab]}</p>
        <button type="button" className="btn-danger evp-add" onClick={() => navigate(`/admin/email-verification-plans/new?type=${tab}`)}>
          <span className="material-symbols-rounded">add</span> {t('adm.add_new_plan', null, 'Add new Plan')}
        </button>
      </div>

      <div className="admin-filter-bar">
        <span className="admin-filter-label">{t('adm.sort_by', null, 'Sort by')}</span>
        <select className="input"><option>{t('common.name', null, 'Name')}</option></select>
        <button type="button" className="btn-secondary admin-icon-btn" title={t('adm.sort_direction', null, 'Sort direction')} onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}><span className="material-symbols-rounded">sort</span></button>
        <div className="admin-filter-search">
          <input className="input" placeholder={t('adm.type_to_search', null, 'Type to search')} value={keyword} onChange={(e) => setKeyword(e.target.value)} />
          <span className="material-symbols-rounded">search</span>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="admin-subs-empty"><span className="material-symbols-rounded">assignment_turned_in</span><p>{t('adm.you_have_no_plan', null, 'You have no plan')}</p></div>
      ) : (
        <div className="admin-plan-list">
          {list.map((p) => (
            <div key={p.uid} className="admin-plan-row admin-credit-plan-row">
              <div className="admin-plan-main">
                <button type="button" className="admin-plan-name" onClick={() => navigate(`/admin/email-verification-plans/${p.uid}/edit`)}>{p.name}</button>
                {p.description && <p className="admin-plan-desc">{p.description}</p>}
              </div>
              <div className="admin-plan-credits"><strong>{Number(p.email_verification_credits || 0).toLocaleString()}</strong><span>{t('adm.credits', null, 'credits')}</span></div>
              <div className="admin-plan-price"><strong>{p.currency} {p.price}</strong><span>{p.type === 'one_time' ? t('adm.one_time', null, 'one-time') : `${p.frequency_amount || 1} ${p.frequency_unit || 'month'}`}</span></div>
              <div className="admin-plan-actions">
                <button type="button" className="btn-secondary" onClick={() => navigate(`/admin/email-verification-plans/${p.uid}/edit`)}><span className="material-symbols-rounded">edit</span> {t('common.edit', null, 'Edit')}</button>
                <button type="button" className="admin-delete-btn" onClick={() => onDelete(p)}>{t('common.delete', null, 'Delete')}</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
};

// ─── Admin invoices + transactions (PHP clone of admin/invoices) ──────────────────
const humanizeType = (t) => (t ? t.replace(/[_-]/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : '-');
const money = (amount, currency) => `${currency || 'OMR'} ${Number(amount || 0).toLocaleString()}`;
const invStatusIcon = (status) => {
  if (status === 'paid') return { icon: 'credit_score', cls: 'sub-icon-active' };
  if (status === 'new' || status === 'pending') return { icon: 'add_circle_outline', cls: 'sub-icon-new' };
  return { icon: 'remove_circle_outline', cls: 'sub-icon-muted' };
};

const InvoiceRow = ({ inv, navigate, onApprove, onDelete }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false), open);
  const { icon, cls } = invStatusIcon(inv.status);
  return (
    <div className="admin-inv-row">
      <span className={`admin-sub-icon ${cls}`}><span className="material-symbols-rounded">{icon}</span></span>
      <div className="admin-inv-main">
        <p className="admin-inv-number">#{inv.number}</p>
        <p className="admin-inv-sub">{humanizeType(inv.type)}</p>
      </div>
      <div className="admin-inv-cell">
        <button type="button" className="admin-sub-link admin-inv-customer" onClick={() => inv.customer && navigate(`/admin/customers/${inv.customer.uid}`)}>
          {inv.customer?.name || '-'} <span className="material-symbols-rounded">login</span>
        </button>
        <span>{t('adm.customer', null, 'Customer')}</span>
      </div>
      <div className="admin-inv-cell"><strong>{formatDate(inv.created_at)}</strong><span>{t('adm.created_at', null, 'Created at')}</span></div>
      <div className="admin-inv-cell"><strong>{money(inv.amount, inv.currency)}</strong><span>{t('adm.amount', null, 'Amount')}</span></div>
      <span className={`admin-status-badge admin-status-${inv.status}`}>{inv.status}</span>
      <div className="admin-inv-actions">
        <div ref={ref} className="admin-dd">
          <button type="button" className="btn-secondary admin-icon-btn" onClick={() => setOpen((v) => !v)} aria-label="More"><span className="admin-caret">⌄</span></button>
          {open && (
            <div className="admin-dd-menu admin-dd-menu-end">
              {(inv.status === 'new' || inv.status === 'pending') && (
                <button type="button" onClick={() => { setOpen(false); onApprove(inv); }}><span className="material-symbols-rounded">check</span> {t('adm.approve', null, 'Approve')}</button>
              )}
              <button type="button" onClick={() => { setOpen(false); navigate('/admin/invoices?tab=transactions'); }}><span className="material-symbols-rounded">history</span> {t('adm.logs', null, 'Logs')}</button>
              <button type="button" onClick={() => { setOpen(false); onDelete(inv); }}><span className="material-symbols-rounded">delete_outline</span> {t('common.delete', null, 'Delete')}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const TransactionRow = ({ tx, navigate }) => {
  const { t } = useTranslation();
  return (
  <div className="admin-inv-row">
    <span className={`admin-sub-icon ${invStatusIcon(tx.status === 'success' ? 'paid' : tx.status).cls}`}><span className="material-symbols-rounded">{invStatusIcon(tx.status === 'success' ? 'paid' : tx.status).icon}</span></span>
    <div className="admin-inv-main">
      <p className="admin-inv-number">#{tx.invoice_number}</p>
      <p className="admin-inv-sub">{tx.method ? humanizeType(tx.method) : t('adm.transaction', null, 'Transaction')}</p>
    </div>
    <div className="admin-inv-cell">
      <button type="button" className="admin-sub-link admin-inv-customer" onClick={() => tx.customer && navigate(`/admin/customers/${tx.customer.uid}`)}>
        {tx.customer?.name || '-'} <span className="material-symbols-rounded">login</span>
      </button>
      <span>{t('adm.customer', null, 'Customer')}</span>
    </div>
    <div className="admin-inv-cell"><strong>{formatDate(tx.created_at)}</strong><span>{t('adm.created_at', null, 'Created at')}</span></div>
    <div className="admin-inv-cell"><strong>{money(tx.amount, tx.currency)}</strong><span>{t('adm.amount', null, 'Amount')}</span></div>
    <span className={`admin-status-badge admin-status-${tx.status}`}>{tx.status}</span>
    <div className="admin-inv-actions" />
  </div>
  );
};

const AdminInvoicesPanel = ({ rows, navigate, onApprove, onDelete }) => {
  const { t } = useTranslation();
  const [tab, setTab] = useState('invoices');
  const [txRows, setTxRows] = useState(null);
  const [sortDir, setSortDir] = useState('desc');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [customer, setCustomer] = useState('');

  useEffect(() => {
    if (tab === 'transactions' && txRows === null) {
      adminApi.transactions({ page: 1, per_page: 100 })
        .then(({ data }) => setTxRows(data.data || []))
        .catch(() => setTxRows([]));
    }
  }, [tab, txRows]);

  const types = [...new Set(rows.map((r) => r.type).filter(Boolean))];
  const statuses = [...new Set(rows.map((r) => r.status).filter(Boolean))];
  const customers = [...new Set(rows.map((r) => r.customer?.name).filter(Boolean))];

  const applyFilters = (list) => list
    .filter((r) => (!type || r.type === type) && (!status || r.status === status) && (!customer || r.customer?.name === customer))
    .sort((a, b) => {
      const cmp = String(a.created_at || '').localeCompare(String(b.created_at || ''));
      return sortDir === 'desc' ? -cmp : cmp;
    });

  const invoices = applyFilters(rows);
  const transactions = txRows ? applyFilters(txRows) : [];

  return (
    <>
      <p className="admin-sub-intro">{t('adm.invoices_intro', null, 'Invoices are created when customers make payment for services, including when they subscribe to a plan, renew their subscription, change plans, buy a number, or purchase other related services.')}</p>

      <ul className="campaign-detail-tabs admin-detail-tabs">
        <li className={tab === 'invoices' ? 'active' : ''}><button type="button" onClick={() => setTab('invoices')}>{t('adm.invoices', null, 'Invoices')}</button></li>
        <li className={tab === 'transactions' ? 'active' : ''}><button type="button" onClick={() => setTab('transactions')}>{t('adm.transactions', null, 'Transactions')}</button></li>
      </ul>

      <div className="admin-filter-bar">
        <span className="admin-filter-label">{t('adm.created_at', null, 'Created at')}</span>
        <button type="button" className="btn-secondary admin-icon-btn" title={t('adm.sort_direction', null, 'Sort direction')} onClick={() => setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))}><span className="material-symbols-rounded">sort</span></button>
        <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">{t('adm.all_types', null, 'All types')}</option>
          {types.map((tp) => <option key={tp} value={tp}>{humanizeType(tp)}</option>)}
        </select>
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t('adm.all_statuses', null, 'All statuses')}</option>
          {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="input" value={customer} onChange={(e) => setCustomer(e.target.value)}>
          <option value="">{t('adm.customer', null, 'Customer')}</option>
          {customers.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {tab === 'invoices' ? (
        invoices.length === 0 ? (
          <div className="admin-empty"><span className="material-symbols-rounded">receipt_long</span><p>{t('adm.no_invoices_yet', null, 'There are no invoices yet')}</p></div>
        ) : (
          <div className="admin-inv-list">{invoices.map((i) => <InvoiceRow key={i.uid} inv={i} navigate={navigate} onApprove={onApprove} onDelete={onDelete} />)}</div>
        )
      ) : txRows === null ? (
        <div className="admin-empty"><Spinner size="lg" /></div>
      ) : transactions.length === 0 ? (
        <div className="admin-empty"><span className="material-symbols-rounded">receipt_long</span><p>{t('adm.no_transactions_yet', null, 'There are no transactions yet')}</p></div>
      ) : (
        <div className="admin-inv-list">{transactions.map((tx) => <TransactionRow key={tx.uid} tx={tx} navigate={navigate} />)}</div>
      )}
    </>
  );
};

// ─── Admin subscriptions (PHP clone of admin/subscriptions/_list) ─────────────────
const SUB_STATUS_LABEL = { active: 'Active', new: 'Wait for payment', pending: 'Wait for payment', ended: 'Ended', cancelled: 'Cancelled', terminated: 'Terminated' };
const subStatusIcon = (status) => {
  if (status === 'active') return { icon: 'settings_backup_restore', cls: 'sub-icon-active' };
  if (status === 'new' || status === 'pending') return { icon: 'add_circle_outline', cls: 'sub-icon-new' };
  return { icon: 'remove_circle_outline', cls: 'sub-icon-muted' };
};

const SubscriptionRow = ({ sub, navigate, onApprove, onRecurring, onTerminate, onDelete }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false), open);
  const { icon, cls } = subStatusIcon(sub.status);
  const isActive = sub.status === 'active';
  const isNew = sub.status === 'new' || sub.status === 'pending';
  const ended = ['ended', 'terminated', 'cancelled'].includes(sub.status);
  const endValue = sub.terminated_at || sub.current_period_ends_at || sub.ends_at;

  return (
    <div className="admin-sub-row">
      <span className={`admin-sub-icon ${cls}`}><span className="material-symbols-rounded">{icon}</span></span>

      <div className="admin-sub-main">
        <p className="admin-sub-plan">{sub.plan?.name || '-'}</p>
        <p className="admin-sub-type"><span className="material-symbols-rounded">account_circle</span> {sub.plan?.type === 'verification' ? t('adm.verification', null, 'Verification') : t('adm.general', null, 'General')}</p>
        <p className="admin-sub-by">{t('adm.subscribed_by', null, 'Subscribed by')} <button type="button" className="admin-sub-link" onClick={() => sub.customer && navigate(`/admin/customers/${sub.customer.uid}`)}>{sub.customer?.name || '-'}</button></p>
      </div>

      <div className="admin-sub-meta">
        <strong>{formatDate(sub.created_at)}</strong>
        <span>{t('adm.subscribed_on', null, 'Subscribed on')}</span>
      </div>

      <div className="admin-sub-meta">
        <strong>{ended ? formatDate(endValue) : (endValue ? timeAgo(endValue) : '--')}</strong>
        <span>{ended ? t('adm.ended_at', null, 'Ended at') : (sub.is_recurring ? t('adm.next_billing', null, 'Next billing') : t('adm.subscription_end', null, 'Subscription end'))}</span>
      </div>

      <span className={`admin-status-badge admin-status-${sub.status}`}>{SUB_STATUS_LABEL[sub.status] || sub.status}</span>

      <div className="admin-sub-actions">
        {isNew && <button type="button" className="btn-primary" onClick={() => onApprove(sub)}>{t('adm.approve', null, 'Approve')}</button>}
        {isActive && (sub.is_recurring
          ? <button type="button" className="btn-secondary" onClick={() => onRecurring(sub, false)}>{t('adm.disable_recurring', null, 'Disable recurring')}</button>
          : <button type="button" className="btn-secondary" onClick={() => onRecurring(sub, true)}>{t('adm.enable_recurring', null, 'Enable recurring')}</button>)}
        <div ref={ref} className="admin-dd">
          <button type="button" className="btn-secondary admin-icon-btn" onClick={() => setOpen((v) => !v)} aria-label="More"><span className="admin-caret">⌄</span></button>
          {open && (
            <div className="admin-dd-menu admin-dd-menu-end">
              <button type="button" onClick={() => { setOpen(false); navigate('/admin/invoices'); }}><span className="material-symbols-rounded">receipt_long</span> {t('adm.logs', null, 'Logs')}</button>
              {!ended && <button type="button" onClick={() => { setOpen(false); onTerminate(sub); }}><span className="material-symbols-rounded">cancel</span> {t('adm.cancel_now', null, 'Cancel now')}</button>}
              <button type="button" onClick={() => { setOpen(false); onDelete(sub); }}><span className="material-symbols-rounded">delete_outline</span> {t('common.delete', null, 'Delete')}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const AdminSubscriptionsList = ({ rows, navigate, ...handlers }) => {
  const { t } = useTranslation();
  const [sortDir, setSortDir] = useState('desc');
  const [customer, setCustomer] = useState('');
  const [plan, setPlan] = useState('');
  const [type, setType] = useState('');

  const customers = [...new Set(rows.map((r) => r.customer?.name).filter(Boolean))];
  const plans = [...new Set(rows.map((r) => r.plan?.name).filter(Boolean))];

  const visible = rows
    .filter((r) => (!customer || r.customer?.name === customer) && (!plan || r.plan?.name === plan)
      && (!type || (r.plan?.type || 'general') === type))
    .sort((a, b) => {
      const cmp = String(a.updated_at || a.created_at || '').localeCompare(String(b.updated_at || b.created_at || ''));
      return sortDir === 'desc' ? -cmp : cmp;
    });

  return (
    <>
      <p className="admin-sub-intro">{t('adm.subscriptions_intro', null, "This feature allows you to monitor the details of your customers' subscriptions. You can approve the payment, enable or disable a subscription. You can also create new subscriptions for your existing customers.")}</p>
      <div className="admin-filter-bar">
        <span className="admin-filter-label">{t('adm.updated_at', null, 'Updated at')}</span>
        <button type="button" className="btn-secondary admin-icon-btn" title={t('adm.sort_direction', null, 'Sort direction')} onClick={() => setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))}><span className="material-symbols-rounded">sort</span></button>
        <select className="input" value={customer} onChange={(e) => setCustomer(e.target.value)}>
          <option value="">{t('adm.all_customers', null, 'All customers')}</option>
          {customers.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="input" value={plan} onChange={(e) => setPlan(e.target.value)}>
          <option value="">{t('adm.plan', null, 'Plan')}</option>
          {plans.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">{t('adm.all_types', null, 'All types')}</option>
          <option value="general">{t('adm.general', null, 'General')}</option>
          <option value="verification">{t('adm.verification', null, 'Verification')}</option>
        </select>
      </div>
      {visible.length === 0 ? (
        <div className="admin-empty"><span className="material-symbols-rounded">assignment_turned_in</span><p>{t('adm.no_subscriptions_yet', null, 'There are no subscriptions yet')}</p></div>
      ) : (
        <div className="admin-sub-list">
          {visible.map((s) => <SubscriptionRow key={s.uid} sub={s} navigate={navigate} {...handlers} />)}
        </div>
      )}
    </>
  );
};

// ─── Admin roles (PHP clone of admin/roles/list) ─────────────────────────────────
const RoleCard = ({ role, onEdit, onStatus, onDelete }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false), open);
  return (
    <div className="admin-role-row">
      <div className="admin-role-main">
        <button type="button" className="admin-role-name" onClick={() => onEdit(role)}>{role.name || role.code || '-'}</button>
        {role.description && <p className="admin-role-desc">{role.description}</p>}
        <p className="admin-role-created">{t('adm.created_at_prefix', null, 'Created at:')} {formatDate(role.created_at)}</p>
      </div>
      <div className="admin-role-stat">
        <span className="admin-role-badge">{role.permissions_count ?? 0}</span>
        <span>{t('adm.permissions', null, 'Permissions')}</span>
      </div>
      <div className="admin-role-stat">
        <span className="admin-role-badge">{role.users_count ?? 0}</span>
        <span>{t('adm.users', null, 'Users')}</span>
      </div>
      <div className="admin-role-updated">
        <strong>{timeAgo(role.updated_at)}</strong>
        <span>{t('adm.updated_at', null, 'Updated at')}</span>
      </div>
      <span className={`admin-status-badge admin-status-${role.status}`}>{role.status}</span>
      <div className="admin-role-actions">
        <button type="button" className="btn-secondary" onClick={() => onEdit(role)}>{t('common.edit', null, 'Edit')}</button>
        {!role.readonly && (
          <div ref={ref} className="admin-dd">
            <button type="button" className="btn-secondary admin-icon-btn" onClick={() => setOpen((v) => !v)} aria-label="More"><span className="admin-caret">⌄</span></button>
            {open && (
              <div className="admin-dd-menu admin-dd-menu-end">
                {role.status === 'active'
                  ? <button type="button" onClick={() => { setOpen(false); onStatus(role, 'disable'); }}><span className="material-symbols-rounded">do_disturb_on</span> {t('adm.disable', null, 'Disable')}</button>
                  : <button type="button" onClick={() => { setOpen(false); onStatus(role, 'enable'); }}><span className="material-symbols-rounded">task_alt</span> {t('adm.enable', null, 'Enable')}</button>}
                <button type="button" onClick={() => { setOpen(false); onDelete(role); }}><span className="material-symbols-rounded">delete_outline</span> {t('common.delete', null, 'Delete')}</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const RolesList = ({ rows, ...handlers }) => {
  const { t } = useTranslation();
  if (!rows || rows.length === 0) {
    return <div className="admin-empty"><span className="material-symbols-rounded">badge</span><p>{t('adm.no_roles_yet', null, 'There are no roles yet')}</p></div>;
  }
  return <div className="admin-role-list">{rows.map((r) => <RoleCard key={r.uid} role={r} {...handlers} />)}</div>;
};

// ─── Admin user row actions (PHP clone of admin/users/_list) ──────────────────────
const UserRowActions = ({ onLoginAs, onEdit, onOneClick, onStatus, onDelete }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false), open);
  return (
    <div className="admin-row-actions admin-user-actions">
      <button type="button" className="admin-loginas-icon" title={t('adm.login_as', null, 'Login as')} onClick={onLoginAs}>
        <span className="material-symbols-rounded">login</span>
      </button>
      <button type="button" className="btn-secondary admin-icon-btn" title={t('common.edit', null, 'Edit')} onClick={onEdit}>
        <span className="material-symbols-rounded">edit</span>
      </button>
      <div ref={ref} className="admin-dd">
        <button type="button" className="btn-secondary admin-icon-btn" onClick={() => setOpen((v) => !v)} aria-label="More"><span className="admin-caret">⌄</span></button>
        {open && (
          <div className="admin-dd-menu admin-dd-menu-end">
            <button type="button" onClick={() => { setOpen(false); onOneClick(); }}><span className="material-symbols-rounded">link</span> {t('adm.generate_one_click_url', null, 'Generate one-click login URL')}</button>
            <button type="button" onClick={() => { setOpen(false); onStatus('enable'); }}><span className="material-symbols-rounded">play_arrow</span> {t('adm.enable', null, 'Enable')}</button>
            <button type="button" onClick={() => { setOpen(false); onStatus('disable'); }}><span className="material-symbols-rounded">hide_source</span> {t('adm.disable', null, 'Disable')}</button>
            <button type="button" onClick={() => { setOpen(false); onDelete(); }}><span className="material-symbols-rounded">delete_outline</span> {t('common.delete', null, 'Delete')}</button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Admin customers (PHP clone of admin/customers/_list) ─────────────────────────
const CustomerCard = ({ c, onLoginAs, onAssign, onStatus, onDelete, navigate }) => {
  const { t } = useTranslation();
  const [loginOpen, setLoginOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const loginRef = useRef(null);
  const menuRef = useRef(null);
  useClickOutside(loginRef, () => setLoginOpen(false), loginOpen);
  useClickOutside(menuRef, () => setMenuOpen(false), menuOpen);

  const sub = c.active_subscription;
  const users = c.users || [];

  return (
    <div className="admin-customer-row">
      <div className="admin-customer-main">
        <button type="button" className="admin-customer-name" onClick={() => navigate(`/admin/customers/${c.uid}`)}>{customerName(c)}</button>
        <p className="admin-customer-rate">{t('adm.bounce_feedback_rate', null, 'Bounce/Feedback rate: 0.00%')}</p>
        <div className="admin-customer-users">
          <span className="material-symbols-rounded">account_circle</span>
          <span>{t('adm.n_users', { n: users.length }, `${users.length} Users`)}</span>
        </div>
      </div>

      <div className="admin-customer-plan">
        {sub ? (
          <>
            <h5><span className="material-symbols-rounded">assignment_turned_in</span> {sub.plan_name || '-'}</h5>
            <span>{t('adm.current_plan', null, 'Current plan')}</span>
          </>
        ) : c.pending_subscription ? (
          <>
            <h5><span className="material-symbols-rounded">assignment_turned_in</span> {c.pending_subscription.plan_name}</h5>
            <span>{t('adm.pending', null, 'pending…')}</span>
          </>
        ) : (
          <span className="admin-customer-muted">{t('adm.no_active_subscription', null, 'no active subscription')}</span>
        )}
      </div>

      <div className="admin-customer-status">
        <span className={`admin-status-badge admin-status-${c.status}`}>{c.status}</span>
      </div>

      <div className="admin-customer-actions">
        <div ref={loginRef} className="admin-dd">
          <button type="button" className="btn-secondary admin-loginas-btn" onClick={() => setLoginOpen((v) => !v)} disabled={users.length === 0}>
            {t('adm.login_as', null, 'Login as')} <span className="admin-caret">⌄</span>
          </button>
          {loginOpen && (
            <div className="admin-dd-menu admin-loginas-menu">
              {users.map((u) => (
                <button type="button" key={u.uid} onClick={() => { setLoginOpen(false); onLoginAs(c); }}>
                  <span className="material-symbols-rounded admin-loginas-avatar">account_circle</span>
                  <span className="admin-loginas-info">
                    <strong>{`${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email}</strong>
                    <small>{u.email}</small>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button type="button" className="btn-secondary admin-icon-btn" title={t('common.edit', null, 'Edit')} onClick={() => navigate(`/admin/customers/${c.uid}`)}>
          <span className="material-symbols-rounded">edit</span>
        </button>
        <div ref={menuRef} className="admin-dd">
          <button type="button" className="btn-secondary admin-icon-btn" onClick={() => setMenuOpen((v) => !v)} aria-label="More"><span className="admin-caret">⌄</span></button>
          {menuOpen && (
            <div className="admin-dd-menu admin-dd-menu-end">
              <button type="button" onClick={() => { setMenuOpen(false); onAssign(c); }}><span className="material-symbols-rounded">assignment_turned_in</span> {t('adm.assign_plan', null, 'Assign plan')}</button>
              {c.status === 'active'
                ? <button type="button" onClick={() => { setMenuOpen(false); onStatus(c, 'disable'); }}><span className="material-symbols-rounded">hide_source</span> {t('adm.disable', null, 'Disable')}</button>
                : <button type="button" onClick={() => { setMenuOpen(false); onStatus(c, 'enable'); }}><span className="material-symbols-rounded">play_arrow</span> {t('adm.enable', null, 'Enable')}</button>}
              <button type="button" onClick={() => { setMenuOpen(false); navigate('/admin/subscriptions'); }}><span className="material-symbols-rounded">assignment_turned_in</span> {t('adm.subscriptions', null, 'Subscriptions')}</button>
              <button type="button" onClick={() => { setMenuOpen(false); onDelete(c); }}><span className="material-symbols-rounded">delete_outline</span> {t('common.delete', null, 'Delete')}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const AdminCustomersList = ({ rows, ...handlers }) => {
  const { t } = useTranslation();
  if (!rows || rows.length === 0) {
    return <div className="admin-empty"><span className="material-symbols-rounded">people_outline</span><p>{t('adm.no_customers_yet', null, 'There are no customers yet')}</p></div>;
  }
  return (
    <div className="admin-customer-list">
      {rows.map((c) => <CustomerCard key={c.uid} c={c} {...handlers} />)}
    </div>
  );
};

const AdminDashboard = ({ data, navigate, displayName }) => {
  const { t } = useTranslation();
  const summary = data?.summary || {};
  const customersGrowth = data?.charts?.customersGrowth || [];
  const plans = data?.charts?.plans || [];
  const recentSubs = data?.recent?.subscriptions || [];
  const recentCustomers = data?.recent?.customers || [];
  const activities = data?.activities || [];

  return (
    <>
      <section className="admin-dashboard-hero">
        <h1>{t('adm.hello_name', { name: displayName }, `Hello, ${displayName}!`)}</h1>
        <p>{t('adm.dashboard_welcome', null, 'Welcome back to admin dashboard. Check out these system statistics and notifications from our insight reports.')}</p>
      </section>

      {Array.isArray(data?.alerts) && data.alerts.length > 0 && (
        <section className="admin-alert-list">
          {data.alerts.map((alert, index) => (
            <article key={`${alert.title}-${index}`} className="admin-alert">
              <span className="material-symbols-rounded">info</span>
              <div>
                <strong>{alert.title}</strong>
                <p>{alert.message}</p>
              </div>
            </article>
          ))}
        </section>
      )}

      <section className="admin-dashboard-charts">
        <div className="admin-chart-block">
          <h2 className="admin-section-title"><span className="material-symbols-rounded">people_outline</span> {t('adm.customers_growth', null, 'Customers growth')}</h2>
          <MiniBarChart rows={customersGrowth} />
        </div>
        <div className="admin-chart-block">
          <h2 className="admin-section-title"><span className="material-symbols-rounded">assignment_turned_in</span> {t('adm.plans_chart', null, 'Plans chart')}</h2>
          <MiniPlanChart rows={plans} />
        </div>
      </section>

      <section className="admin-recent-grid">
        <RecentList icon="assignment_turned_in" title={t('adm.recent_subscriptions', null, 'Recent subscriptions')} intro={t('adm.recent_subscriptions_intro', null, 'Active users who recently subscribed or were added by a system administrator.')}>
          {recentSubs.length === 0 ? (
            <p className="admin-recent-empty">{t('adm.no_records_yet', null, 'There are no records yet!')}</p>
          ) : (
            <ul className="admin-recent-listing">
              {recentSubs.map((s) => (
                <li key={s.id}>
                  <div>
                    <button type="button" className="admin-recent-name" onClick={() => navigate('/admin/subscriptions')}>{s.plan?.name || '-'}</button>
                    <p><span className="material-symbols-rounded">person_outline</span> {s.customer ? customerName(s.customer) : '-'}</p>
                  </div>
                  <span className={`admin-status-badge admin-status-${s.status}`}>{s.status}</span>
                </li>
              ))}
            </ul>
          )}
        </RecentList>

        <RecentList icon="people_outline" title={t('adm.recent_customers', null, 'Recent customers')} intro={t('adm.recent_customers_intro', null, 'See how people are subscribing to your service plans.')}>
          {recentCustomers.length === 0 ? (
            <p className="admin-recent-empty">{t('adm.no_records_yet', null, 'There are no records yet!')}</p>
          ) : (
            <ul className="admin-recent-listing">
              {recentCustomers.map((c) => (
                <li key={c.id}>
                  <div className="admin-recent-customer">
                    <button type="button" className="admin-recent-name" onClick={() => navigate('/admin/customers')}>{customerName(c)}</button>
                    <span className="admin-recent-avatar"><span className="material-symbols-rounded">account_circle</span></span>
                  </div>
                  <div className="admin-recent-meta">
                    <small>{formatDate(c.created_at)}</small>
                    <span>{t('adm.created_at', null, 'Created at')}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </RecentList>
      </section>

      <section className="admin-activities">
        <h2 className="admin-section-title"><span className="material-symbols-rounded">restore</span> {t('adm.activities', null, 'Activities')}</h2>
        <p className="admin-recent-intro">{t('adm.activities_intro', null, 'By default, all activities of customers are logged for investigating.')}</p>
        {activities.length === 0 ? (
          <div className="admin-empty"><span className="material-symbols-rounded">history_toggle_off</span><p>{t('adm.no_activity_logs_yet', null, 'There are no activity logs yet')}</p></div>
        ) : (
          <div className="admin-activity-list">
            {activities.map((a, i) => (
              <article key={i} className="admin-activity-card">
                <div className="admin-activity-head">
                  <strong>{a.actor}</strong>
                  <span className="admin-activity-time"><span className="material-symbols-rounded">history</span> {formatDate(a.created_at)}</span>
                </div>
                <p>The {activityMessage(a)}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="admin-resources">
        <h2 className="admin-section-title"><span className="material-symbols-rounded">running_with_errors</span> {t('adm.resources_statistics', null, 'Resources statistics')}</h2>
        <p className="admin-recent-intro">{t('adm.resources_intro', null, 'An overview of system resource usage.')}</p>
        <div className="admin-resources-grid">
          <ResourceStatList rows={RESOURCE_STATS_LEFT} summary={summary} />
          <ResourceStatList rows={RESOURCE_STATS_RIGHT} summary={summary} />
        </div>
      </section>
    </>
  );
};

// ─── Config (settings group) / monitor / languages panels ───────────────────────
const ConfigPanel = ({ payload, onSaved }) => {
  const { t } = useTranslation();
  const [form, setForm] = useState(() => Object.fromEntries((payload.fields || []).map((f) => [f.key, f.value || ''])));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const save = async () => {
    setSaving(true); setMessage('');
    try {
      await adminApi.updateSettings({ settings: Object.entries(form).map(([name, value]) => ({ name, value })) });
      setMessage(t('adm.settings_saved', null, 'Settings saved.'));
      onSaved();
    } catch (err) {
      setMessage(err.response?.data?.message || t('adm.save_failed', null, 'Save failed.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-config-panel">
      {(payload.fields || []).map((f) => (
        <label key={f.key} className="admin-modal-field" style={{ display: 'block', marginBottom: 14, maxWidth: 560 }}>
          <span>{f.label}</span>
          {f.type === 'textarea' ? (
            <textarea rows={3} value={form[f.key]} onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))} />
          ) : (
            <input type={f.type === 'password' ? 'password' : f.type === 'color' ? 'color' : 'text'}
              value={form[f.key]} onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))} />
          )}
        </label>
      ))}
      {message && <p style={{ color: '#7bd88f', margin: '8px 0' }}>{message}</p>}
      <button type="button" className="btn-primary" onClick={save} disabled={saving}>{saving ? t('adm.saving', null, 'Saving…') : t('adm.save_settings', null, 'Save settings')}</button>
    </div>
  );
};

const MonitorPanel = ({ payload }) => {
  const { t } = useTranslation();
  return (
  <div>
    <p style={{ marginBottom: 16 }}>
      {t('adm.redis_label', null, 'Redis:')} <strong style={{ color: payload.redis === 'connected' ? '#7bd88f' : '#e0414b' }}>{payload.redis}</strong>
    </p>
    <div className="admin-report-grid">
      {(payload.queues || []).map((q) => (
        <article key={q.label} className="admin-report-card" style={{ textAlign: 'left' }}>
          <strong style={{ display: 'block', marginBottom: 8 }}>{q.label}</strong>
          {q.error ? <span style={{ color: '#e0414b' }}>{q.error}</span> : (
            <span style={{ fontSize: 13 }}>
              {t('adm.queue_stats', { waiting: q.waiting ?? 0, active: q.active ?? 0, completed: q.completed ?? 0, failed: q.failed ?? 0, delayed: q.delayed ?? 0 }, `waiting ${q.waiting ?? 0} · active ${q.active ?? 0} · completed ${q.completed ?? 0} · failed ${q.failed ?? 0} · delayed ${q.delayed ?? 0}`)}
            </span>
          )}
        </article>
      ))}
    </div>
  </div>
  );
};

const LanguagesPanel = ({ payload }) => {
  const { t } = useTranslation();
  return (
  <div className="admin-table-wrap">
    <p style={{ marginBottom: 12 }}>{t('adm.default_language', null, 'Default language:')} <strong>{payload.default}</strong></p>
    <table className="admin-table">
      <thead><tr><th>{t('adm.code', null, 'Code')}</th><th>{t('adm.language', null, 'Language')}</th></tr></thead>
      <tbody>
        {(payload.locales || []).map((l) => (
          <tr key={l.code}><td>{l.code}</td><td>{l.name}</td></tr>
        ))}
      </tbody>
    </table>
  </div>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────
const AdminPage = () => {
  const { t } = useTranslation();
  const { section } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const displayName = user?.customer
    ? `${user.customer.first_name} ${user.customer.last_name}`
    : user?.first_name
      ? `${user.first_name} ${user.last_name || ''}`.trim()
      : user?.email || 'Administrator';

  const requestedKey = section || 'dashboard';
  const activeSection = useMemo(() => sections.find((item) => item.key === requestedKey) || null, [requestedKey]);
  const activeKey = activeSection?.key || requestedKey;

  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal state
  const [planModal, setPlanModal] = useState({ open: false, plan: null });
  const [assignModal, setAssignModal] = useState({ open: false, customer: null });
  const [resourceModal, setResourceModal] = useState({ open: false, record: null });
  const [createPlanOpen, setCreatePlanOpen] = useState(false);

  // PHP-style filter bar (Sort by / direction / search) for card-list sections.
  const [listKeyword, setListKeyword] = useState('');
  const [listSort, setListSort] = useState('created_at');
  const [listSortDir, setListSortDir] = useState('desc');
  const [adminGroupFilter, setAdminGroupFilter] = useState('all');

  const resourceConfig = resourceConfigs[activeKey] || null;
  const FILTER_BAR_SECTIONS = ['roles', 'customers', 'plans', 'sending-credit-plans', 'currencies', 'admins', 'admin-groups'];
  const usesFilterBar = FILTER_BAR_SECTIONS.includes(activeKey);
  const customPanel = ['email-verification-plans', 'sending-servers', 'bounce-handlers', 'feedback-handlers', 'email-verification-servers'].includes(activeKey);
  const hideChrome = usesFilterBar || customPanel;

  const filteredRows = useMemo(() => {
    let rows = payload?.data || [];
    const kw = listKeyword.trim().toLowerCase();
    if (kw) rows = rows.filter((r) => `${r.name || ''} ${r.first_name || ''} ${r.last_name || ''} ${r.description || ''}`.toLowerCase().includes(kw));
    rows = [...rows].sort((a, b) => {
      const av = listSort === 'name' ? (a.name || `${a.first_name || ''} ${a.last_name || ''}`) : (a.created_at || '');
      const bv = listSort === 'name' ? (b.name || `${b.first_name || ''} ${b.last_name || ''}`) : (b.created_at || '');
      const cmp = String(av).localeCompare(String(bv));
      return listSortDir === 'desc' ? -cmp : cmp;
    });
    return rows;
  }, [payload, listKeyword, listSort, listSortDir]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    if (!activeSection) { setPayload(null); setLoading(false); return; }
    try {
      const response = activeKey === 'dashboard'
        ? await adminApi.dashboard()
        : await adminApi[activeSection.api]({ page: 1, per_page: 50 });
      setPayload(response.data);
    } catch (err) {
      setError(err.response?.data?.message || t('adm.unable_to_load', null, 'Unable to load this admin section.'));
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [activeKey, activeSection]);

  useEffect(() => { load(); }, [activeKey, load]);

  // ─── Write handlers ───────────────────────────────────────────────────────

  const toggleCustomerStatus = async (customer) => {
    const newStatus = customer.status === 'active' ? 'inactive' : 'active';
    try {
      await adminApi.updateCustomer(customer.id, { status: newStatus });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || t('adm.update_failed', null, 'Update failed.'));
    }
  };

  const handleAdminStatus = async (admin, action) => {
    try {
      await adminApi.setAdminStatus(admin.uid, action);
      toast.success(t('adm.admin_status_updated', { action }, `Admin ${action}d.`));
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || t('adm.update_failed', null, 'Update failed.'));
    }
  };

  const handleAdminOneClick = async (admin) => {
    try {
      const { data } = await adminApi.adminOneClickLogin(admin.uid);
      await navigator.clipboard?.writeText(data.url);
      toast.success(t('adm.one_click_url_copied', null, 'One-click login URL copied to clipboard.'));
    } catch (err) {
      toast.error(err.response?.data?.message || t('adm.could_not_generate_url', null, 'Could not generate the login URL.'));
    }
  };

  const handleAdminDelete = async (admin) => {
    if (!window.confirm(t('adm.confirm_delete_admin', { name: admin.name }, `Delete admin "${admin.name}"?`))) return;
    try {
      await adminApi.deleteAdmin(admin.uid);
      toast.success(t('adm.admin_deleted', null, 'Admin deleted.'));
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || t('adm.delete_failed', null, 'Delete failed.'));
    }
  };

  const handleAdminGroupDelete = async (group) => {
    if (!window.confirm(t('adm.confirm_delete_group', { name: group.name }, `Delete group "${group.name}"?`))) return;
    try {
      await adminApi.deleteAdminGroup(group.id);
      toast.success(t('adm.group_deleted', null, 'Group deleted.'));
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || t('adm.delete_failed', null, 'Delete failed.'));
    }
  };

  const handleSendingServerStatus = async (srv, action) => {
    try {
      await adminApi.setSendingServerStatus(srv.id, action);
      toast.success(t('adm.sending_server_status_updated', { action }, `Sending server ${action}d.`));
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || t('adm.update_failed', null, 'Update failed.'));
    }
  };

  const handleSendingServerDelete = async (srv) => {
    if (!window.confirm(t('adm.confirm_delete_sending_server', { name: srv.name }, `Delete sending server "${srv.name}"?`))) return;
    try {
      await adminApi.deleteSendingServer(srv.id);
      toast.success(t('adm.sending_server_deleted', null, 'Sending server deleted.'));
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || t('adm.delete_failed', null, 'Delete failed.'));
    }
  };

  const handleSendingServerBulkDelete = async (servers) => {
    if (!servers.length) return;
    if (!window.confirm(t('adm.confirm_delete_n_sending_servers', { n: servers.length }, `Delete ${servers.length} selected sending server(s)?`))) return;
    const res = await Promise.allSettled(servers.map((s) => adminApi.deleteSendingServer(s.id)));
    const ok = res.filter((x) => x.status === 'fulfilled').length;
    if (ok) toast.success(t('adm.deleted_n', { n: ok }, `Deleted ${ok}.`));
    if (ok < servers.length) toast.error(t('adm.n_could_not_delete', { n: servers.length - ok }, `${servers.length - ok} could not be deleted.`));
    load();
  };

  const handleHandlerDelete = (deleteFn) => async (row) => {
    if (!window.confirm(t('adm.confirm_delete_named', { name: row.name }, `Delete "${row.name}"?`))) return;
    try {
      await deleteFn(row.uid);
      toast.success(t('adm.deleted', null, 'Deleted.'));
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || t('adm.delete_failed', null, 'Delete failed.'));
    }
  };

  const handleHandlerBulkDelete = (deleteFn) => async (rows) => {
    if (!rows.length) return;
    if (!window.confirm(t('adm.confirm_delete_n_items', { n: rows.length }, `Delete ${rows.length} selected item(s)?`))) return;
    const res = await Promise.allSettled(rows.map((r) => deleteFn(r.uid)));
    const ok = res.filter((x) => x.status === 'fulfilled').length;
    if (ok) toast.success(t('adm.deleted_n', { n: ok }, `Deleted ${ok}.`));
    if (ok < rows.length) toast.error(t('adm.n_could_not_delete', { n: rows.length - ok }, `${rows.length - ok} could not be deleted.`));
    load();
  };

  const handleSavePlan = async (planData) => {
    if (planModal.plan) {
      await adminApi.updatePlan(planModal.plan.id, planData);
    } else {
      await adminApi.createPlan(planData);
    }
    setPlanModal({ open: false, plan: null });
    load();
  };

  const handleDeletePlan = async (plan) => {
    if (!window.confirm(t('adm.confirm_delete_plan', { name: plan.name }, `Delete plan "${plan.name}"? This cannot be undone.`))) return;
    try {
      await adminApi.deletePlan(plan.uid);
      toast.success(t('adm.plan_deleted', null, 'Plan deleted.'));
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || t('adm.delete_failed', null, 'Delete failed.'));
    }
  };

  const handleEvpDelete = async (plan) => {
    if (!window.confirm(t('adm.confirm_delete_plan', { name: plan.name }, `Delete plan "${plan.name}"? This cannot be undone.`))) return;
    try { await adminApi.deleteEmailVerificationPlan(plan.uid); toast.success(t('adm.plan_deleted', null, 'Plan deleted.')); load(); }
    catch (err) { toast.error(err.response?.data?.message || t('adm.could_not_delete_plan', null, 'Could not delete the plan.')); }
  };

  const handleCreditPlanDelete = async (plan) => {
    if (!window.confirm(t('adm.confirm_delete_plan', { name: plan.name }, `Delete plan "${plan.name}"? This cannot be undone.`))) return;
    try { await adminApi.deleteSendingCreditPlan(plan.uid); toast.success(t('adm.plan_deleted', null, 'Plan deleted.')); load(); }
    catch (err) { toast.error(err.response?.data?.message || t('adm.could_not_delete_plan', null, 'Could not delete the plan.')); }
  };

  const handlePlanToggle = async (plan) => {
    try {
      await adminApi.updatePlan(plan.uid, { status: plan.status === 'active' ? 'inactive' : 'active' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || t('adm.could_not_update_plan', null, 'Could not update the plan.'));
    }
  };

  const handlePlanCopy = async (plan) => {
    try { await adminApi.copyPlan(plan.uid); toast.success(t('adm.plan_copied', null, 'Plan copied.')); load(); }
    catch (err) { toast.error(err.response?.data?.message || t('adm.could_not_copy_plan', null, 'Could not copy the plan.')); }
  };

  const handlePlanDelete = handleDeletePlan;

  const handleLoginAs = async (customer) => {
    try {
      const { data } = await adminApi.loginAsCustomer(customer.uid);
      // Stash the admin session and switch to the customer (the ImpersonationBar
      // shows an "Admin Area" tab to return).
      useAuthStore.getState().impersonate(data.token, data.user || null);
      const me = await authApi.me();
      localStorage.setItem('sendq_user', JSON.stringify(me.data.user || me.data));
      useAuthStore.setState({ user: me.data.user || me.data });
      toast.success(t('adm.logged_in_as', { name: customer.first_name || data.user?.email || 'customer' }, `Logged in as ${customer.first_name || data.user?.email || 'customer'}.`));
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || t('adm.could_not_login_customer', null, 'Could not log in as this customer.'));
    }
  };

  const handleCustomerStatus = async (customer, action) => {
    try {
      await adminApi.setCustomerStatus(customer.uid, action);
      toast.success(t('adm.customer_status_updated', { action }, `Customer ${action}d.`));
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || t('adm.could_not_update_customer', null, 'Could not update the customer.'));
    }
  };

  const handleCustomerDelete = async (customer) => {
    if (!window.confirm(t('adm.confirm_delete_customer', { name: `${customer.first_name || ''} ${customer.last_name || ''}` }, `Delete customer "${customer.first_name || ''} ${customer.last_name || ''}"? This cannot be undone.`))) return;
    try {
      await adminApi.deleteCustomer(customer.uid);
      toast.success(t('adm.customer_deleted', null, 'Customer deleted.'));
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || t('adm.could_not_delete_customer', null, 'Could not delete the customer.'));
    }
  };

  const handleApproveInvoice = async (inv) => {
    try { await adminApi.approveInvoice(inv.uid); toast.success(t('adm.invoice_approved', null, 'Invoice approved.')); load(); }
    catch (err) { toast.error(err.response?.data?.message || t('adm.could_not_approve', null, 'Could not approve.')); }
  };
  const handleDeleteInvoice = async (inv) => {
    if (!window.confirm(t('adm.confirm_delete_invoice', null, 'Delete this invoice? This cannot be undone.'))) return;
    try { await adminApi.deleteInvoice(inv.uid); toast.success(t('adm.invoice_deleted', null, 'Invoice deleted.')); load(); }
    catch (err) { toast.error(err.response?.data?.message || t('adm.could_not_delete', null, 'Could not delete.')); }
  };

  const handleApproveSub = async (sub) => {
    try { await adminApi.approveSubscription(sub.uid); toast.success(t('adm.subscription_approved', null, 'Subscription approved.')); load(); }
    catch (err) { toast.error(err.response?.data?.message || t('adm.could_not_approve', null, 'Could not approve.')); }
  };
  const handleSubRecurring = async (sub, on) => {
    try { await adminApi.setSubscriptionRecurring(sub.uid, on); toast.success(on ? t('adm.recurring_enabled', null, 'Recurring enabled.') : t('adm.recurring_disabled', null, 'Recurring disabled.')); load(); }
    catch (err) { toast.error(err.response?.data?.message || t('adm.could_not_update_recurring', null, 'Could not update recurring.')); }
  };
  const handleTerminateSub = async (sub) => {
    if (!window.confirm(t('adm.confirm_cancel_subscription', null, 'Cancel this subscription now?'))) return;
    try { await adminApi.terminateSubscription(sub.uid); toast.success(t('adm.subscription_terminated', null, 'Subscription terminated.')); load(); }
    catch (err) { toast.error(err.response?.data?.message || t('adm.could_not_terminate', null, 'Could not terminate.')); }
  };
  const handleDeleteSub = async (sub) => {
    if (!window.confirm(t('adm.confirm_delete_subscription', null, 'Delete this subscription? This cannot be undone.'))) return;
    try { await adminApi.deleteSubscription(sub.uid); toast.success(t('adm.subscription_deleted', null, 'Subscription deleted.')); load(); }
    catch (err) { toast.error(err.response?.data?.message || t('adm.could_not_delete', null, 'Could not delete.')); }
  };

  const handleRoleStatus = async (role, action) => {
    try {
      await adminApi.setRoleStatus(role.uid, action);
      toast.success(t('adm.role_status_updated', { action }, `Role ${action}d.`));
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || t('adm.could_not_update_role', null, 'Could not update the role.'));
    }
  };

  const handleRoleDelete = async (role) => {
    if (!window.confirm(t('adm.confirm_delete_role', { name: role.name }, `Delete role "${role.name}"? This cannot be undone.`))) return;
    try {
      await adminApi.deleteRole(role.uid);
      toast.success(t('adm.role_deleted', null, 'Role deleted.'));
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || t('adm.could_not_delete_role', null, 'Could not delete the role.'));
    }
  };

  const handleLoginAsUser = async (user) => {
    try {
      const { data } = await adminApi.loginAsUser(user.uid);
      localStorage.setItem('sendq_token', data.token);
      const me = await authApi.me();
      localStorage.setItem('sendq_user', JSON.stringify(me.data.user || me.data));
      useAuthStore.setState({ token: data.token, user: me.data.user || me.data });
      toast.success(t('adm.logged_in_as', { name: user.email || 'user' }, `Logged in as ${user.email || 'user'}.`));
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || t('adm.could_not_login_user', null, 'Could not log in as this user.'));
    }
  };

  const handleOneClickUrl = async (user) => {
    try {
      const { data } = await adminApi.oneClickLogin(user.uid);
      await navigator.clipboard?.writeText(data.url);
      toast.success(t('adm.one_click_url_copied', null, 'One-click login URL copied to clipboard.'));
    } catch (err) {
      toast.error(err.response?.data?.message || t('adm.could_not_generate_url', null, 'Could not generate the login URL.'));
    }
  };

  const handleUserStatus = async (user, action) => {
    try {
      await adminApi.setUserStatus(user.uid, action);
      toast.success(t('adm.user_status_updated', { action }, `User ${action}d.`));
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || t('adm.could_not_update_user', null, 'Could not update the user.'));
    }
  };

  const handleUserDelete = async (user) => {
    if (!window.confirm(t('adm.confirm_delete_user', { email: user.email }, `Delete user "${user.email}"? This cannot be undone.`))) return;
    try {
      await adminApi.deleteUser(user.uid);
      toast.success(t('adm.user_deleted', null, 'User deleted.'));
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || t('adm.could_not_delete_user', null, 'Could not delete the user.'));
    }
  };

  const handleAssignPlan = async (planId, endsAt) => {
    await adminApi.assignPlan({
      customer_id: assignModal.customer.id,
      plan_id: planId,
      ends_at: endsAt || null,
    });
    setAssignModal({ open: false, customer: null });
    load();
  };

  const handleUpdateSubscriptionStatus = async (subscription, newStatus) => {
    try {
      await adminApi.updateSubscription(subscription.id, { status: newStatus });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || t('adm.update_failed', null, 'Update failed.'));
    }
  };

  // Generic resource handlers (currencies, settings, and future CRUD modules)
  const handleResourceSave = async (data) => {
    const editing = resourceModal.record;
    if (resourceConfig.save) {
      await resourceConfig.save(data, editing);
    } else if (editing) {
      await resourceConfig.api.update(editing.id, data);
    } else {
      await resourceConfig.api.create(data);
    }
    setResourceModal({ open: false, record: null });
    load();
  };

  const handleResourceDelete = async (row) => {
    if (!resourceConfig?.api?.remove) return;
    if (!window.confirm(t('adm.confirm_delete_resource', { label: resourceConfig.label.toLowerCase() }, `Delete this ${resourceConfig.label.toLowerCase()}? This cannot be undone.`))) return;
    try {
      await resourceConfig.api.remove(row.id);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || t('adm.delete_failed', null, 'Delete failed.'));
    }
  };

  // ─── Row actions per section ──────────────────────────────────────────────

  const renderActionsFor = (sectionKey) => {
    if (sectionKey === 'users') {
      return (row) => (
        <UserRowActions
          user={row}
          onLoginAs={() => handleLoginAsUser(row)}
          onEdit={() => setResourceModal({ open: true, record: row })}
          onOneClick={() => handleOneClickUrl(row)}
          onStatus={(action) => handleUserStatus(row, action)}
          onDelete={() => handleUserDelete(row)}
        />
      );
    }
    if (sectionKey === 'customers') {
      return (row) => (
        <div className="admin-row-actions">
          <button
            type="button"
            className={`admin-toggle-btn ${row.status === 'active' ? 'deactivate' : 'activate'}`}
            onClick={() => toggleCustomerStatus(row)}
          >
            {row.status === 'active' ? t('adm.deactivate', null, 'Deactivate') : t('adm.activate', null, 'Activate')}
          </button>
          <button
            type="button"
            className="btn-secondary admin-assign-btn"
            onClick={() => setAssignModal({ open: true, customer: row })}
          >
            {t('adm.assign_plan', null, 'Assign plan')}
          </button>
        </div>
      );
    }

    if (sectionKey === 'plans') {
      return (row) => (
        <div className="admin-row-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setPlanModal({ open: true, plan: row })}
          >
            {t('common.edit', null, 'Edit')}
          </button>
          <button
            type="button"
            className="admin-delete-btn"
            onClick={() => handleDeletePlan(row)}
          >
            {t('common.delete', null, 'Delete')}
          </button>
        </div>
      );
    }

    if (sectionKey === 'subscriptions') {
      return (row) => (
        <div className="admin-row-actions">
          <select
            className="admin-status-select"
            value={row.status || 'active'}
            onChange={(e) => handleUpdateSubscriptionStatus(row, e.target.value)}
          >
            <option value="active">{t('adm.status_active', null, 'Active')}</option>
            <option value="expired">{t('adm.status_expired', null, 'Expired')}</option>
            <option value="suspended">{t('adm.status_suspended', null, 'Suspended')}</option>
          </select>
        </div>
      );
    }

    if (resourceConfigs[sectionKey]) {
      const cfg = resourceConfigs[sectionKey];
      if (!canUpdate(cfg) && !canDelete(cfg)) return null;
      return (row) => (
        <div className="admin-row-actions">
          {canUpdate(cfg) && (
            <button type="button" className="btn-secondary" onClick={() => setResourceModal({ open: true, record: row })}>
              {t('common.edit', null, 'Edit')}
            </button>
          )}
          {canDelete(cfg) && (
            <button type="button" className="admin-delete-btn" onClick={() => handleResourceDelete(row)}>
              {t('common.delete', null, 'Delete')}
            </button>
          )}
        </div>
      );
    }

    return null;
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  const renderBody = () => {
    if (loading) return <AdminEmpty text={t('adm.loading_admin_data', null, 'Loading admin data')} />;
    if (!activeSection) return <AdminEmpty text={t('adm.module_not_mapped', null, 'This admin module is not mapped yet')} />;
    if (error) return <AdminEmpty text={error} />;
    if (activeKey === 'dashboard') return <AdminDashboard data={payload} navigate={navigate} displayName={displayName} />;
    if (activeKey === 'customers') {
      return (
        <AdminCustomersList
          rows={filteredRows}
          navigate={navigate}
          onEdit={(c) => setResourceModal({ open: true, record: c })}
          onAssign={(c) => setAssignModal({ open: true, customer: c })}
          onLoginAs={handleLoginAs}
          onStatus={handleCustomerStatus}
          onDelete={handleCustomerDelete}
        />
      );
    }
    if (activeKey === 'roles') {
      return (
        <RolesList
          rows={filteredRows}
          onEdit={(r) => navigate(`/admin/roles/${r.uid}/edit`)}
          onStatus={handleRoleStatus}
          onDelete={handleRoleDelete}
        />
      );
    }
    if (activeKey === 'admins') {
      const rows = adminGroupFilter === 'all' ? filteredRows : filteredRows.filter((a) => a.group_name === adminGroupFilter);
      return <AdminsList rows={rows} navigate={navigate} onStatus={handleAdminStatus} onOneClick={handleAdminOneClick} onDelete={handleAdminDelete} />;
    }
    if (activeKey === 'admin-groups') {
      return <AdminGroupsList rows={filteredRows} navigate={navigate} onDelete={handleAdminGroupDelete} />;
    }
    if (activeKey === 'email-verification-plans') {
      return <EvpPanel rows={payload?.data || []} navigate={navigate} onDelete={handleEvpDelete} />;
    }
    if (activeKey === 'sending-servers') {
      return <SendingServersPanel rows={payload?.data || []} navigate={navigate} onStatus={handleSendingServerStatus} onDelete={handleSendingServerDelete} onBulkDelete={handleSendingServerBulkDelete} />;
    }
    if (activeKey === 'bounce-handlers') {
      return <HandlerListPanel cfg={BOUNCE_HANDLER_CFG} rows={payload?.data || []} navigate={navigate} onDelete={handleHandlerDelete(adminApi.deleteBounceHandler)} onBulkDelete={handleHandlerBulkDelete(adminApi.deleteBounceHandler)} />;
    }
    if (activeKey === 'feedback-handlers') {
      return <HandlerListPanel cfg={FEEDBACK_HANDLER_CFG} rows={payload?.data || []} navigate={navigate} onDelete={handleHandlerDelete(adminApi.deleteFeedbackHandler)} onBulkDelete={handleHandlerBulkDelete(adminApi.deleteFeedbackHandler)} />;
    }
    if (activeKey === 'email-verification-servers') {
      return <HandlerListPanel cfg={EVS_CFG} rows={payload?.data || []} navigate={navigate} onDelete={handleHandlerDelete(adminApi.deleteEmailVerificationServer)} onBulkDelete={handleHandlerBulkDelete(adminApi.deleteEmailVerificationServer)} />;
    }
    if (activeKey === 'currencies') {
      return (
        <CurrenciesList
          rows={filteredRows}
          onEdit={(c) => navigate(`/admin/currencies/${c.id}/edit`)}
          onDelete={handleResourceDelete}
        />
      );
    }
    if (activeKey === 'sending-credit-plans') {
      return (
        <CreditPlansList
          rows={filteredRows}
          intro="With Sending Credit Plans, customers can now subscribe and purchase additional sending credits without the need to upgrade their subscription. This allows for increased flexibility, enabling users to pay for and access extra sending credits as needed."
          onEdit={(p) => navigate(`/admin/sending-credit-plans/${p.uid}/edit`)}
          onDelete={(p) => handleCreditPlanDelete(p)}
        />
      );
    }
    if (activeKey === 'plans') {
      return (
        <AdminPlansList
          rows={filteredRows}
          navigate={navigate}
          onToggle={handlePlanToggle}
          onCopy={handlePlanCopy}
          onDelete={handlePlanDelete}
        />
      );
    }
    if (activeKey === 'invoices') {
      return (
        <AdminInvoicesPanel
          rows={payload?.data || []}
          navigate={navigate}
          onApprove={handleApproveInvoice}
          onDelete={handleDeleteInvoice}
        />
      );
    }
    if (activeKey === 'subscriptions') {
      return (
        <AdminSubscriptionsList
          rows={payload?.data || []}
          navigate={navigate}
          onApprove={handleApproveSub}
          onRecurring={handleSubRecurring}
          onTerminate={handleTerminateSub}
          onDelete={handleDeleteSub}
        />
      );
    }
    if (activeKey === 'reports') return <ReportsPanel data={payload?.data} />;
    if (payload?.type === 'settings') return <ConfigPanel payload={payload} onSaved={load} />;
    if (payload?.type === 'monitor') return <MonitorPanel payload={payload} />;
    if (payload?.type === 'languages') return <LanguagesPanel payload={payload} />;

    const renderActions = renderActionsFor(activeKey);
    return (
      <AdminTable
        sectionKey={activeKey}
        rows={payload?.data || []}
        message={payload?.message}
        renderActions={renderActions}
      />
    );
  };

  return (
    <AppLayout>
      <div className="admin-page">
        <header className="admin-header">
          <nav>
            <button type="button" onClick={() => navigate('/dashboard')}>{t('adm.home', null, 'Home')}</button>
            <span>›</span>
            <button type="button" onClick={() => navigate('/admin')}>{t('adm.admin', null, 'Admin')}</button>
            {activeKey !== 'dashboard' && (
              <>
                <span>›</span>
                <span>{activeSection?.label || requestedKey}</span>
              </>
            )}
          </nav>

          {!hideChrome && (
            <div className="admin-top-actions">
              <button type="button" className="btn-secondary" onClick={() => navigate('/dashboard')}>{t('adm.customer_view', null, 'Customer view')}</button>
              {activeKey === 'plans' && (
                <button type="button" className="btn-primary" onClick={() => setPlanModal({ open: true, plan: null })}>
                  <span className="material-symbols-rounded">add</span> {t('adm.create_plan', null, 'Create plan')}
                </button>
              )}
              {canCreate(resourceConfig) && (
                <button type="button" className="btn-primary" onClick={() => setResourceModal({ open: true, record: null })}>
                  <span className="material-symbols-rounded">add</span> {resourceConfig.createLabel || t('adm.new_resource', { label: resourceConfig.label.toLowerCase() }, `New ${resourceConfig.label.toLowerCase()}`)}
                </button>
              )}
              <button type="button" className="btn-secondary" onClick={load}>{t('adm.refresh', null, 'Refresh')}</button>
            </div>
          )}

          {activeKey !== 'dashboard' && (
            <>
              <h1><span className="material-symbols-rounded">{activeSection?.icon || 'admin_panel_settings'}</span>{activeSection?.label || t('adm.admin_module', null, 'Admin module')}</h1>
              {!hideChrome && <p>{t('adm.original_module_view', null, 'Original SendQ admin module view.')}</p>}
            </>
          )}
        </header>

        <section className="admin-content">
          {usesFilterBar ? (
            <div className="admin-filter-bar">
              <span className="admin-filter-label">{t('adm.sort_by', null, 'Sort by')}</span>
              <select className="input" value={listSort} onChange={(e) => setListSort(e.target.value)}>
                <option value="created_at">{t('adm.created_at', null, 'Created at')}</option>
                <option value="name">{t('common.name', null, 'Name')}</option>
              </select>
              <button type="button" className="btn-secondary admin-icon-btn" title={t('adm.sort_direction', null, 'Sort direction')} onClick={() => setListSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))}>
                <span className="material-symbols-rounded">sort</span>
              </button>
              {activeKey === 'admins' && (
                <>
                  <span className="admin-filter-label">{t('adm.group', null, 'Group')}</span>
                  <select className="input" value={adminGroupFilter} onChange={(e) => setAdminGroupFilter(e.target.value)}>
                    <option value="all">{t('adm.all', null, 'All')}</option>
                    {[...new Set((payload?.data || []).map((a) => a.group_name))].filter(Boolean).map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </>
              )}
              <div className="admin-filter-search">
                <input className="input" placeholder={t('adm.type_to_search', null, 'Type to search')} value={listKeyword} onChange={(e) => setListKeyword(e.target.value)} />
                <span className="material-symbols-rounded">search</span>
              </div>
              {activeKey === 'admins' ? (
                <button type="button" className="btn-secondary admin-filter-add" onClick={() => navigate('/admin/admins/new')}>
                  <span className="material-symbols-rounded">add</span> {t('adm.create_admin', null, 'Create admin')}
                </button>
              ) : activeKey === 'admin-groups' ? (
                <button type="button" className="btn-secondary admin-filter-add" onClick={() => navigate('/admin/admin-groups/new')}>
                  <span className="material-symbols-rounded">add</span> {t('adm.create_group', null, 'Create group')}
                </button>
              ) : activeKey === 'roles' ? (
                <button type="button" className="btn-secondary admin-filter-add" onClick={() => navigate('/admin/roles/new')}>
                  <span className="material-symbols-rounded">add</span> {t('adm.add_role', null, 'Add role')}
                </button>
              ) : activeKey === 'plans' ? (
                <button type="button" className="btn-secondary admin-filter-add" onClick={() => setCreatePlanOpen(true)}>
                  <span className="material-symbols-rounded">add</span> {t('adm.create_plan', null, 'Create plan')}
                </button>
              ) : activeKey === 'sending-credit-plans' ? (
                <button type="button" className="btn-secondary admin-filter-add" onClick={() => navigate('/admin/sending-credit-plans/new')}>
                  <span className="material-symbols-rounded">add</span> {t('adm.add_new_plan', null, 'Add new Plan')}
                </button>
              ) : canCreate(resourceConfig) && (
                <button type="button" className="btn-secondary admin-filter-add" onClick={() => setResourceModal({ open: true, record: null })}>
                  <span className="material-symbols-rounded">add</span> {resourceConfig.createLabel || t('adm.add_resource', { label: resourceConfig.label.toLowerCase() }, `Add ${resourceConfig.label.toLowerCase()}`)}
                </button>
              )}
            </div>
          ) : (activeKey !== 'dashboard' && !customPanel) && (
            <div className="admin-content-head">
              <h2>{activeSection?.label || t('adm.admin_module', null, 'Admin module')}</h2>
              {payload?.pagination && <span>{t('adm.n_records', { n: payload.pagination.total }, `${payload.pagination.total} records`)}</span>}
            </div>
          )}
          {renderBody()}
        </section>

        <footer className="admin-footer">
          {t('adm.footer_copyright', null, 'Copyright © 2025. SendQ - Send with Unlimited Confidence Email Marketing. All Rights Reserved.')}
        </footer>
      </div>

      {planModal.open && (
        <PlanModal
          plan={planModal.plan}
          onSave={handleSavePlan}
          onClose={() => setPlanModal({ open: false, plan: null })}
        />
      )}

      {createPlanOpen && (
        <CreatePlanModal onClose={() => setCreatePlanOpen(false)} onCreated={load} />
      )}

      {assignModal.open && (
        <AssignPlanModal
          customer={assignModal.customer}
          onAssign={handleAssignPlan}
          onClose={() => setAssignModal({ open: false, customer: null })}
        />
      )}

      {resourceModal.open && resourceConfig && (
        <ResourceModal
          config={resourceConfig}
          record={resourceModal.record}
          onSave={handleResourceSave}
          onClose={() => setResourceModal({ open: false, record: null })}
        />
      )}
    </AppLayout>
  );
};

export default AdminPage;
