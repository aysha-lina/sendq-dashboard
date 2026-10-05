import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { adminApi } from '../../api/services';
import { Spinner, toast } from '../../components/ui';
import { useTranslation } from '../../i18n';

const fmt = (v) => { const d = new Date(v); return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString('sv').slice(0, 16); };
const recipient = (r) => r.recipient || r.subscriber?.email || '#';
const campaign = (r) => r.campaign?.name || (typeof r.campaign === 'string' ? r.campaign : null) || 'N/A';

const LOG_CONFIGS = {
  delivery: {
    title: 'Delivery log', titleKey: 'ase.delivery_log', icon: 'local_shipping', api: 'trackingLog', campaignLabel: 'All campaigns', campaignLabelKey: 'ase.all_campaigns',
    columns: [
      { label: 'Recipient', labelKey: 'ase.recipient', cls: 'rl-link', render: recipient },
      { label: 'Status', labelKey: 'common.status', render: (r) => <span className={`admin-status-badge admin-status-${(r.status || '').toLowerCase() === 'sent' ? 'active' : 'inactive'}`}>{(r.status || 'sent').toUpperCase()}</span> },
      { label: 'Campaign', labelKey: 'ase.campaign', render: campaign },
      { label: 'Created at', labelKey: 'ase.created_at', render: (r) => fmt(r.created_at) },
    ],
  },
  bounce: {
    title: 'Bounce log', titleKey: 'ase.bounce_log', icon: 'undo', api: 'bounceLog', campaignLabel: 'All', campaignLabelKey: 'ase.all',
    columns: [
      { label: 'Recipient', labelKey: 'ase.recipient', cls: 'rl-link', render: recipient },
      { label: 'Bounce type', labelKey: 'ase.bounce_type', render: (r) => r.bounce_type || r.reason || 'hard' },
      { label: 'Campaign', labelKey: 'ase.campaign', render: campaign },
      { label: 'Created at', labelKey: 'ase.created_at', render: (r) => fmt(r.created_at) },
    ],
  },
  feedback: {
    title: 'Feedback log', titleKey: 'ase.feedback_log', icon: 'feedback', api: 'feedbackLog', campaignLabel: 'All campaigns', campaignLabelKey: 'ase.all_campaigns',
    columns: [
      { label: 'Recipient', labelKey: 'ase.recipient', render: recipient },
      { label: 'Feedback type', labelKey: 'ase.feedback_type', render: (r) => r.feedback_type || 'spam' },
      { label: 'Raw content', labelKey: 'ase.raw_content', cls: 'rl-raw', render: (r) => r.raw_feedback_content || r.raw_content || '-' },
    ],
  },
  open: {
    title: 'Open log', titleKey: 'ase.open_log', icon: 'drafts', api: 'openLog', campaignLabel: 'All campaigns', campaignLabelKey: 'ase.all_campaigns',
    columns: [
      { label: 'Recipient', labelKey: 'ase.recipient', render: recipient },
      { label: 'IP address', labelKey: 'ase.ip_address', render: (r) => r.ip || '-' },
      { label: 'Campaign', labelKey: 'ase.campaign', render: campaign },
      { label: 'Area', labelKey: 'ase.area', render: (r) => r.area || 'Unknown' },
      { label: 'Created at', labelKey: 'ase.created_at', render: (r) => fmt(r.created_at) },
    ],
  },
  click: {
    title: 'Click log', titleKey: 'ase.click_log', icon: 'ads_click', api: 'clickLog', campaignLabel: 'All', campaignLabelKey: 'ase.all',
    columns: [
      { label: 'Recipient', labelKey: 'ase.recipient', render: recipient },
      { label: 'URL', labelKey: 'ase.url', render: (r) => (r.url ? <a href={r.url} target="_blank" rel="noreferrer" className="rl-url">{r.url}</a> : '-') },
      { label: 'IP address', labelKey: 'ase.ip_address', render: (r) => r.ip || '-' },
      { label: 'Campaign', labelKey: 'ase.campaign', render: campaign },
      { label: 'Created at', labelKey: 'ase.created_at', render: (r) => fmt(r.created_at) },
    ],
  },
  unsubscribe: {
    title: 'Unsubscribe log', titleKey: 'ase.unsubscribe_log', icon: 'unsubscribe', api: 'unsubscribeLog', campaignLabel: 'All', campaignLabelKey: 'ase.all',
    columns: [
      { label: 'Recipient', labelKey: 'ase.recipient', render: recipient },
      { label: 'IP address', labelKey: 'ase.ip_address', render: (r) => r.ip_address || r.ip || '-' },
      { label: 'Campaign', labelKey: 'ase.campaign', render: campaign },
      { label: 'Created at', labelKey: 'ase.created_at', render: (r) => fmt(r.created_at) },
    ],
  },
};

const ReportLogPage = ({ type }) => {
  const cfg = LOG_CONFIGS[type];
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dir, setDir] = useState('desc');
  const [campaignFilter, setCampaignFilter] = useState('all');
  const [keyword, setKeyword] = useState('');

  useEffect(() => {
    setLoading(true);
    adminApi[cfg.api]({ page: 1, per_page: 100 })
      .then(({ data }) => setRows(data.data || []))
      .catch(() => toast.error(t('ase.failed_to_load_log', null, 'Failed to load log.')))
      .finally(() => setLoading(false));
  }, [cfg.api]);

  const campaigns = useMemo(() => [...new Set(rows.map(campaign))].filter((c) => c && c !== 'N/A'), [rows]);

  const filtered = useMemo(() => {
    let v = rows;
    if (cfg.campaignLabel && campaignFilter !== 'all') v = v.filter((r) => campaign(r) === campaignFilter);
    const kw = keyword.trim().toLowerCase();
    if (kw) v = v.filter((r) => `${recipient(r)} ${campaign(r)}`.toLowerCase().includes(kw));
    v = [...v].sort((a, b) => { const cmp = String(a.created_at || '').localeCompare(String(b.created_at || '')); return dir === 'desc' ? -cmp : cmp; });
    return v;
  }, [rows, campaignFilter, keyword, dir, cfg.campaignLabel]);

  return (
    <AppLayout>
      <div className="admin-page">
        <header className="admin-header">
          <nav><button type="button" onClick={() => navigate('/dashboard')}>{t('ase.home', null, 'Home')}</button></nav>
          <h1><span className="material-symbols-rounded">{cfg.icon}</span>{t(cfg.titleKey, null, cfg.title)}</h1>
        </header>

        <section className="admin-content">
          <div className="admin-filter-bar">
            <span className="admin-filter-label">{t('ase.sort_by', null, 'Sort by')}</span>
            <select className="input" value="created_at" disabled><option value="created_at">{t('ase.created_at', null, 'Created at')}</option></select>
            <button type="button" className="btn-secondary admin-icon-btn" onClick={() => setDir((d) => (d === 'desc' ? 'asc' : 'desc'))}><span className="material-symbols-rounded">sort</span></button>
            {cfg.campaignLabel && (
              <>
                <span className="admin-filter-label">{cfg.campaignLabel === 'All' ? t('ase.campaign', null, 'Campaign') : ''}</span>
                <select className="input" value={campaignFilter} onChange={(e) => setCampaignFilter(e.target.value)}>
                  <option value="all">{t(cfg.campaignLabelKey, null, cfg.campaignLabel)}</option>
                  {campaigns.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </>
            )}
            <div className="admin-filter-search"><input className="input" placeholder={t('ase.type_to_search', null, 'Type to search')} value={keyword} onChange={(e) => setKeyword(e.target.value)} /><span className="material-symbols-rounded">search</span></div>
          </div>

          {loading ? <div className="admin-empty"><Spinner size="lg" /></div> : (
            <div className="rl-table-wrap">
              <table className="rl-table">
                <thead><tr>{cfg.columns.map((c) => <th key={c.label}>{t(c.labelKey, null, c.label)}</th>)}</tr></thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={cfg.columns.length} className="rl-empty">{t('ase.no_records', null, 'No records.')}</td></tr>
                  ) : filtered.map((r) => (
                    <tr key={r.id}>
                      {cfg.columns.map((c) => <td key={c.label} className={c.cls || ''}>{c.render(r)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
};

export default ReportLogPage;
