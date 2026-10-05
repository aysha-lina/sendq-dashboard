import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import useAuthStore from '../../store/authStore';
import { accountApi } from '../../api/services';

const MaterialIcon = ({ children, className = '' }) => (
  <span className={`material-symbols-rounded ${className}`}>{children}</span>
);

// Account tabs link to the real Campaign API / account sections; "Logs" is this page.
const accountTabs = [
  { label: 'My profile', icon: 'face', to: '/campaign-api/profile' },
  { label: 'Contact information', icon: 'maps_home_work', to: '/campaign-api/contact' },
  { label: 'Users', icon: 'group', to: '/campaign-api/users' },
  { label: 'Roles', icon: 'admin_panel_settings', to: '/campaign-api/roles' },
  { label: 'Subscription & Credits', icon: 'auto_mode', to: '/campaign-api/subscription' },
  { label: 'Billing', icon: 'credit_card', to: '/campaign-api/billing' },
  { label: 'Logs', icon: 'restore', active: true },
  { label: 'API token', icon: 'vpn_key', to: '/campaign-api/api' },
];

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const pad = (part) => `${part}`.padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const relativeTime = (value) => {
  if (!value) return '-';
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return '-';
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
};

const getDisplayName = (user) => {
  const customerName = user?.customer
    ? `${user.customer.first_name || ''} ${user.customer.last_name || ''}`.trim()
    : '';
  const userName = `${user?.first_name || ''} ${user?.last_name || ''}`.trim();
  return customerName || userName || '-';
};

const ActivitiesPage = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const displayName = getDisplayName(user);
  const [logs, setLogs] = useState([]);
  const [sortDirection, setSortDirection] = useState('desc');
  const [type, setType] = useState('');

  useEffect(() => {
    accountApi.logs()
      .then(({ data }) => setLogs(data.logs || []))
      .catch(() => setLogs([]));
  }, []);

  const filteredLogs = useMemo(() => {
    const nextLogs = type ? logs.filter((log) => log.type === type) : logs;
    return [...nextLogs].sort((a, b) => {
      const first = new Date(a.createdAt || a.created_at || 0).getTime();
      const second = new Date(b.createdAt || b.created_at || 0).getTime();
      return sortDirection === 'asc' ? first - second : second - first;
    });
  }, [logs, sortDirection, type]);


  return (
    <AppLayout>
      <div className="activities-page">
        <header className="activities-page-title">
          <nav>
            <span>Home</span>
            <span>&gt;</span>
            <span>Activities</span>
          </nav>
          <h1>
            <MaterialIcon>person_outline</MaterialIcon>
            <span>{displayName}</span>
          </h1>
        </header>

        <div className="activities-tabs">
          {accountTabs.map((tab) => (
            <button
              key={tab.label}
              type="button"
              className={tab.active ? 'active' : ''}
              onClick={() => tab.to && navigate(tab.to)}
            >
              <MaterialIcon>{tab.icon}</MaterialIcon>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <section className="activities-panel">
          <div className="activities-panel-head">
            <h2>Activities</h2>
            <button type="button" className="btn-primary" onClick={() => navigate('/campaign-api/logs')}>
              All activities
            </button>
          </div>

          <form className="activities-top-controls" onSubmit={(event) => event.preventDefault()}>
            <div className="activities-filter-box">
              <span className="activities-filter-group">
                <span className="activities-filter-title">Sort by</span>
                <select value="created_at" onChange={() => undefined}>
                  <option value="created_at">Created at</option>
                </select>
                <button
                  type="button"
                  className="activities-sort-button"
                  title="Change sort direction"
                  onClick={() => setSortDirection((current) => (current === 'desc' ? 'asc' : 'desc'))}
                >
                  <MaterialIcon>{sortDirection === 'desc' ? 'sort' : 'sort'}</MaterialIcon>
                </button>
              </span>
              <span className="activities-filter-group">
                <span className="activities-filter-title">Type</span>
                <select value={type} onChange={(event) => setType(event.target.value)}>
                  <option value="">All</option>
                  <option value="list">List</option>
                  <option value="segment">Segment</option>
                  <option value="page">Page</option>
                  <option value="subscriber">Subscriber</option>
                  <option value="campaign">Campaign</option>
                </select>
              </span>
            </div>
          </form>

          {filteredLogs.length === 0 ? (
            <div className="activities-empty-list">
              <MaterialIcon>history_toggle_off</MaterialIcon>
              <span>{type ? 'No search result' : 'There are no action logs'}</span>
            </div>
          ) : (
            <div className="activities-log-list">
              {filteredLogs.map((log, index) => {
                const createdAt = log.createdAt || log.created_at;
                return (
                  <article key={log.id || `${createdAt}-${index}`} className="activities-log-row">
                    <div>
                      <p>{log.message || '-'}</p>
                      <span>{log.type || '-'}</span>
                    </div>
                    <div>
                      <strong>{relativeTime(createdAt)}</strong>
                      <span>{formatDateTime(createdAt)}</span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <footer className="activities-footer">Copyright © 2025. SendQ - Send with Unlimited Confidence Email Marketing. All Rights Reserved.</footer>
      </div>
    </AppLayout>
  );
};

export default ActivitiesPage;
