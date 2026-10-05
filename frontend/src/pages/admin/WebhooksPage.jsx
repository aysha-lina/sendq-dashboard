import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { adminApi } from '../../api/services';
import { Spinner, toast } from '../../components/ui';
import useClickOutside from '../../hooks/useClickOutside';
import { useTranslation } from '../../i18n';

const Row = ({ w, onStatus, onDelete, checked, onToggle }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false), open);
  return (
    <div className="wh-row">
      <input type="checkbox" className="ss-row-check" checked={checked} onChange={onToggle} />
      <div className="wh-main">
        <span className="wh-name">{w.name}</span>
        <p>{w.event}</p>
      </div>
      <div className="wh-cell"><strong>{w.request_method}</strong><span>{w.request_url || '—'}</span></div>
      <span className={`admin-status-badge admin-status-${w.status}`}>{w.status}</span>
      <div ref={ref} className="admin-dd">
        <button type="button" className="btn-secondary admin-icon-btn" onClick={() => setOpen((v) => !v)}><span className="admin-caret">⌄</span></button>
        {open && (
          <div className="admin-dd-menu admin-dd-menu-end">
            <button type="button" onClick={() => { setOpen(false); onStatus(w, w.status === 'active' ? 'disable' : 'enable'); }}><span className="material-symbols-rounded">{w.status === 'active' ? 'hide_source' : 'play_arrow'}</span> {w.status === 'active' ? t('ase.disable', null, 'Disable') : t('ase.enable', null, 'Enable')}</button>
            <button type="button" onClick={() => { setOpen(false); onDelete(w); }}><span className="material-symbols-rounded">delete_outline</span> {t('common.delete', null, 'Delete')}</button>
          </div>
        )}
      </div>
    </div>
  );
};

const WebhooksPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('created_at');
  const [dir, setDir] = useState('desc');
  const [keyword, setKeyword] = useState('');
  const [selected, setSelected] = useState(() => new Set());

  const load = () => adminApi.adminWebhooks()
    .then(({ data }) => setRows(data.data || []))
    .catch(() => toast.error(t('ase.failed_to_load', null, 'Failed to load.')))
    .finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let v = rows;
    const kw = keyword.trim().toLowerCase();
    if (kw) v = v.filter((w) => `${w.name} ${w.event} ${w.request_url || ''}`.toLowerCase().includes(kw));
    v = [...v].sort((a, b) => { const cmp = String(sort === 'name' ? a.name : a.created_at).localeCompare(String(sort === 'name' ? b.name : b.created_at)); return dir === 'desc' ? -cmp : cmp; });
    return v;
  }, [rows, keyword, sort, dir]);

  const onStatus = async (w, action) => { try { await adminApi.setWebhookStatus(w.uid, action); load(); } catch (err) { toast.error(err.response?.data?.message || t('ase.update_failed', null, 'Update failed.')); } };
  const onDelete = async (w) => { if (!window.confirm(t('ase.delete_confirm', { name: w.name }, 'Delete "{name}"?'))) return; try { await adminApi.deleteWebhook(w.uid); load(); toast.success(t('ase.deleted', null, 'Deleted.')); } catch (err) { toast.error(err.response?.data?.message || t('ase.delete_failed', null, 'Delete failed.')); } };

  const allSel = filtered.length > 0 && filtered.every((w) => selected.has(w.uid));
  const toggleAll = () => setSelected(allSel ? new Set() : new Set(filtered.map((w) => w.uid)));
  const toggleRow = (w) => setSelected((p) => { const n = new Set(p); if (n.has(w.uid)) n.delete(w.uid); else n.add(w.uid); return n; });
  const bulkDelete = async () => {
    const items = filtered.filter((w) => selected.has(w.uid));
    if (!items.length) return;
    if (!window.confirm(t('ase.delete_selected_webhooks_confirm', { count: items.length }, 'Delete {count} selected webhook(s)?'))) return;
    const res = await Promise.allSettled(items.map((w) => adminApi.deleteWebhook(w.uid)));
    const ok = res.filter((x) => x.status === 'fulfilled').length;
    if (ok) toast.success(t('ase.deleted_count', { count: ok }, 'Deleted {count}.'));
    if (ok < items.length) toast.error(t('ase.could_not_be_deleted', { count: items.length - ok }, '{count} could not be deleted.'));
    setSelected(new Set());
    load();
  };

  return (
    <AppLayout>
      <div className="admin-page">
        <header className="admin-header">
          <nav><button type="button" onClick={() => navigate('/dashboard')}>{t('ase.home', null, 'Home')}</button></nav>
          <h1><span className="material-symbols-rounded">webhook</span>{t('ase.webhooks', null, 'Webhooks')}</h1>
        </header>
        <section className="admin-content">
          <p className="set-intro">{t('ase.webhooks_intro', null, 'The Webhooks Management feature lets users integrate their system with external services by creating custom webhooks for specific events. Events include actions like subscribing to a plan, canceling a plan, or subscribing to a list. This enables real-time notifications and seamless automation, ensuring efficient workflows and synchronized systems.')}</p>
          {selected.size > 0 && (
            <div className="admin-bulk-bar">
              <span>{t('ase.n_selected', { count: selected.size }, '{count} selected')}</span>
              <button type="button" className="btn-danger" onClick={bulkDelete}><span className="material-symbols-rounded">delete_outline</span> {t('ase.delete_selected', null, 'Delete selected')}</button>
            </div>
          )}
          <div className="admin-filter-bar">
            <input type="checkbox" className="ss-check-all" checked={allSel} onChange={toggleAll} />
            <span className="admin-filter-label">{t('ase.sort_by', null, 'Sort by')}</span>
            <select className="input" value={sort} onChange={(e) => setSort(e.target.value)}><option value="created_at">{t('ase.created_at', null, 'Created at')}</option><option value="name">{t('common.name', null, 'Name')}</option></select>
            <button type="button" className="btn-secondary admin-icon-btn" onClick={() => setDir((d) => (d === 'desc' ? 'asc' : 'desc'))}><span className="material-symbols-rounded">sort</span></button>
            <div className="admin-filter-search"><input className="input" placeholder={t('ase.type_to_search', null, 'Type to search')} value={keyword} onChange={(e) => setKeyword(e.target.value)} /><span className="material-symbols-rounded">search</span></div>
            <button type="button" className="btn-secondary admin-filter-add" onClick={() => navigate('/admin/webhooks/new')}><span className="material-symbols-rounded">add</span> {t('ase.add_a_new_webhook', null, 'Add a new webhook')}</button>
          </div>
          {loading ? <div className="admin-empty"><Spinner size="lg" /></div> : (
            filtered.length === 0 ? <div className="hdl-empty"><span className="material-symbols-rounded">dns</span><p>{t('ase.there_are_no_webhooks', null, 'There are no webhooks')}</p></div>
              : <div className="wh-list">{filtered.map((w) => <Row key={w.uid} w={w} onStatus={onStatus} onDelete={onDelete} checked={selected.has(w.uid)} onToggle={() => toggleRow(w)} />)}</div>
          )}
        </section>
      </div>
    </AppLayout>
  );
};

export default WebhooksPage;
