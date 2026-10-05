import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { accountApi, authApi } from '../../api/services';
import useAuthStore from '../../store/authStore';

const MaterialIcon = ({ children, className = '' }) => (
  <span className={`material-symbols-rounded ${className}`}>{children}</span>
);

const accountTabs = [
  { key: 'profile', label: 'My profile', icon: 'face' },
  { key: 'contact', label: 'Contact information', icon: 'maps_home_work' },
  { key: 'users', label: 'Users', icon: 'group' },
  { key: 'roles', label: 'Roles', icon: 'admin_panel_settings' },
  { key: 'subscription', label: 'Subscription & Credits', icon: 'auto_mode' },
  { key: 'billing', label: 'Billing', icon: 'credit_card' },
  { key: 'logs', label: 'Logs', icon: 'restore' },
  { key: 'api', label: 'API token', icon: 'vpn_key' },
];

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toISOString().slice(0, 16).replace('T', ' ');
};

const getDisplayName = (user) => {
  const customerName = user?.customer
    ? `${user.customer.first_name || ''} ${user.customer.last_name || ''}`.trim()
    : '';
  const userName = `${user?.first_name || ''} ${user?.last_name || ''}`.trim();
  return customerName || userName || '-';
};

const AccountHeader = ({ activeKey, displayName }) => {
  const crumb = {
    admin: 'Admin',
    credits: 'Credits used',
    profile: 'Profile',
    contact: 'Contact information',
    users: 'Users',
    roles: 'Roles',
    subscription: 'Subscription & Credits',
    billing: 'Billing',
    logs: 'Activities',
    api: 'API token',
  }[activeKey] || 'API token';

  return (
    <header className="campaign-api-title">
      <nav>
        <span>Home</span>
        <span>&gt;</span>
        <span>{crumb}</span>
      </nav>
      <h1>
        <MaterialIcon>person_outline</MaterialIcon>
        <span>{displayName}</span>
      </h1>
    </header>
  );
};

const AccountTabs = ({ activeKey, base }) => {
  const navigate = useNavigate();

  return (
    <div className="campaign-api-tabs">
      {accountTabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => navigate(`${base}/${tab.key}`)}
          className={activeKey === tab.key ? 'active' : ''}
        >
          <MaterialIcon>{tab.icon}</MaterialIcon>
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
};

const CopyButton = ({ value, disabled, onCopied }) => (
  <button
    className="btn-primary campaign-api-copy"
    type="button"
    disabled={disabled}
    onClick={async () => {
      if (!value) return;
      await navigator.clipboard?.writeText(value);
      onCopied?.();
    }}
  >
    <MaterialIcon>content_copy</MaterialIcon>
    Copy
  </button>
);

const ApiValue = ({ value, fallback = '-' }) => (
  <code className={value ? 'campaign-api-code' : 'campaign-api-code empty'}>
    {value || fallback}
  </code>
);

const EmptyState = ({ icon = 'auto_awesome', text }) => (
  <div className="campaign-api-empty-card">
    <MaterialIcon>{icon}</MaterialIcon>
    <p>{text}</p>
  </div>
);

const AccountForm = ({ title, icon, fields, initialValues, onSubmit, saving }) => {
  const [values, setValues] = useState(initialValues);

  useEffect(() => setValues(initialValues), [initialValues]);

  return (
    <section className="campaign-api-form-section">
      <h2>
        <MaterialIcon>{icon}</MaterialIcon>
        {title}
      </h2>
      <form
        className="campaign-api-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(values);
        }}
      >
        {fields.map((field) => (
          <label key={field.name}>
            <span>{field.label}</span>
            <input
              type={field.type || 'text'}
              value={values[field.name] || ''}
              onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
              required={field.required}
            />
          </label>
        ))}
        <button className="btn-primary campaign-api-save" type="submit" disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </button>
      </form>
    </section>
  );
};

const apiOrigin = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const avatarUrl = (image) => {
  if (!image) return null;
  return image.startsWith('http') ? image : `${apiOrigin}${image}`;
};

const AvatarCard = ({ user, onUpload, onRemove, busy }) => {
  const [error, setError] = useState('');
  const image = user?.image || user?.customer?.image;
  const url = avatarUrl(image);

  const onPick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setError('Image must be under 2 MB.'); return; }
    setError('');
    onUpload(file);
    e.target.value = '';
  };

  return (
    <section className="campaign-api-form-section">
      <h2><MaterialIcon>account_circle</MaterialIcon> Profile image</h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{
          width: 88, height: 88, borderRadius: '50%', overflow: 'hidden',
          background: '#e5e7eb', color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {url
            ? <img src={url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <MaterialIcon>person</MaterialIcon>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label className="btn-primary" style={{ cursor: 'pointer' }}>
            {busy ? 'Uploading…' : 'Upload image'}
            <input type="file" accept="image/*" hidden onChange={onPick} disabled={busy} />
          </label>
          {url && <button type="button" className="btn-secondary" onClick={onRemove} disabled={busy}>Remove</button>}
          <small style={{ color: '#8e8d99' }}>PNG, JPG, GIF or WEBP, up to 2 MB.</small>
          {error && <small style={{ color: '#e0414b' }}>{error}</small>}
        </div>
      </div>
    </section>
  );
};

const PasswordCard = ({ onSubmit, onLogoutAll, saving }) => {
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm: '' });
  const [error, setError] = useState('');

  const submit = (e) => {
    e.preventDefault();
    if (form.new_password.length < 8) { setError('New password must be at least 8 characters.'); return; }
    if (form.new_password !== form.confirm) { setError('New password and confirmation do not match.'); return; }
    setError('');
    onSubmit({ current_password: form.current_password, new_password: form.new_password });
    setForm({ current_password: '', new_password: '', confirm: '' });
  };

  return (
    <section className="campaign-api-form-section">
      <h2><MaterialIcon>lock</MaterialIcon> Change password</h2>
      <form className="campaign-api-form" onSubmit={submit}>
        <label><span>Current password</span>
          <input type="password" value={form.current_password} onChange={(e) => setForm({ ...form, current_password: e.target.value })} required />
        </label>
        <label><span>New password</span>
          <input type="password" value={form.new_password} onChange={(e) => setForm({ ...form, new_password: e.target.value })} required />
        </label>
        <label><span>Confirm new password</span>
          <input type="password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} required />
        </label>
        {error && <p style={{ color: '#e0414b', margin: 0 }}>{error}</p>}
        <button className="btn-primary campaign-api-save" type="submit" disabled={saving}>
          {saving ? 'Saving...' : 'Change password'}
        </button>
      </form>
      {onLogoutAll && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--sq-border, #e2e6ee)' }}>
          <p style={{ margin: '0 0 8px', fontSize: 13, color: '#6b7280' }}>
            Signs out this account on every device (invalidates all active sessions).
          </p>
          <button type="button" className="btn-secondary" onClick={onLogoutAll}>
            <MaterialIcon>logout</MaterialIcon> Log out of all devices
          </button>
        </div>
      )}
    </section>
  );
};

const TwoFactorCard = () => {
  const [status, setStatus] = useState(null); // { enabled, method }
  const [setup, setSetup] = useState(null); // { method, secret, otpauth, qr }
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const refresh = () => accountApi.twoFactorStatus().then(({ data }) => setStatus(data)).catch(() => setStatus({ enabled: false }));
  useEffect(() => { refresh(); }, []);

  const startSetup = async (method) => {
    setBusy(true); setError(''); setMessage('');
    try { const { data } = await accountApi.twoFactorSetup({ method }); setSetup(data); }
    catch (err) { setError(err.response?.data?.message || 'Could not start setup.'); }
    finally { setBusy(false); }
  };

  const enable = async () => {
    setBusy(true); setError('');
    try {
      const { data } = await accountApi.twoFactorEnable({ code: code.trim() });
      setMessage(data.message); setSetup(null); setCode(''); refresh();
    } catch (err) { setError(err.response?.data?.message || 'Invalid code.'); }
    finally { setBusy(false); }
  };

  const disable = async () => {
    setBusy(true); setError('');
    try {
      const { data } = await accountApi.twoFactorDisable({ password });
      setMessage(data.message); setPassword(''); refresh();
    } catch (err) { setError(err.response?.data?.message || 'Could not disable.'); }
    finally { setBusy(false); }
  };

  return (
    <section className="campaign-api-form-section">
      <h2><MaterialIcon>verified_user</MaterialIcon> Two-factor authentication</h2>
      {message && <p style={{ color: '#7bd88f' }}>{message}</p>}
      {error && <p style={{ color: '#e0414b' }}>{error}</p>}

      {!status ? <p>Loading…</p> : status.enabled ? (
        <div>
          <p style={{ marginBottom: 12 }}>
            <span className="material-symbols-rounded" style={{ color: '#7bd88f', verticalAlign: 'middle' }}>check_circle</span>
            {' '}Enabled via <strong>{status.method === 'totp' ? 'authenticator app' : 'email'}</strong>.
          </p>
          <label className="admin-modal-field" style={{ maxWidth: 320 }}>
            <span>Enter your password to disable</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <button type="button" className="btn-secondary" onClick={disable} disabled={busy || !password}>Disable 2FA</button>
        </div>
      ) : setup ? (
        <div>
          {setup.method === 'totp' && (
            <>
              <p>Scan this QR code with your authenticator app (or enter the secret manually):</p>
              {setup.qr && <img src={setup.qr} alt="2FA QR code" style={{ width: 180, height: 180, background: '#fff', padding: 8, borderRadius: 8, margin: '10px 0' }} />}
              <p style={{ fontFamily: 'monospace', fontSize: 13, wordBreak: 'break-all' }}>{setup.secret}</p>
            </>
          )}
          {setup.method === 'email' && <p>We emailed you a verification code. Enter it below to finish enabling 2FA.</p>}
          <label className="admin-modal-field" style={{ maxWidth: 240 }}>
            <span>Verification code</span>
            <input type="text" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" />
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn-primary" onClick={enable} disabled={busy || !code}>Enable 2FA</button>
            <button type="button" className="btn-secondary" onClick={() => { setSetup(null); setCode(''); }}>Cancel</button>
          </div>
        </div>
      ) : (
        <div>
          <p style={{ marginBottom: 12 }}>Add a second step at login for extra security.</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn-primary" onClick={() => startSetup('totp')} disabled={busy}>Use authenticator app</button>
            <button type="button" className="btn-secondary" onClick={() => startSetup('email')} disabled={busy}>Use email codes</button>
          </div>
        </div>
      )}
    </section>
  );
};

const UsersSection = ({ users, roles, onCreate, onDelete, saving }) => {
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', password: '', role_code: 'user' });

  return (
    <section className="campaign-api-data-section">
      <div className="campaign-api-section-head">
        <h2><MaterialIcon>group</MaterialIcon> Users</h2>
        <button type="button" className="btn-primary" onClick={() => setShowCreate((value) => !value)}>
          <MaterialIcon>add</MaterialIcon>
          New user
        </button>
      </div>

      {showCreate && (
        <form
          className="campaign-api-inline-form"
          onSubmit={async (event) => {
            event.preventDefault();
            await onCreate(form);
            setForm({ first_name: '', last_name: '', email: '', password: '', role_code: 'user' });
            setShowCreate(false);
          }}
        >
          <input placeholder="First name" value={form.first_name} onChange={(event) => setForm({ ...form, first_name: event.target.value })} required />
          <input placeholder="Last name" value={form.last_name} onChange={(event) => setForm({ ...form, last_name: event.target.value })} required />
          <input placeholder="Email address" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
          <input placeholder="Password" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required />
          <select value={form.role_code} onChange={(event) => setForm({ ...form, role_code: event.target.value })}>
            {roles.map((role) => <option key={role.code || role.id} value={role.code || ''}>{role.name}</option>)}
          </select>
          <button className="btn-primary" type="submit" disabled={saving}>{saving ? 'Creating...' : 'Create'}</button>
        </form>
      )}

      {users.length === 0 ? (
        <EmptyState icon="group" text="There are no users to display." />
      ) : (
        <div className="campaign-api-table-wrap">
          <table className="campaign-api-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Status</th>
                <th>Roles</th>
                <th>Created at</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.uid || user.id}>
                  <td>{getDisplayName(user)}</td>
                  <td>{user.email}</td>
                  <td><span className="campaign-api-pill">{user.status || '-'}</span></td>
                  <td>{user.roles?.map((role) => role.name).join(', ') || '-'}</td>
                  <td>{formatDate(user.created_at)}</td>
                  <td style={{ textAlign: 'right' }}>
                    {onDelete && user.uid && (
                      <button type="button" className="btn-secondary" onClick={() => onDelete(user)}>
                        <MaterialIcon>delete_outline</MaterialIcon> Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

const RolesSection = ({ roles }) => (
  <section className="campaign-api-data-section">
    <h2><MaterialIcon>admin_panel_settings</MaterialIcon> Roles</h2>
    {roles.length === 0 ? (
      <EmptyState icon="admin_panel_settings" text="There are no roles to display." />
    ) : (
      <div className="campaign-api-role-grid">
        {roles.map((role) => (
          <article key={role.uid || role.id} className="campaign-api-role-card">
            <div>
              <h3>{role.name}</h3>
              <p>{role.description || '-'}</p>
            </div>
            <span className="campaign-api-pill">{role.readonly ? 'Readonly' : role.status}</span>
            <small>{role.rolePermissions?.length || 0} permissions</small>
          </article>
        ))}
      </div>
    )}
  </section>
);

const SubscriptionSection = ({ subscriptions, plans }) => (
  <section className="campaign-api-data-section">
    <h2><MaterialIcon>auto_mode</MaterialIcon> Subscription & Credits</h2>
    {subscriptions.length === 0 ? (
      <EmptyState icon="auto_mode" text="There are no subscriptions to display." />
    ) : (
      <div className="campaign-api-role-grid">
        {subscriptions.map((subscription) => (
          <article key={subscription.id} className="campaign-api-role-card">
            <div>
              <h3>{subscription.plan?.name || '-'}</h3>
              <p>Status: {subscription.status}</p>
            </div>
            <span className="campaign-api-pill">{subscription.plan?.daily_email_limit || 0} daily</span>
            <small>{formatDate(subscription.starts_at)} - {formatDate(subscription.ends_at)}</small>
          </article>
        ))}
      </div>
    )}
    <h2 className="campaign-api-subheading">Available plans</h2>
    {plans.length === 0 ? (
      <EmptyState icon="inventory_2" text="There are no plans to display." />
    ) : (
      <div className="campaign-api-role-grid">
        {plans.map((plan) => (
          <article key={plan.id} className="campaign-api-role-card">
            <h3>{plan.name}</h3>
            <span className="campaign-api-pill">{plan.daily_email_limit} daily emails</span>
          </article>
        ))}
      </div>
    )}
  </section>
);

const LogsSection = ({ logs }) => (
  <section className="campaign-api-data-section">
    <h2><MaterialIcon>restore</MaterialIcon> Logs</h2>
    {logs.length === 0 ? (
      <EmptyState icon="restore" text="There are no activity logs to display." />
    ) : (
      <div className="campaign-api-log-list">
        {logs.map((log, index) => (
          <article key={`${log.type}-${index}`}>
            <div>
              <strong>{log.title || '-'}</strong>
              <p>{log.message || '-'}</p>
            </div>
            <span>{formatDate(log.created_at)}</span>
          </article>
        ))}
      </div>
    )}
  </section>
);

const AdminSection = ({ admin }) => {
  const summary = admin?.summary || {};
  const cards = [
    ['Users', summary.users],
    ['Admins', summary.admins],
    ['Customers', summary.customers],
    ['Roles', summary.roles],
    ['Plans', summary.plans],
    ['Subscriptions', summary.subscriptions],
    ['Campaigns', summary.campaigns],
    ['Lists', summary.lists],
    ['Subscribers', summary.subscribers],
  ];

  return (
    <section className="campaign-api-data-section">
      <h2><MaterialIcon>admin_panel_settings</MaterialIcon> Admin panel</h2>
      <div className="campaign-api-admin-grid">
        {cards.map(([label, value]) => (
          <article key={label}>
            <strong>{value ?? '-'}</strong>
            <span>{label}</span>
          </article>
        ))}
      </div>
      <h2 className="campaign-api-subheading">Admin groups</h2>
      {admin?.adminGroups?.length ? (
        <div className="campaign-api-table-wrap">
          <table className="campaign-api-table">
            <thead>
              <tr><th>Name</th><th>Order</th><th>Created at</th></tr>
            </thead>
            <tbody>
              {admin.adminGroups.map((group) => (
                <tr key={group.id}>
                  <td>{group.name}</td>
                  <td>{group.custom_order ?? '-'}</td>
                  <td>{formatDate(group.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState icon="groups" text="There are no admin groups to display." />
      )}
    </section>
  );
};

const BillingSection = ({ subscriptions }) => (
  <section className="campaign-api-data-section">
    <h2><MaterialIcon>credit_card</MaterialIcon> Billing</h2>
    {subscriptions.length === 0 ? (
      <EmptyState icon="receipt_long" text="There are no billing records to display." />
    ) : (
      <div className="campaign-api-table-wrap">
        <table className="campaign-api-table">
          <thead>
            <tr><th>Plan</th><th>Status</th><th>Start</th><th>End</th></tr>
          </thead>
          <tbody>
            {subscriptions.map((subscription) => (
              <tr key={subscription.id}>
                <td>{subscription.plan?.name || '-'}</td>
                <td>{subscription.status}</td>
                <td>{formatDate(subscription.starts_at)}</td>
                <td>{formatDate(subscription.ends_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </section>
);

const CreditsSection = ({ usage }) => (
  <section className="campaign-api-data-section">
    <h2><MaterialIcon>update</MaterialIcon> Credits used</h2>
    <div className="campaign-api-admin-grid">
      <article><strong>{usage?.campaigns ?? '-'}</strong><span>Campaigns</span></article>
      <article><strong>{usage?.lists ?? '-'}</strong><span>Lists</span></article>
      <article><strong>{usage?.subscribers ?? '-'}</strong><span>Subscribers</span></article>
    </div>
  </section>
);

const ApiSection = ({ user, onUserUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [copyMessage, setCopyMessage] = useState('');
  const [renewMessage, setRenewMessage] = useState('');
  const apiEndpoint = typeof window !== 'undefined' ? `${window.location.origin}/api/v1` : '/api/v1';
  const docsUrl = import.meta.env.VITE_API_DOCS_URL || '';
  const apiToken = user?.api_token || '';

  const handleRenewToken = async () => {
    setLoading(true);
    setRenewMessage('');
    try {
      const { data } = await authApi.renewApiToken();
      onUserUpdate(data.user);
      setRenewMessage('API token renewed.');
    } catch (err) {
      setRenewMessage(err.response?.data?.message || 'Unable to renew API token.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopied = (label) => {
    setCopyMessage(`${label} copied.`);
    window.setTimeout(() => setCopyMessage(''), 1600);
  };

  return (
    <main className="campaign-api-content">
      <section>
        <h2>API docs</h2>
        {docsUrl ? (
          <a className="campaign-api-doc-link" href={docsUrl} target="_blank" rel="noreferrer">
            <span>{docsUrl}</span>
            <MaterialIcon>link</MaterialIcon>
          </a>
        ) : (
          <ApiValue value="" fallback="-" />
        )}
      </section>
      <section>
        <h2>API Endpoint</h2>
        <div className="campaign-api-value-row">
          <ApiValue value={apiEndpoint} />
          <CopyButton value={apiEndpoint} onCopied={() => handleCopied('API endpoint')} />
        </div>
      </section>
      <section>
        <h2>Your API token</h2>
        <div className="campaign-api-value-row">
          <ApiValue value={apiToken} fallback="No API token available" />
          <CopyButton value={apiToken} disabled={!apiToken} onCopied={() => handleCopied('API token')} />
        </div>
      </section>
      {(copyMessage || renewMessage) && <p className="campaign-api-notice">{copyMessage || renewMessage}</p>}
      <div className="campaign-api-alert">
        <MaterialIcon>info</MaterialIcon>
        <p>
          You need to add parameter api_token=YOUR_API_TOKEN to each request to the API system
          <br />
          Example: {apiEndpoint}/lists?api_token=YOUR_API_TOKEN
        </p>
      </div>
      <button className="btn-primary campaign-api-renew" type="button" onClick={handleRenewToken} disabled={loading}>
        {loading ? 'Renewing...' : 'Renew token'}
      </button>
    </main>
  );
};

const CampaignApiPage = () => {
  const params = useParams();
  const location = useLocation();
  // When reached from the admin view (/admin/account/*) keep the admin layout + base path.
  const isAdminContext = location.pathname.startsWith('/admin');
  const base = isAdminContext ? '/admin/account' : '/campaign-api';
  const activeKey = params.section || 'api';
  const storedUser = useAuthStore((state) => state.user);
  const [user, setUser] = useState(storedUser);
  const [overview, setOverview] = useState({ usage: {}, subscriptions: [] });
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [plans, setPlans] = useState([]);
  const [logs, setLogs] = useState([]);
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const displayName = useMemo(() => getDisplayName(user), [user]);

  const updateStoredUser = (nextUser) => {
    setUser(nextUser);
    localStorage.setItem('sendq_user', JSON.stringify(nextUser));
    useAuthStore.setState({ user: nextUser });
  };

  const loadAccount = async () => {
    setLoading(true);
    try {
      const [{ data: overviewData }, { data: roleData }] = await Promise.all([
        accountApi.overview(),
        accountApi.roles(),
      ]);
      updateStoredUser(overviewData.user);
      setOverview({ usage: overviewData.usage || {}, subscriptions: overviewData.subscriptions || [] });
      setRoles(roleData.roles || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccount().catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (activeKey === 'users') accountApi.users().then(({ data }) => setUsers(data.users || [])).catch(() => setUsers([]));
    if (activeKey === 'subscription' || activeKey === 'billing') {
      accountApi.subscription()
        .then(({ data }) => {
          setOverview((current) => ({ ...current, subscriptions: data.subscriptions || [] }));
          setPlans(data.plans || []);
        })
        .catch(() => {
          setPlans([]);
        });
    }
    if (activeKey === 'logs') accountApi.logs().then(({ data }) => setLogs(data.logs || [])).catch(() => setLogs([]));
    if (activeKey === 'admin') accountApi.admin().then(({ data }) => setAdmin(data)).catch(() => setAdmin(null));
  }, [activeKey]);

  const saveProfile = async (values) => {
    setSaving(true);
    setMessage('');
    try {
      const { data } = await accountApi.updateProfile(values);
      updateStoredUser(data.user);
      setMessage(data.message);
    } catch (err) {
      setMessage(err.response?.data?.message || 'Unable to save profile.');
    } finally {
      setSaving(false);
    }
  };

  const saveContact = async (values) => {
    setSaving(true);
    setMessage('');
    try {
      const { data } = await accountApi.updateContact(values);
      updateStoredUser(data.user);
      setMessage(data.message);
    } catch (err) {
      setMessage(err.response?.data?.message || 'Unable to save contact information.');
    } finally {
      setSaving(false);
    }
  };

  const createUser = async (values) => {
    setSaving(true);
    setMessage('');
    try {
      const { data } = await accountApi.createUser(values);
      setUsers((current) => [...current, data.user]);
      setMessage(data.message);
    } catch (err) {
      setMessage(err.response?.data?.message || 'Unable to create user.');
    } finally {
      setSaving(false);
    }
  };

  const deleteUser = async (user) => {
    if (!window.confirm(`Delete user "${user.email}"? This cannot be undone.`)) return;
    try {
      const { data } = await accountApi.deleteUser(user.uid);
      setUsers((current) => current.filter((u) => u.uid !== user.uid));
      setMessage(data.message);
    } catch (err) {
      setMessage(err.response?.data?.message || 'Unable to delete user.');
    }
  };

  const handleLogoutAll = async () => {
    if (!window.confirm('Log out of all devices? You will need to sign in again.')) return;
    try { await accountApi.logoutAll(); } catch { /* proceed to local logout regardless */ }
    await useAuthStore.getState().logout();
    window.location.href = '/login';
  };

  const changePassword = async (values) => {
    setSaving(true);
    setMessage('');
    try {
      const { data } = await accountApi.changePassword(values);
      // Backend revokes old sessions on password change and returns a fresh token
      // for THIS session — store it so we stay logged in.
      if (data.token) localStorage.setItem('sendq_token', data.token);
      setMessage(data.message);
    } catch (err) {
      setMessage(err.response?.data?.message || 'Unable to change password.');
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async (file) => {
    setSaving(true);
    setMessage('');
    try {
      const { data } = await accountApi.uploadAvatar(file);
      updateStoredUser(data.user);
      setMessage(data.message);
    } catch (err) {
      setMessage(err.response?.data?.message || 'Unable to upload image.');
    } finally {
      setSaving(false);
    }
  };

  const removeAvatar = async () => {
    setSaving(true);
    setMessage('');
    try {
      const { data } = await accountApi.removeAvatar();
      updateStoredUser(data.user);
      setMessage(data.message);
    } catch (err) {
      setMessage(err.response?.data?.message || 'Unable to remove image.');
    } finally {
      setSaving(false);
    }
  };

  const content = () => {
    if (loading) return <EmptyState icon="sync" text="Loading account details..." />;
    if (activeKey === 'api') return <ApiSection user={user} onUserUpdate={updateStoredUser} />;
    if (activeKey === 'profile') {
      return (
        <>
          <AvatarCard user={user} onUpload={uploadAvatar} onRemove={removeAvatar} busy={saving} />
          <AccountForm
            title="My profile"
            icon="face"
            initialValues={{
              first_name: user?.first_name || user?.customer?.first_name || '',
              last_name: user?.last_name || user?.customer?.last_name || '',
              timezone: user?.customer?.timezone || 'UTC',
            }}
            fields={[
              { name: 'first_name', label: 'First name', required: true },
              { name: 'last_name', label: 'Last name', required: true },
              { name: 'timezone', label: 'Timezone' },
            ]}
            onSubmit={saveProfile}
            saving={saving}
          />
          <PasswordCard onSubmit={changePassword} onLogoutAll={handleLogoutAll} saving={saving} />
          <TwoFactorCard />
        </>
      );
    }
    if (activeKey === 'contact') {
      return (
        <AccountForm
          title="Contact information"
          icon="maps_home_work"
          initialValues={{
            email: user?.email || '',
            first_name: user?.first_name || user?.customer?.first_name || '',
            last_name: user?.last_name || user?.customer?.last_name || '',
            company: user?.customer?.company || '',
            phone: user?.customer?.phone || '',
            address: user?.customer?.address || '',
            city: user?.customer?.city || '',
            state: user?.customer?.state || '',
            zip: user?.customer?.zip || '',
            country: user?.customer?.country || '',
            website: user?.customer?.website || '',
            tax_number: user?.customer?.tax_number || '',
          }}
          fields={[
            { name: 'email', label: 'Email address', type: 'email', required: true },
            { name: 'first_name', label: 'First name', required: true },
            { name: 'last_name', label: 'Last name', required: true },
            { name: 'company', label: 'Company' },
            { name: 'phone', label: 'Phone' },
            { name: 'website', label: 'Website' },
            { name: 'address', label: 'Address' },
            { name: 'city', label: 'City' },
            { name: 'state', label: 'State / Region' },
            { name: 'zip', label: 'Zip / Postal code' },
            { name: 'country', label: 'Country' },
            { name: 'tax_number', label: 'Tax number' },
          ]}
          onSubmit={saveContact}
          saving={saving}
        />
      );
    }
    if (activeKey === 'users') return <UsersSection users={users} roles={roles} onCreate={createUser} onDelete={deleteUser} saving={saving} />;
    if (activeKey === 'roles') return <RolesSection roles={roles} />;
    if (activeKey === 'subscription') return <SubscriptionSection subscriptions={overview.subscriptions || []} plans={plans} />;
    if (activeKey === 'billing') return <BillingSection subscriptions={overview.subscriptions || []} />;
    if (activeKey === 'logs') return <LogsSection logs={logs} />;
    if (activeKey === 'credits') return <CreditsSection usage={overview.usage} />;
    if (activeKey === 'admin') return <AdminSection admin={admin} />;
    return <EmptyState icon="info" text="This account section is not available." />;
  };

  return (
    <AppLayout>
      <div className="campaign-api-page">
        <AccountHeader activeKey={activeKey} displayName={displayName} />
        <AccountTabs activeKey={activeKey} base={base} />
        {message && <p className="campaign-api-notice">{message}</p>}
        {content()}
        <footer className="campaign-api-footer">Copyright © 2025. SendQ - Send with Unlimited Confidence Email Marketing. All Rights Reserved.</footer>
      </div>
    </AppLayout>
  );
};

export default CampaignApiPage;
