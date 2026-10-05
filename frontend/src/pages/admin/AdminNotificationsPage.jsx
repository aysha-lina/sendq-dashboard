import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { adminApi } from '../../api/services';
import { Spinner, toast } from '../../components/ui';
import { useTranslation } from '../../i18n';

const relativeTime = (value) => {
  const d = new Date(value); if (Number.isNaN(d.getTime())) return '';
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  const units = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]];
  for (const [name, secs] of units) { const v = Math.floor(s / secs); if (v >= 1) return `${v} ${name}${v > 1 ? 's' : ''} ago`; }
  return 'just now';
};
const fmt = (value) => { const d = new Date(value); return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('sv').slice(0, 16); };

const TAB_DEFS = [
  { id: 'profile', labelKey: 'ade.notif.tab_profile', labelEn: 'My profile', icon: 'person' },
  { id: 'contact', labelKey: 'ade.notif.tab_contact', labelEn: 'Contact information', icon: 'contacts' },
  { id: 'api', labelKey: 'ade.notif.tab_api', labelEn: 'API token', icon: 'key' },
  { id: 'notifications', labelKey: 'ade.notif.tab_notifications', labelEn: 'Notifications', icon: 'history' },
];

const AdminNotificationsPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('created_at');
  const [dir, setDir] = useState('desc');
  const [level, setLevel] = useState('all');
  const [keyword, setKeyword] = useState('');
  const [selected, setSelected] = useState(() => new Set());

  useEffect(() => {
    adminApi.notifications({ page: 1, per_page: 200 })
      .then(({ data }) => setRows(data.data || []))
      .catch(() => toast.error(t('ade.notif.load_failed', null, 'Failed to load notifications.')))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let v = rows;
    if (level !== 'all') v = v.filter((n) => (n.level || 'info') === level);
    const kw = keyword.trim().toLowerCase();
    if (kw) v = v.filter((n) => `${n.title} ${n.message}`.toLowerCase().includes(kw));
    v = [...v].sort((a, b) => {
      const cmp = String(sort === 'title' ? a.title : a.created_at).localeCompare(String(sort === 'title' ? b.title : b.created_at));
      return dir === 'desc' ? -cmp : cmp;
    });
    return v;
  }, [rows, level, keyword, sort, dir]);

  const allSelected = filtered.length > 0 && selected.size === filtered.length;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(filtered.map((n) => n.uid || n.id)));
  const toggleRow = (id) => setSelected((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <AppLayout>
      <div className="admin-page">
        <header className="admin-header">
          <nav>
            <button type="button" onClick={() => navigate('/dashboard')}>{t('ade.breadcrumb_home', null, 'Home')}</button>
            <span>›</span>
            <span>{t('ade.notif.breadcrumb', null, 'Notifications')}</span>
          </nav>
          <h1><span className="material-symbols-rounded">forum</span>{t('ade.notif.all_notifications', null, 'All notifications')}</h1>
        </header>

        <section className="admin-content">
          <div className="set-tabs">
            {TAB_DEFS.map((tab) => (
              <button key={tab.id} type="button" className={`set-tab ${tab.id === 'notifications' ? 'is-active' : ''}`}
                onClick={() => { if (tab.id !== 'notifications') navigate(`/admin/account/${tab.id}`); }}>
                <span className="material-symbols-rounded">{tab.icon}</span> {t(tab.labelKey, null, tab.labelEn)}
              </button>
            ))}
          </div>

          <div className="admin-filter-bar">
            <input type="checkbox" className="ss-check-all" checked={allSelected} onChange={toggleAll} />
            <span className="admin-filter-label">{t('ade.notif.sort_by', null, 'Sort by')}</span>
            <select className="input" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="created_at">{t('ade.notif.created_at', null, 'Created at')}</option><option value="title">{t('ade.notif.title', null, 'Title')}</option>
            </select>
            <button type="button" className="btn-secondary admin-icon-btn" onClick={() => setDir((d) => (d === 'desc' ? 'asc' : 'desc'))}><span className="material-symbols-rounded">sort</span></button>
            <span className="admin-filter-label">{t('ade.notif.level', null, 'Level')}</span>
            <select className="input" value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="all">{t('ade.notif.level_all', null, 'All')}</option><option value="info">{t('ade.notif.level_info', null, 'Info')}</option><option value="warning">{t('ade.notif.level_warning', null, 'Warning')}</option><option value="error">{t('ade.notif.level_error', null, 'Error')}</option>
            </select>
            <div className="admin-filter-search"><input className="input" placeholder={t('common.type_to_search', null, 'Type to search')} value={keyword} onChange={(e) => setKeyword(e.target.value)} /><span className="material-symbols-rounded">search</span></div>
          </div>

          {loading ? <div className="admin-empty"><Spinner size="lg" /></div> : (
            <>
              <div className="notif-page-list">
                {filtered.length === 0 ? <div className="hdl-empty"><span className="material-symbols-rounded">notifications</span><p>{t('ade.notif.no_notifications', null, 'No notifications')}</p></div>
                  : filtered.map((n) => {
                    const id = n.uid || n.id;
                    return (
                      <div key={id} className="notif-page-row">
                        <input type="checkbox" className="ss-check-all" checked={selected.has(id)} onChange={() => toggleRow(id)} />
                        <span className={`notif-page-icon level-${n.level || 'info'}`}><span className="material-symbols-rounded">warning</span></span>
                        <div className="notif-page-main">
                          <strong>{n.title}</strong>
                          <p>{n.message}</p>
                        </div>
                        <div className="notif-page-time">
                          <strong>{relativeTime(n.created_at)}</strong>
                          <span>{fmt(n.created_at)}</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
              <div className="admin-cur-footer"><span>{t('ade.notif.items_per_page', { count: 15 }, '15 items per page')}</span><span className="admin-cur-footer-sep">|</span><span>{t('ade.notif.range_total', { from: filtered.length ? 1 : 0, to: filtered.length, total: filtered.length }, `From ${filtered.length ? 1 : 0} to ${filtered.length}. Total ${filtered.length} records`)}</span></div>
            </>
          )}
        </section>
      </div>
    </AppLayout>
  );
};

export default AdminNotificationsPage;
