import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { sendingApi } from '../../api/services';
import { Spinner, toast } from '../../components/ui';
import useClickOutside from '../../hooks/useClickOutside';
import { useTranslation } from '../../i18n';

const fmt = (v) => { const d = new Date(v); return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString('sv').slice(0, 16); };

const SigRow = ({ sig, navigate, onDelete, onSetDefault, onStatus, checked, onToggle }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false), open);
  const editPath = `/sending/signatures/${sig.id}/edit`;
  const active = (sig.status || 'active') === 'active';
  return (
    <div className="sig-row">
      <input type="checkbox" className="sig-row-check" checked={checked} onChange={onToggle} />
      <div className="sig-row-main">
        <button type="button" className="sig-row-name" onClick={() => navigate(editPath)}>{sig.name}</button>
        <p>{t('snd.created_at_label')} {fmt(sig.created_at)}</p>
      </div>
      <span className={`admin-status-badge admin-status-${sig.status || 'active'}`}>{active ? t('snd.status_active_upper') : t('snd.status_inactive_upper')}</span>
      {sig.is_default && <span className="admin-status-badge admin-status-default">{t('snd.default_signature_badge')}</span>}
      <div className="sig-row-actions">
        <button type="button" className="btn-secondary" onClick={() => navigate(editPath)}><span className="material-symbols-rounded">edit</span> {t('common.edit')}</button>
        <div ref={ref} className="admin-dd">
          <button type="button" className="btn-secondary admin-icon-btn" onClick={() => setOpen((v) => !v)} aria-label={t('snd.more')}><span className="admin-caret">⌄</span></button>
          {open && (
            <div className="admin-dd-menu admin-dd-menu-end">
              <button type="button" onClick={() => { setOpen(false); navigate(editPath); }}><span className="material-symbols-rounded">edit</span> {t('common.edit')}</button>
              {!sig.is_default && <button type="button" onClick={() => { setOpen(false); onSetDefault(sig); }}><span className="material-symbols-rounded">star</span> {t('snd.set_as_default')}</button>}
              {active
                ? <button type="button" onClick={() => { setOpen(false); onStatus(sig, 'inactive'); }}><span className="material-symbols-rounded">hide_source</span> {t('snd.disable')}</button>
                : <button type="button" onClick={() => { setOpen(false); onStatus(sig, 'active'); }}><span className="material-symbols-rounded">play_arrow</span> {t('snd.enable')}</button>}
              <button type="button" onClick={() => { setOpen(false); onDelete(sig); }}><span className="material-symbols-rounded">delete_outline</span> {t('common.delete')}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const SignaturesPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('created_at');
  const [dir, setDir] = useState('desc');
  const [keyword, setKeyword] = useState('');
  const [selected, setSelected] = useState(() => new Set());

  const load = () => sendingApi.signatures()
    .then(({ data }) => { setRows(data.data || []); setSelected(new Set()); })
    .catch(() => toast.error(t('snd.failed_load_signatures')))
    .finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let v = rows;
    const kw = keyword.trim().toLowerCase();
    if (kw) v = v.filter((s) => (s.name || '').toLowerCase().includes(kw));
    v = [...v].sort((a, b) => {
      const av = String((sort === 'name' ? a.name : a[sort]) || a.created_at || '');
      const bv = String((sort === 'name' ? b.name : b[sort]) || b.created_at || '');
      const cmp = av.localeCompare(bv);
      return dir === 'desc' ? -cmp : cmp;
    });
    return v;
  }, [rows, keyword, sort, dir]);

  const allSel = filtered.length > 0 && filtered.every((s) => selected.has(s.id));
  const toggleAll = () => setSelected(allSel ? new Set() : new Set(filtered.map((s) => s.id)));
  const toggleRow = (id) => setSelected((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const onDelete = async (sig) => {
    if (!window.confirm(t('snd.confirm_delete_named', { name: sig.name }))) return;
    try { await sendingApi.deleteSignature(sig.id); load(); toast.success(t('snd.deleted')); } catch (err) { toast.error(err.response?.data?.message || t('snd.delete_failed')); }
  };
  const onSetDefault = async (sig) => {
    try { await sendingApi.updateSignature(sig.id, { is_default: true }); load(); toast.success(t('snd.default_signature_updated')); } catch (err) { toast.error(err.response?.data?.message || t('snd.update_failed')); }
  };
  const onStatus = async (sig, status) => {
    try { await sendingApi.updateSignature(sig.id, { status }); load(); } catch (err) { toast.error(err.response?.data?.message || t('snd.update_failed')); }
  };
  const deleteSelected = async () => {
    const items = filtered.filter((s) => selected.has(s.id));
    if (!items.length) return;
    if (!window.confirm(t('snd.confirm_delete_selected_signatures', { count: items.length }))) return;
    const res = await Promise.allSettled(items.map((s) => sendingApi.deleteSignature(s.id)));
    const ok = res.filter((x) => x.status === 'fulfilled').length;
    if (ok) toast.success(t('snd.deleted_count', { count: ok }));
    if (ok < items.length) toast.error(t('snd.could_not_delete_count', { count: items.length - ok }));
    load();
  };

  return (
    <AppLayout>
      <div className="admin-page">
        <header className="admin-header">
          <nav><button type="button" onClick={() => navigate('/dashboard')}>{t('common.home')}</button></nav>
          <h1><span className="material-symbols-rounded">format_list_bulleted</span>{t('snd.signatures')}</h1>
        </header>

        <section className="admin-content">
          <p className="set-intro">{t('snd.signatures_intro')}</p>

          {selected.size > 0 && (
            <div className="admin-bulk-bar">
              <span>{t('snd.selected_count', { count: selected.size })}</span>
              <button type="button" className="btn-danger" onClick={deleteSelected}><span className="material-symbols-rounded">delete_outline</span> {t('snd.delete_selected')}</button>
            </div>
          )}

          <div className="admin-filter-bar">
            <input type="checkbox" className="ss-check-all" checked={allSel} onChange={toggleAll} />
            <span className="admin-filter-label">{t('common.sort_by')}</span>
            <select className="input" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="created_at">{t('common.created_at')}</option>
              <option value="name">{t('common.name')}</option>
              <option value="updated_at">{t('common.updated_at')}</option>
            </select>
            <button type="button" className="btn-secondary admin-icon-btn" onClick={() => setDir((d) => (d === 'desc' ? 'asc' : 'desc'))}><span className="material-symbols-rounded">sort</span></button>
            <div className="admin-filter-search"><input className="input" placeholder={t('common.type_to_search')} value={keyword} onChange={(e) => setKeyword(e.target.value)} /><span className="material-symbols-rounded">search</span></div>
            <button type="button" className="btn-secondary admin-filter-add" onClick={() => navigate('/sending/signatures/new')}><span className="material-symbols-rounded">add</span> {t('snd.add_new_signature')}</button>
          </div>

          {loading ? <div className="admin-empty"><Spinner size="lg" /></div> : (
            filtered.length === 0 ? <div className="hdl-empty"><span className="material-symbols-rounded">draw</span><p>{t('snd.no_signatures')}</p></div>
              : (
                <>
                  <div className="sig-list">{filtered.map((s) => (
                    <SigRow key={s.id} sig={s} navigate={navigate} onDelete={onDelete} onSetDefault={onSetDefault} onStatus={onStatus} checked={selected.has(s.id)} onToggle={() => toggleRow(s.id)} />
                  ))}</div>
                  <div className="sig-footer">
                    <div className="sig-footer-left">
                      <select className="input sig-perpage"><option>15</option><option>25</option><option>50</option><option>100</option></select>
                      <span>{t('snd.items_per_page')}</span>
                      <span className="sig-footer-sep">|</span>
                      <span>{t('snd.pagination_range', { from: filtered.length ? 1 : 0, to: filtered.length, total: filtered.length })}</span>
                    </div>
                    <span className="sig-footer-page">{t('snd.page_of', { current: 1, total: 1 })}</span>
                  </div>
                </>
              )
          )}
        </section>
      </div>
    </AppLayout>
  );
};

export default SignaturesPage;
