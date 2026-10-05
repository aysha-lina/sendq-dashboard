import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import clsx from 'clsx';
import { useTranslation, navKey, LOCALES } from '../../i18n/index.jsx';
import { Toaster } from '../ui';
import { adminApi } from '../../api/services';
import { canAccessAdminPath } from '../../utils/access';
import ImpersonationBar from './ImpersonationBar';

const LanguageSwitcher = () => {
  const { locale, setLocale, t } = useTranslation();
  return (
    <select
      className="sendq-lang-switcher input"
      style={{ height: 36, padding: '4px 8px', width: 'auto' }}
      value={locale}
      onChange={(e) => setLocale(e.target.value)}
      title={t('common.language', null, 'Language')}
      aria-label={t('common.language', null, 'Language')}
    >
      {LOCALES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
    </select>
  );
};

const ACTIVITY_LOGS_KEY = 'sendq.activityLogs';

const Icon = ({ children }) => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
    {children}
  </svg>
);

const SendQLogo = () => (
  <img
    className="sendq-logo-image"
    src="/assets/3.png"
    alt="SendQ"
  />
);

const SearchOverlay = ({ onClose }) => {
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false); // drives the pop-open / close animation
  const trimmedQuery = query.trim().toLowerCase();
  const results = trimmedQuery
    ? searchablePages
      .filter((page) => page.searchText.includes(trimmedQuery))
      .slice(0, 8)
    : [];

  // Play the close animation, then unmount after it finishes.
  const close = () => {
    setOpen(false);
    window.setTimeout(onClose, 180);
  };

  const goToResult = (path) => {
    navigate(path);
    close();
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (results[0]) {
      goToResult(results[0].to);
    }
  };

  useEffect(() => {
    inputRef.current?.focus();
    const raf = requestAnimationFrame(() => setOpen(true)); // trigger open animation

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        close();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', handleKeyDown);
    };
     
  }, []);

  return (
    <div
      className={clsx('sq-search-root', open ? 'is-open' : 'is-closed')}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          close();
        }
      }}
    >
      <form onSubmit={handleSubmit} className="sq-search-bar">
        <button type="button" onClick={close} className="sq-search-close" aria-label="Close search">
          <Icon><path d="M6 6 18 18M18 6 6 18" /></Icon>
        </button>
        <label className="sq-search-input">
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Type to search"
          />
          <span className="sq-search-mag">
            <Icon><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></Icon>
          </span>
        </label>
      </form>

      <div className="sq-search-card">
        {!trimmedQuery && (
          <div className="sq-search-empty">
            <div className="sq-search-illus">
              <svg viewBox="0 0 130 112" fill="none" aria-hidden="true">
                <circle cx="50" cy="46" r="40" fill="#d4e6f4" stroke="#1565c0" strokeWidth="4.5" />
                <path d="M26 39a26 26 0 0 1 16-18" stroke="#1e88e5" strokeWidth="4.5" strokeLinecap="round" />
                <rect x="38" y="36" width="76" height="22" rx="6" stroke="#9aa6b2" strokeWidth="3" />
                <rect x="44" y="31" width="24" height="32" rx="3" fill="#d4e6f4" stroke="#9aa6b2" strokeWidth="3" />
                <text x="56" y="54" textAnchor="middle" fill="#5b6675" fontFamily="Arial, sans-serif" fontSize="22" fontWeight="600">a</text>
                <path d="M73 35v24M78 35v24" stroke="#9aa6b2" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M79 75 108 104" stroke="#1565c0" strokeWidth="5.5" strokeLinecap="round" />
              </svg>
            </div>
            <p className="sq-search-hint">Type something you want to search for</p>
          </div>
        )}

        {trimmedQuery && results.length > 0 && (
          <div className="sq-search-results">
            {results.map((result) => (
              <button key={result.to} type="button" onClick={() => goToResult(result.to)} className="sq-search-result">
                <span>
                  <span className="sq-search-result-label">{result.label}</span>
                  <span className="sq-search-result-section">{result.section}</span>
                </span>
                <span className="sq-search-open">Open</span>
              </button>
            ))}
          </div>
        )}

        {trimmedQuery && results.length === 0 && (
          <div className="sq-search-empty">
            <p className="sq-search-hint">No matching pages found</p>
            <p className="sq-search-sub">Try searching for a section or page name.</p>
          </div>
        )}
      </div>
    </div>
  );
};

const navItems = [
  { label: 'Dashboard', to: '/dashboard', icon: <Icon><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10.5V20h5v-5h3v5h5v-9.5" /></Icon> },
  { label: 'Campaigns', to: '/campaigns', icon: <Icon><path d="m3 11 18-8-7 18-3-7-8-3Z" /><path d="m11 14 4-5" /></Icon> },
  {
    label: 'Lists',
    to: '/lists/overview',
    hasArrow: true,
    icon: <Icon><path d="M5 5h11v14H5z" /><path d="M8 9h5M8 13h4" /><path d="M17 9h2v10h-2" /></Icon>,
    children: [
      { label: 'Overview', to: '/lists/overview', icon: <Icon><path d="M4 18h3v-6H4zM10.5 18h3V8h-3zM17 18h3V4h-3z" /><path d="M4 10 9 7l4 2 7-6" /></Icon> },
      { label: 'Lists', to: '/lists/all', icon: <Icon><path d="M5 4h13v16H5z" /><path d="M8 8h7M8 12h7M8 16h4" /></Icon> },
      { label: 'Contacts', to: '/lists/contacts', icon: <Icon><path d="M8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" /><path d="M2 21a6 6 0 0 1 12 0" /><path d="M17 8a3 3 0 1 1 0 6M16 17a5 5 0 0 1 5 4" /></Icon> },
      { label: 'Segments', to: '/lists/segments', icon: <Icon><path d="M4 4h6v7H4zM14 4h6v7h-6zM4 15h6v5H4zM14 15h6v5h-6z" /></Icon> },
      { label: 'Forms & Popups', to: '/lists/forms', icon: <Icon><path d="M4 5h16v14H4z" /><path d="M7 9h10M7 13h6M7 17h4" /></Icon> },
    ],
  },
  { label: 'Templates', to: '/templates', icon: <Icon><path d="M4 20h16" /><path d="M5 18 17.5 5.5l2 2L7 20H5v-2Z" /><path d="M14 7 17 10" /></Icon> },
  {
    label: 'Sending',
    to: '/sending/domains',
    hasArrow: true,
    icon: <Icon><path d="M3 12a9 9 0 0 1 15.5-6" /><path d="M21 12a9 9 0 0 1-15.5 6" /><path d="M18 3v5h-5M6 21v-5h5" /></Icon>,
    children: [
      { label: 'Sending domains', to: '/sending/domains', icon: <Icon><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></Icon> },
      { label: 'Tracking domains', to: '/sending/tracking-domains', icon: <Icon><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></Icon> },
      { label: 'Email verification servers', to: '/sending/verification-servers', icon: <Icon><path d="M4 5h16v4H4zM4 10h16v4H4zM4 15h16v4H4z" /><path d="M7 7h.01M7 12h.01M7 17h.01" /></Icon> },
      { label: 'Blacklist', to: '/sending/blacklist', icon: <Icon><path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" /><path d="M3 21a6 6 0 0 1 10.5-4" /><path d="m17 15 4 4M21 15l-4 4" /></Icon> },
      { label: 'Signatures', to: '/sending/signatures', icon: <Icon><path d="M4 18c3-7 4-7 6 0 1.5-4 3-4 4.5 0 1-2 2-2 3 0" /><path d="M4 21h16" /></Icon> },
      { label: 'Senders', to: '/sending/senders', icon: <Icon><path d="M4 4h16v16H4z" /><path d="m4 6 8 6 8-6" /></Icon> },
    ],
  },
  {
    label: 'Integration',
    to: '/integration/website',
    hasArrow: true,
    icon: <Icon><path d="M4 5h8v8H4zM12 11h8v8h-8z" /><path d="M7 16v3h3" /></Icon>,
    children: [
      { label: 'Add your website', to: '/integration/website', icon: <Icon><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18" /><path d="M18 18h4M20 16v4" /></Icon> },
      { label: 'Manage connections', to: '/integration/connections', icon: <Icon><path d="M7 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM17 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM17 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /><path d="M9.5 6h5M8.5 9.5l6 6" /></Icon> },
    ],
  },
  { label: 'Campaign API', to: '/campaign-api', icon: <Icon><path d="M12 8v8M8 12h8" /><path d="M12 2v3M12 19v3M4.9 4.9 7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1" /></Icon> },
];

const adminNavItems = [
  { label: 'Dashboard', to: '/admin', icon: <Icon><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10.5V20h5v-5h3v5h5v-9.5" /></Icon> },
  {
    label: 'Customer',
    to: '/admin/customers',
    hasArrow: true,
    icon: <Icon><circle cx="12" cy="7" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></Icon>,
    children: [
      { label: 'Customers', to: '/admin/customers', icon: <Icon><circle cx="12" cy="7" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></Icon> },
      { label: 'Roles', to: '/admin/roles', icon: <Icon><path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6l-7-3Z" /></Icon> },
      { label: 'Subscriptions', to: '/admin/subscriptions', icon: <Icon><path d="M3 12a9 9 0 0 1 15.5-6" /><path d="M21 12a9 9 0 0 1-15.5 6" /></Icon> },
      { label: 'Invoices', to: '/admin/invoices', icon: <Icon><path d="M5 3h14v18l-3-2-3 2-3-2-3 2V3Z" /><path d="M8 8h8M8 12h8" /></Icon> },
    ],
  },
  {
    label: 'Plan',
    to: '/admin/plans',
    hasArrow: true,
    icon: <Icon><path d="M5 4h12l2 2v14H5z" /><path d="M8 9h8M8 13h6M8 17h5" /></Icon>,
    children: [
      { label: 'Manage Plans', to: '/admin/plans', icon: <Icon><path d="M5 4h12l2 2v14H5z" /><path d="M8 9h8M8 13h6M8 17h5" /></Icon> },
      { label: 'Sending Credit plans', to: '/admin/sending-credit-plans', icon: <Icon><path d="m3 11 18-8-7 18-3-7-8-3Z" /><path d="m11 14 4-5" /></Icon> },
      { label: 'Email verification plans', to: '/admin/email-verification-plans', icon: <Icon><path d="M4 6h16v12H4z" /><path d="m4 7 8 6 8-6" /><path d="m9 13 2 2 4-5" /></Icon> },
      { label: 'Currencies', to: '/admin/currencies', icon: <Icon><path d="M12 3v18M8 7h6.5a3.5 3.5 0 0 1 0 7H9" /></Icon> },
      { label: 'Tax settings', to: '/admin/taxes', icon: <Icon><path d="M19 5 5 19" /><circle cx="7" cy="7" r="2" /><circle cx="17" cy="17" r="2" /></Icon> },
      { label: 'Invoice template', to: '/admin/invoice-template', icon: <Icon><path d="M6 3h9l3 3v15H6z" /><path d="M9 8h6M9 12h6M9 16h4" /></Icon> },
    ],
  },
  {
    label: 'Admin',
    to: '/admin/admins',
    hasArrow: true,
    icon: <Icon><circle cx="12" cy="7" r="4" /><path d="M5 21a7 7 0 0 1 14 0" /><path d="m9 14 3 3 3-3" /></Icon>,
    children: [
      { label: 'Administrators', to: '/admin/admins', icon: <Icon><circle cx="12" cy="7" r="4" /><path d="M5 21a7 7 0 0 1 14 0" /></Icon> },
      { label: 'Admin groups', to: '/admin/admin-groups', icon: <Icon><path d="M7 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" /><path d="M2 21a6 6 0 0 1 12 0M17 8a3 3 0 1 1 0 6M16 17a5 5 0 0 1 5 4" /></Icon> },
      { label: 'Users', to: '/admin/users', icon: <Icon><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></Icon> },
    ],
  },
  {
    label: 'Sending',
    to: '/admin/sending-servers',
    hasArrow: true,
    icon: <Icon><path d="M3 12a9 9 0 0 1 15.5-6" /><path d="M21 12a9 9 0 0 1-15.5 6" /><path d="M18 3v5h-5M6 21v-5h5" /></Icon>,
    children: [
      { label: 'Sending servers', to: '/admin/sending-servers', icon: <Icon><path d="M4 5h16v5H4zM4 14h16v5H4z" /><path d="M7 7.5h.01M7 16.5h.01" /></Icon> },
      { label: 'Bounce handlers', to: '/admin/bounce-handlers', icon: <Icon><path d="M21 10H3" /><path d="m8 5-5 5 5 5" /><path d="M21 14v-2a4 4 0 0 0-4-4" /></Icon> },
      { label: 'Feedback loop handlers', to: '/admin/feedback-handlers', icon: <Icon><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></Icon> },
      { label: 'Email verification servers', to: '/admin/email-verification-servers', icon: <Icon><path d="M4 5h16v4H4zM4 10h16v4H4zM4 15h16v4H4z" /></Icon> },
    ],
  },
  {
    label: 'Setting',
    to: '/admin/settings',
    hasArrow: true,
    icon: <Icon><path d="M12 8v8M8 12h8" /><path d="M12 2v3M12 19v3M4.9 4.9 7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1" /></Icon>,
    children: [
      { label: 'All settings', to: '/admin/settings', icon: <Icon><path d="M12 8v8M8 12h8" /></Icon> },
      { label: 'OAuth', to: '/admin/oauth', icon: <Icon><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Icon> },
      { label: 'Template Gallery', to: '/admin/template-gallery', icon: <Icon><path d="M4 5h16v14H4z" /><path d="M4 9h16M9 9v10" /></Icon> },
      { label: 'Form templates', to: '/admin/form-templates', icon: <Icon><path d="M6 3h12v18H6z" /><path d="M9 8h6M9 12h6M9 16h4" /></Icon> },
      { label: 'Custom Emails & Pages', to: '/admin/custom-emails', icon: <Icon><path d="M4 6h16v12H4z" /><path d="m4 7 8 6 8-6" /></Icon> },
      { label: 'Language', to: '/admin/languages', icon: <Icon><path d="M4 5h7M9 3v2c0 5-3 8-6 9" /><path d="M5 9c0 3 3 5 6 6M13 19l4-9 4 9M14.5 16h5" /></Icon> },
      { label: 'Payment gateways', to: '/admin/payment-gateways', icon: <Icon><path d="M3 7h18v11H3z" /><path d="M3 11h18" /></Icon> },
      { label: 'Webhooks', to: '/admin/webhooks', icon: <Icon><circle cx="12" cy="12" r="9" /><path d="M12 8v4l3 3" /></Icon> },
    ],
  },
  {
    label: 'Plugin',
    to: '/admin/plugins',
    hasArrow: true,
    icon: <Icon><path d="m8 13-3 3a4 4 0 0 0 6 6l3-3" /><path d="m16 11 3-3a4 4 0 0 0-6-6l-3 3" /><path d="m9 15 6-6" /></Icon>,
    children: [
      { label: 'New plugin', to: '/admin/plugins/new', icon: <Icon><path d="M12 5v14M5 12h14" /></Icon> },
      { label: 'All plugins', to: '/admin/plugins', icon: <Icon><path d="M8 4h8v6h4v10H4V10h4z" /></Icon> },
    ],
  },
  {
    label: 'Report',
    to: '/admin/blacklist',
    hasArrow: true,
    icon: <Icon><path d="M4 4h16v16H4z" /><path d="M8 16V9M12 16v-5M16 16V7" /></Icon>,
    children: [
      { label: 'Blacklist', to: '/admin/blacklist', icon: <Icon><path d="m17 15 4 4M21 15l-4 4" /><path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" /></Icon> },
      { label: 'Delivery log', to: '/admin/tracking-log', icon: <Icon><path d="M4 12a8 8 0 1 0 2.3-5.7" /><path d="M4 4v5h5" /></Icon> },
      { label: 'Bounce log', to: '/admin/bounce-log', icon: <Icon><path d="m3 11 18-8-7 18-3-7-8-3Z" /></Icon> },
      { label: 'Feedback log', to: '/admin/feedback-log', icon: <Icon><path d="M4 7h16v10H4z" /><path d="m4 8 8 6 8-6" /></Icon> },
      { label: 'Open log', to: '/admin/open-log', icon: <Icon><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></Icon> },
      { label: 'Click log', to: '/admin/click-log', icon: <Icon><path d="M7 3v18l5-5 3 5 3-2-3-5h6z" /></Icon> },
      { label: 'Unsubscribe log', to: '/admin/unsubscribe-log', icon: <Icon><path d="M4 6h16v12H4z" /><path d="m4 7 8 6 8-6" /><path d="m8 20 8-8" /></Icon> },
    ],
  },
];

// Which collapsible parent (if any) owns the current path — so its submenu opens by default.
const getActiveParentLabel = (items, pathname) => {
  for (const item of items) {
    if (!item.children) continue;
    if (pathname === item.to) return item.label;
    if (item.children.some((c) => pathname === c.to || pathname.startsWith(`${c.to}/`))) return item.label;
  }
  return null;
};

const flattenNavItems = (items, section = 'Main') => items.flatMap((item) => {
  const current = {
    label: item.label,
    section,
    to: item.to,
    searchText: `${item.label} ${section} ${item.to}`.toLowerCase(),
  };

  if (!item.children) {
    return [current];
  }

  return [
    current,
    ...flattenNavItems(item.children, item.label),
  ];
});

// Hide admin nav sections/links the user can't access (S7). A parent stays if its own
// landing page is reachable OR at least one child is; children are filtered individually.
const filterAdminNav = (items, user) => items
  .map((item) => {
    if (item.children) {
      const children = item.children.filter((c) => canAccessAdminPath(user, c.to));
      const parentReachable = canAccessAdminPath(user, item.to);
      if (!children.length && !parentReachable) return null;
      return { ...item, children };
    }
    return canAccessAdminPath(user, item.to) ? item : null;
  })
  .filter(Boolean);

const extraSearchPages = [
  { label: 'Create form', section: 'Forms & Popups', to: '/lists/forms/create' },
  { label: 'List settings', section: 'Lists', to: '/lists/settings' },
  { label: 'Manage list fields', section: 'Lists', to: '/lists/fields' },
  { label: 'Email verification', section: 'Lists', to: '/lists/email-verification' },
  { label: 'New sending domain', section: 'Sending', to: '/sending/domains/new' },
  { label: 'Tracking domains', section: 'Sending', to: '/sending/tracking-domains' },
  { label: 'Email verification servers', section: 'Sending', to: '/sending/verification-servers' },
  { label: 'Blacklist', section: 'Sending', to: '/sending/blacklist' },
  { label: 'Signatures', section: 'Sending', to: '/sending/signatures' },
  { label: 'Analytics', section: 'Reports', to: '/analytics' },
  { label: 'Billing', section: 'Account', to: '/billing' },
  { label: 'Activities', section: 'Account', to: '/activities' },
  { label: 'Admin panel', section: 'Administrator', to: '/admin' },
  { label: 'Admin users', section: 'Administrator', to: '/admin/users' },
  { label: 'Admin groups', section: 'Administrator', to: '/admin/admin-groups' },
  { label: 'Customers', section: 'Administrator', to: '/admin/customers' },
  { label: 'Plans', section: 'Administrator', to: '/admin/plans' },
  { label: 'Reports', section: 'Administrator', to: '/admin/reports' },
];

const searchablePages = [
  ...flattenNavItems(navItems),
  ...flattenNavItems(adminNavItems, 'Admin'),
  ...extraSearchPages.map((page) => ({
    ...page,
    searchText: `${page.label} ${page.section} ${page.to}`.toLowerCase(),
  })),
].filter((page, index, pages) => pages.findIndex((candidate) => candidate.to === page.to) === index);

const readActivityLogs = () => {
  try {
    const saved = window.localStorage.getItem(ACTIVITY_LOGS_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

const formatRelativeTime = (value) => {
  if (!value) return '';
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return '';
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days < 31) return `${days} day${days === 1 ? '' : 's'} ago`;
  const months = Math.round(days / 30);
  return `${months} month${months === 1 ? '' : 's'} ago`;
};

const ActivityDrawer = ({ displayName, onClose, onAllActivities }) => {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    setLogs(readActivityLogs());
  }, []);

  return (
    <section className="activity-drawer" aria-label="Activities drawer">
      <button type="button" className="activity-drawer-close" onClick={onClose} aria-label="Close activities">
        <Icon><path d="M19 12H5M12 19l-7-7 7-7" /></Icon>
      </button>

      <div className="activity-drawer-head">
        <h2>Activities</h2>
        <button type="button" className="btn-primary" onClick={onAllActivities}>
          All activities
        </button>
      </div>

      <div className="activity-drawer-list">
        {logs.length === 0 ? (
          <div className="activity-drawer-empty">
            <Icon><path d="M4 12a8 8 0 1 0 2.3-5.7" /><path d="M4 4v5h5" /><path d="M12 7v5l3 2" /></Icon>
            <span>There are no action logs</span>
          </div>
        ) : (
          logs.slice(0, 12).map((log, index) => {
            const createdAt = log.createdAt || log.created_at;
            return (
              <article key={log.id || `${createdAt}-${index}`} className="activity-drawer-card">
                <div className="activity-drawer-card-top">
                  <strong>{log.actor || displayName}</strong>
                  <span>
                    <Icon><path d="M4 12a8 8 0 1 0 2.3-5.7" /><path d="M4 4v5h5" /><path d="M12 7v5l3 2" /></Icon>
                    {formatRelativeTime(createdAt)}
                  </span>
                </div>
                <p>{log.message || '-'}</p>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
};

const NotificationDrawer = ({ onClose, onAllLogs }) => {
  const [items, setItems] = useState([]);
  useEffect(() => {
    adminApi.notifications({ page: 1, per_page: 10 })
      .then(({ data }) => setItems(data.data || []))
      .catch(() => setItems([]));
  }, []);
  return (
    <section className="activity-drawer notif-drawer" aria-label="Notifications drawer">
      <button type="button" className="activity-drawer-close" onClick={onClose} aria-label="Close notifications">
        <Icon><path d="M19 12H5M12 19l-7-7 7-7" /></Icon>
      </button>
      <div className="activity-drawer-head">
        <h2>Notifications</h2>
        <button type="button" className="btn-primary" onClick={onAllLogs}>All logs</button>
      </div>
      <div className="activity-drawer-list">
        {items.length === 0 ? (
          <div className="activity-drawer-empty">
            <Icon><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></Icon>
            <span>There are no notifications</span>
          </div>
        ) : items.map((n) => (
          <article key={n.uid || n.id} className="notif-card">
            <span className="notif-card-icon"><Icon><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></Icon></span>
            <div className="notif-card-body">
              <strong>{n.title}</strong>
              <span className="notif-card-time"><Icon><path d="M4 12a8 8 0 1 0 2.3-5.7" /><path d="M4 4v5h5" /><path d="M12 7v5l3 2" /></Icon> {formatRelativeTime(n.created_at)}</span>
              <p>{n.message}</p>
            </div>
          </article>
        ))}
      </div>
      <div className="notif-drawer-foot">
        <button type="button" className="btn-primary" onClick={onAllLogs}>All logs</button>
      </div>
    </section>
  );
};

const AccountPopover = ({ user, displayName, isAdminView, onClose, onNavigate, onLogout }) => {
  const popoverRef = useRef(null);
  const email = user?.email || '';
  const status = user?.customer?.status || user?.status || 'active';
  const isSuperAdmin = Array.isArray(user?.roles) && user.roles.some((role) => role.code === 'super_admin' || role.name === 'Super Admin');

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        onClose();
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const go = (path) => {
    onClose();
    onNavigate(path);
  };

  return (
    <div ref={popoverRef} className={clsx('account-popover', isAdminView && 'account-popover-admin')} role="menu" aria-label="Account menu">
      <div className="account-popover-info">
        <div className="account-popover-avatar" aria-hidden="true">
          <Icon><path d="M20 21a8 8 0 0 0-16 0" /><circle cx="12" cy="7" r="4" /></Icon>
        </div>
        <div className="account-popover-user">
          <button type="button" onClick={() => go(isAdminView ? '/admin/account/profile' : '/campaign-api/profile')}>{displayName}</button>
          <p>{email || '-'}</p>
          <span>{String(status).toUpperCase()}</span>
        </div>
      </div>

      <div className="account-popover-actions">
        {isAdminView ? (
          <>
            <button type="button" onClick={() => go('/dashboard')} role="menuitem">
              <Icon><path d="M4 12h12" /><path d="m12 8 4 4-4 4" /><path d="M20 4v16" /></Icon>
              <span>Customer View</span>
            </button>
            <button type="button" onClick={() => go('/admin/account/profile')} role="menuitem">
              <Icon><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></Icon>
              <span>Account</span>
            </button>
            <button type="button" onClick={() => go('/admin/account/api')} role="menuitem">
              <Icon><path d="M12 8v8M8 12h8" /><path d="M12 2v3M12 19v3M4.9 4.9 7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1" /></Icon>
              <span>Admin API</span>
            </button>
            <button type="button" onClick={onLogout} role="menuitem">
              <Icon><path d="M12 3v9" /><path d="M6.7 6.7a7.5 7.5 0 1 0 10.6 0" /></Icon>
              <span>Log Out</span>
            </button>
          </>
        ) : (
          <>
          {isSuperAdmin && (
          <button type="button" onClick={() => go('/admin')} role="menuitem">
            <Icon><path d="M4 12h12" /><path d="m12 8 4 4-4 4" /><path d="M20 4v16" /></Icon>
            <span>Admin View</span>
          </button>
          )}
          <button type="button" onClick={() => go('/campaign-api/credits')} role="menuitem">
            <Icon><path d="M4 12a8 8 0 1 0 2.3-5.7" /><path d="M4 4v5h5" /><path d="M12 7v5l3 2" /></Icon>
            <span>Credits used</span>
          </button>
          <button type="button" onClick={() => go('/campaign-api/subscription')} role="menuitem">
            <Icon><path d="M3 12a9 9 0 0 1 15.5-6" /><path d="M21 12a9 9 0 0 1-15.5 6" /><path d="M18 3v5h-5M6 21v-5h5" /></Icon>
            <span>Subscription &amp; Credits</span>
          </button>
          <button type="button" onClick={() => go('/campaign-api/billing')} role="menuitem">
            <Icon><path d="M3 6h18v12H3z" /><path d="M3 10h18M7 15h4" /></Icon>
            <span>Billing</span>
          </button>
          <button type="button" onClick={() => go('/campaign-api/profile')} role="menuitem">
            <Icon><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></Icon>
            <span>Account</span>
          </button>
          <button type="button" onClick={onLogout} role="menuitem">
            <Icon><path d="M12 3v9" /><path d="M6.7 6.7a7.5 7.5 0 1 0 10.6 0" /></Icon>
            <span>Log Out</span>
          </button>
          </>
        )}
      </div>

      <div className="account-popover-lang">
        <span>Language</span>
        <LanguageSwitcher />
      </div>

      <div className="account-popover-art" aria-hidden="true">
        {isAdminView ? (
          <img className="account-popover-illus account-popover-illus-sign" src="/images/sign-stand.svg" alt="" />
        ) : (
          <img className="account-popover-illus account-popover-illus-plane" src="/images/paper-airplane.svg" alt="" />
        )}
      </div>
    </div>
  );
};

const AppLayout = ({ children }) => {
  const { user, logout } = useAuthStore();
  const { t } = useTranslation();
  const tNav = (label) => t(navKey(label), null, label);
  const navigate = useNavigate();
  const location = useLocation();
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('sendq_theme') || 'light';
    } catch {
      return 'light';
    }
  });
  const [showSearch, setShowSearch] = useState(false);
  const [showActivities, setShowActivities] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => (typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches));
  // Auto-collapse the sidebar to the icon rail on narrow / mobile viewports; expand on wide.
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)');
    const apply = (e) => setSidebarCollapsed(e.matches);
    mq.addEventListener ? mq.addEventListener('change', apply) : mq.addListener(apply);
    return () => { mq.removeEventListener ? mq.removeEventListener('change', apply) : mq.removeListener(apply); };
  }, []);
  const displayName = user?.customer
    ? `${user.customer.first_name} ${user.customer.last_name}`.trim()
    : user?.first_name
      ? `${user.first_name} ${user.last_name || ''}`.trim()
      : user?.email || 'Account';
  const isAdminView = location.pathname.startsWith('/admin');
  // In the admin view, hide sections/links the user has no ability for (S7). super_admin
  // sees everything; the server still enforces every route regardless.
  const activeNavItems = isAdminView ? filterAdminNav(adminNavItems, user) : navItems;
  const [expandedMenus, setExpandedMenus] = useState(() => {
    const active = getActiveParentLabel(activeNavItems, location.pathname);
    return active ? { [active]: true } : {};
  });

  // Keep the submenu that owns the current route open as the user navigates.
  useEffect(() => {
    const active = getActiveParentLabel(activeNavItems, location.pathname);
    if (active) setExpandedMenus((prev) => (prev[active] ? prev : { ...prev, [active]: true }));
  }, [location.pathname, isAdminView]);  

  const toggleMenu = (label) => setExpandedMenus((prev) => ({ ...prev, [label]: !prev[label] }));

  const handleLogout = async () => {
    setShowAccountMenu(false);
    await logout();
    navigate('/login');
  };

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    localStorage.setItem('sendq_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'));
  };

  const openAllActivities = () => {
    setShowActivities(false);
    navigate('/activities');
  };

  return (
    <div className={clsx('sendq-shell flex h-screen overflow-hidden bg-[#19192f] text-white', theme === 'light' && 'sendq-light', isAdminView && 'sendq-admin', sidebarCollapsed && 'sidebar-collapsed')}>
      <aside className="sendq-sidebar flex shrink-0 flex-col bg-[#0d0d1b]">
        <div className="sendq-sidebar-header flex h-24 items-center justify-between px-5">
          <div className="sendq-sidebar-logo">
            <SendQLogo theme={theme} />
          </div>
          <button
            type="button"
            onClick={() => setSidebarCollapsed((current) => !current)}
            className="sendq-sidebar-toggle text-[#b9bac5]"
            title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
            aria-label={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
            aria-expanded={!sidebarCollapsed}
          >
            <Icon><path d="M4 7h16M4 12h16M4 17h16" /></Icon>
          </button>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto px-0 py-2">
          {activeNavItems.map((item) => {
            if (!item.children) {
              return (
                <div key={`${item.label}-${item.to}`}>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) => clsx(
                      'sendq-nav-link mx-4 flex h-11 items-center gap-4 rounded px-2 text-[19px] font-medium transition-colors',
                      isActive ? 'text-white' : 'text-[#f2f2f7] hover:text-white',
                    )}
                    title={item.label}
                  >
                    {({ isActive }) => (
                      <>
                        <span className={clsx('text-[#aeb0bb]', isActive && 'text-[#00c1d4]')}>{item.icon}</span>
                        <span className="sidebar-text flex-1">{tNav(item.label)}</span>
                        {item.hasArrow && <span className="sidebar-text text-[#777887]">›</span>}
                      </>
                    )}
                  </NavLink>
                </div>
              );
            }

            const isExpanded = !!expandedMenus[item.label];
            const parentActive = location.pathname === item.to
              || item.children.some((c) => location.pathname === c.to || location.pathname.startsWith(`${c.to}/`));
            const toggle = () => toggleMenu(item.label);

            return (
              <div key={`${item.label}-${item.to}`}>
                <div
                  role="button"
                  tabIndex={0}
                  aria-expanded={isExpanded}
                  onClick={toggle}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle(); }
                  }}
                  className={clsx(
                    'sendq-nav-link mx-4 flex h-11 cursor-pointer items-center gap-4 rounded px-2 text-[19px] font-medium transition-colors',
                    parentActive ? 'active text-white' : 'text-[#f2f2f7] hover:text-white',
                  )}
                  title={item.label}
                >
                  <span className={clsx('text-[#aeb0bb]', parentActive && 'text-[#00c1d4]')}>{item.icon}</span>
                  <span className="sidebar-text flex-1">{tNav(item.label)}</span>
                  <span className="sidebar-text sendq-nav-arrow text-[#777887]" aria-hidden="true">
                    <span className={clsx('sendq-nav-arrow-icon', isExpanded && 'is-open')}>›</span>
                  </span>
                </div>

                {isExpanded && (
                  <div className="sendq-subnav mt-2 bg-[#202037] py-2">
                    {item.children.map((child) => (
                      <NavLink
                        key={`${child.label}-${child.to}`}
                        to={child.to}
                        className={({ isActive }) => clsx(
                          'sendq-subnav-link flex h-12 items-center gap-4 px-8 text-[17px] font-medium transition-colors',
                          isActive ? 'text-[#d7d8e4]' : 'text-[#88899a] hover:text-[#d7d8e4]',
                        )}
                        title={child.label}
                      >
                        {({ isActive }) => (
                          <>
                            <span className={clsx('text-[#76778a]', isActive && 'text-[#a4a6b7]')}>{child.icon}</span>
                            <span className="sidebar-text">{tNav(child.label)}</span>
                          </>
                        )}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="relative border-t border-[#303041] px-4 py-4">
          <button
            type="button"
            onClick={() => {
              if (isAdminView) {
                setShowNotifications((current) => !current);
                return;
              }
              setShowActivities((current) => !current);
            }}
            className={clsx(
              'sendq-footer-action mb-5 flex w-full items-center justify-between text-left text-[18px] font-medium hover:text-white',
              showActivities ? 'text-white' : 'text-[#f4f4f8]',
            )}
            title={isAdminView ? 'Notifications' : 'Activities'}
          >
            <span className="flex items-center gap-4">
              {isAdminView ? (
                <Icon><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></Icon>
              ) : (
                <Icon><path d="M4 12a8 8 0 1 0 2.3-5.7" /><path d="M4 4v5h5" /><path d="M12 7v5l3 2" /></Icon>
              )}
              <span className="sidebar-text">{isAdminView ? 'Notifications' : 'Activities'}</span>
            </span>
            <span className="sidebar-text text-[#8e8f9c]">□</span>
          </button>
          <button
            type="button"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={() => setShowAccountMenu((current) => !current)}
            className="sendq-footer-action account-menu-trigger flex w-full items-center justify-between text-left text-[18px] font-medium text-[#f4f4f8]"
            title={displayName}
            aria-haspopup="menu"
            aria-expanded={showAccountMenu}
          >
            <span className="flex min-w-0 items-center gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#8fb4d4] text-sm text-white">
                {displayName[0]?.toUpperCase()}
              </span>
              <span className="sidebar-text truncate">{displayName}</span>
            </span>
            <span className="sidebar-text text-[#8e8f9c]">›</span>
          </button>
          {showAccountMenu && (
            <AccountPopover
              user={user}
              displayName={displayName}
              isAdminView={isAdminView}
              onClose={() => setShowAccountMenu(false)}
              onNavigate={navigate}
              onLogout={handleLogout}
            />
          )}
        </div>
      </aside>

      {showActivities && !isAdminView && (
        <ActivityDrawer
          displayName={displayName}
          onClose={() => setShowActivities(false)}
          onAllActivities={openAllActivities}
        />
      )}

      {showNotifications && isAdminView && (
        <NotificationDrawer
          onClose={() => setShowNotifications(false)}
          onAllLogs={() => { setShowNotifications(false); navigate('/admin/notifications'); }}
        />
      )}

      <main className="relative flex-1 overflow-y-auto">
        {/* PHP-style headbar: thin, right-aligned (search + theme toggle) */}
        <header className="sq-headbar">
          <button type="button" className="sq-headbar-icon" onClick={() => setShowSearch(true)} title="Search" aria-label="Open search">
            <Icon><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></Icon>
          </button>
          <button
            type="button"
            className="sq-headbar-icon"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            onClick={toggleTheme}
          >
            {theme === 'dark' ? (
              <Icon><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></Icon>
            ) : (
              <Icon><path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.5 6.5 0 0 0 9.8 9.8Z" /></Icon>
            )}
          </button>
        </header>

        {showSearch && <SearchOverlay onClose={() => setShowSearch(false)} />}
        {children}
      </main>
      <ImpersonationBar />
      <Toaster />
    </div>
  );
};

export default AppLayout;
