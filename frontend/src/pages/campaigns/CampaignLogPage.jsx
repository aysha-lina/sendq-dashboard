import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { Spinner } from '../../components/ui';
import { campaignsApi, analyticsApi } from '../../api/services';
import { CampaignHeader, CampaignTabs, LOG_TYPES } from './CampaignNav';
import { useTranslation } from '../../i18n';

const MaterialIcon = ({ children, className = '' }) => (
  <span className={`material-symbols-rounded ${className}`}>{children}</span>
);

const formatDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
};

// Per-type page title + table columns (mirrors PHP campaigns/*_log views).
const LOG_CONFIG = {
  tracking: {
    title: 'cst.tracking_log',
    columns: [
      { key: 'email', label: 'cst.col_recipient', render: (r) => r.subscriber?.email || '-' },
      { key: 'status', label: 'common.status', render: (r) => r.status || '-' },
      { key: 'error', label: 'cst.col_error', render: (r) => r.error || '-' },
      { key: 'created_at', label: 'cst.col_created_at', render: (r) => formatDateTime(r.created_at) },
    ],
  },
  opens: {
    title: 'cst.open_log',
    columns: [
      { key: 'email', label: 'cst.col_recipient', render: (r) => r.subscriber?.email || '-' },
      { key: 'ip', label: 'cst.col_ip_address', render: (r) => r.ip || r.ip_address || '-' },
      { key: 'created_at', label: 'cst.col_created_at', render: (r) => formatDateTime(r.created_at) },
    ],
  },
  clicks: {
    title: 'cst.click_log',
    columns: [
      { key: 'email', label: 'cst.col_recipient', render: (r) => r.subscriber?.email || '-' },
      { key: 'url', label: 'cst.col_url', render: (r) => r.url || '-' },
      { key: 'created_at', label: 'cst.col_created_at', render: (r) => formatDateTime(r.created_at) },
    ],
  },
  bounces: {
    title: 'cst.bounce_log',
    columns: [
      { key: 'email', label: 'cst.col_recipient', render: (r) => r.subscriber?.email || '-' },
      { key: 'reason', label: 'cst.col_reason', render: (r) => r.reason || '-' },
      { key: 'created_at', label: 'cst.col_created_at', render: (r) => formatDateTime(r.created_at) },
    ],
  },
  unsubscribes: {
    title: 'cst.unsubscribe_log',
    columns: [
      { key: 'email', label: 'cst.col_recipient', render: (r) => r.subscriber?.email || '-' },
      { key: 'ip_address', label: 'cst.col_ip_address', render: (r) => r.ip_address || '-' },
      { key: 'created_at', label: 'cst.col_created_at', render: (r) => formatDateTime(r.created_at) },
    ],
  },
  feedback: {
    title: 'cst.feedback_log',
    columns: [
      { key: 'email', label: 'cst.col_recipient', render: (r) => r.subscriber?.email || '-' },
      { key: 'feedback_type', label: 'cst.col_type', render: (r) => r.feedback_type || '-' },
      { key: 'created_at', label: 'cst.col_created_at', render: (r) => formatDateTime(r.created_at) },
    ],
  },
};

const CampaignLogPage = () => {
  const { uid, type } = useParams();
  const { t } = useTranslation();
  const config = LOG_CONFIG[type] || LOG_CONFIG.opens;
  const validType = LOG_TYPES.includes(type) ? type : 'opens';

  const [campaign, setCampaign] = useState(null);
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sortDir, setSortDir] = useState('desc');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    campaignsApi.get(uid).then(({ data }) => setCampaign(data)).catch(() => setCampaign(null));
  }, [uid]);

  // Reset to first page whenever the log type changes.
  useEffect(() => { setPage(1); }, [validType]);

  useEffect(() => {
    setLoading(true);
    analyticsApi.campaignLogs(uid, validType, { page, per_page: 25 })
      .then(({ data }) => { setRows(data.data || []); setPagination(data.pagination || null); })
      .catch(() => { setRows([]); setPagination(null); })
      .finally(() => setLoading(false));
  }, [uid, validType, page]);

  // Client-side keyword filter across the visible cell text (PHP filters server-side; this keeps parity visually).
  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase();
    let list = rows;
    if (kw) {
      list = rows.filter((r) => config.columns.some((c) => String(c.render(r) ?? '').toLowerCase().includes(kw)));
    }
    if (sortDir === 'asc') list = [...list].reverse();
    return list;
  }, [rows, search, sortDir, config]);

  const download = (blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(campaign?.name || 'campaign').replace(/[^a-z0-9]+/gi, '-')}-${validType}-log.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Server-side export of the FULL log (all rows), not just the current page.
  const exportCsv = async () => {
    try {
      const { data } = await analyticsApi.campaignLogExport(uid, validType);
      download(data);
    } catch {
      // Fall back to a client-side export of what's loaded.
      if (!filtered.length) return;
      const esc = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
      const header = config.columns.map((c) => esc(t(c.label))).join(',');
      const body = filtered.map((r) => config.columns.map((c) => esc(r[c.key])).join(',')).join('\n');
      download(new Blob([`${header}\n${body}`], { type: 'text/csv;charset=utf-8;' }));
    }
  };

  return (
    <AppLayout>
      <div className="campaigns-page campaign-detail-page">
        <CampaignHeader campaign={campaign} />
        <CampaignTabs uid={uid} active={validType} />

        <h2 className="campaign-log-title">{t(config.title)}</h2>

        <div className="campaign-log-controls">
          <div className="campaign-log-filter">
            <span className="campaign-log-sortlabel">{t('cst.sort_by')}</span>
            <select className="input" value="created_at" onChange={() => {}}>
              <option value="created_at">{t('cst.col_created_at')}</option>
            </select>
            <button
              type="button"
              className="btn-secondary campaign-log-sortdir"
              title={t('cst.change_sort_direction')}
              onClick={() => setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))}
            >
              <MaterialIcon>{sortDir === 'desc' ? 'sort' : 'sort'}</MaterialIcon>
            </button>
            <div className="campaign-log-search">
              <input
                type="text"
                className="input"
                placeholder={t('cst.type_to_search')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <MaterialIcon>search</MaterialIcon>
            </div>
          </div>
          <button type="button" className="btn-secondary" onClick={exportCsv} disabled={!filtered.length}>
            <MaterialIcon>download</MaterialIcon> {t('cst.download')}
          </button>
        </div>

        <div className="campaign-log-panel">
          {loading ? (
            <div className="campaign-loading"><Spinner /></div>
          ) : filtered.length === 0 ? (
            <div className="campaign-log-empty-state">
              <MaterialIcon>auto_awesome</MaterialIcon>
              <span>{search ? t('cst.no_results_match') : t('cst.no_logs_yet')}</span>
            </div>
          ) : (
            <>
              <table className="campaign-log-table">
                <thead>
                  <tr>{config.columns.map((c) => <th key={c.key}>{t(c.label)}</th>)}</tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id}>{config.columns.map((c) => <td key={c.key}>{c.render(r)}</td>)}</tr>
                  ))}
                </tbody>
              </table>
              {pagination && pagination.total_pages > 1 && (
                <div className="campaign-log-pager">
                  <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{t('cst.prev')}</button>
                  <span>{t('cst.page_of_total', { page: pagination.page, pages: pagination.total_pages, total: pagination.total })}</span>
                  <button type="button" disabled={page >= pagination.total_pages} onClick={() => setPage((p) => p + 1)}>{t('cst.next')}</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default CampaignLogPage;
