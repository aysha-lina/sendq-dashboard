import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useClickOutside from '../../hooks/useClickOutside';
import { useTranslation } from '../../i18n';

const MaterialIcon = ({ children, className = '' }) => (
  <span className={`material-symbols-rounded ${className}`}>{children}</span>
);

// Shared campaign detail header: breadcrumb + name + status badge (mirrors PHP campaigns/_header).
export const CampaignHeader = ({ campaign }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const status = (campaign?.status || '').toString();
  return (
    <header className="campaign-detail-header">
      <nav>
        <button type="button" onClick={() => navigate('/dashboard')}>{t('common.home')}</button>
        <span>›</span>
        <button type="button" onClick={() => navigate('/campaigns')}>{t('nav.campaigns')}</button>
      </nav>
      <div className="campaign-detail-title-row">
        <h1>
          {campaign?.name || '-'}
          {status && <span className={`campaign-status-badge campaign-status-${status}`}>{status}</span>}
        </h1>
      </div>
    </header>
  );
};

// The six entries inside the "Sending logs" dropdown. `type` is the backend log key.
const LOG_ITEMS = [
  { type: 'tracking', label: 'cst.tracking_log' },
  { type: 'bounces', label: 'cst.bounce_log' },
  { type: 'feedback', label: 'cst.feedback_log' },
  { type: 'opens', label: 'cst.open_log' },
  { type: 'clicks', label: 'cst.click_log' },
  { type: 'unsubscribes', label: 'cst.unsubscribe_log' },
];

const LOG_TYPES = LOG_ITEMS.map((i) => i.type);

// Shared campaign detail tabs (mirrors PHP campaigns/_menu). `active` is the current section.
export const CampaignTabs = ({ uid, active = 'overview' }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [openLogs, setOpenLogs] = useState(false);
  const logsRef = useRef(null);
  useClickOutside(logsRef, () => setOpenLogs(false), openLogs);
  const logsActive = LOG_TYPES.includes(active);

  return (
    <ul className="campaign-detail-tabs">
      <li className={active === 'overview' ? 'active' : ''}>
        <button type="button" onClick={() => navigate(`/campaigns/${uid}/statistics`)}>
          <MaterialIcon>auto_graph</MaterialIcon> {t('cst.overview')}
        </button>
      </li>
      <li className={active === 'links' ? 'active' : ''}>
        <button type="button" onClick={() => navigate(`/campaigns/${uid}/links`)}>
          <MaterialIcon>link</MaterialIcon> {t('cst.links')}
        </button>
      </li>
      <li className={active === 'subscribers' ? 'active' : ''}>
        <button type="button" onClick={() => navigate(`/campaigns/${uid}/subscribers`)}>
          <MaterialIcon>people_outline</MaterialIcon> {t('common.subscribers')}
        </button>
      </li>
      <li ref={logsRef} className={`campaign-detail-dropdown ${logsActive ? 'active' : ''}`}>
        <button type="button" onClick={() => setOpenLogs((v) => !v)}>
          <MaterialIcon>article</MaterialIcon> {t('cst.sending_logs')} <span>⌄</span>
        </button>
        {openLogs && (
          <div className="campaign-detail-dropdown-menu">
            {LOG_ITEMS.map((item) => (
              <button
                key={item.type}
                type="button"
                className={active === item.type ? 'active' : ''}
                onClick={() => { setOpenLogs(false); navigate(`/campaigns/${uid}/logs/${item.type}`); }}
              >
                <MaterialIcon>article</MaterialIcon> {t(item.label)}
              </button>
            ))}
          </div>
        )}
      </li>
      <li className={active === 'template' ? 'active' : ''}>
        <button type="button" onClick={() => navigate(`/campaigns/${uid}/review`)}>
          <MaterialIcon>auto_awesome_mosaic</MaterialIcon> {t('cst.email_review')}
        </button>
      </li>
    </ul>
  );
};

export { LOG_ITEMS, LOG_TYPES };
