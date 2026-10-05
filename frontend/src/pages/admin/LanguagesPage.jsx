import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { adminApi } from '../../api/services';
import { Spinner, toast } from '../../components/ui';
import useClickOutside from '../../hooks/useClickOutside';
import { useTranslation } from '../../i18n';

const LangRow = ({ lang, onStatus, onDelete, onTranslate }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false), open);
  const formatDate = (v) => { const d = new Date(v); return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString(); };
  return (
    <div className="lang-row">
      <div className="lang-main">
        <span className="lang-name">{lang.name}</span>
        <p>{t('cfg.created_at', null, 'Created at')}: {formatDate(lang.created_at)}</p>
      </div>
      <div className="lang-cell"><strong>{lang.code}</strong><span>{t('cfg.code', null, 'Code')}</span></div>
      <span className={`admin-status-badge admin-status-${lang.status}`}>{lang.status === 'active' ? t('cfg.active', null, 'ACTIVE') : lang.status}</span>
      <div className="lang-actions">
        <button type="button" className="btn-secondary" onClick={() => onTranslate(lang)}>{t('cfg.translate', null, 'Translate')}</button>
        <div ref={ref} className="admin-dd">
          <button type="button" className="btn-secondary admin-icon-btn" onClick={() => setOpen((v) => !v)} aria-label="More"><span className="admin-caret">⌄</span></button>
          {open && (
            <div className="admin-dd-menu admin-dd-menu-end">
              <button type="button" onClick={() => { setOpen(false); onStatus(lang, 'enable'); }}><span className="material-symbols-rounded">play_arrow</span> {t('cfg.enable', null, 'Enable')}</button>
              <button type="button" onClick={() => { setOpen(false); onStatus(lang, 'disable'); }}><span className="material-symbols-rounded">hide_source</span> {t('cfg.disable', null, 'Disable')}</button>
              <button type="button" onClick={() => { setOpen(false); onDelete(lang); }}><span className="material-symbols-rounded">delete_outline</span> {t('common.delete', null, 'Delete')}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const LanguagesPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('name');
  const [dir, setDir] = useState('asc');
  const [keyword, setKeyword] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: '', code: '' });
  const [busy, setBusy] = useState(false);

  const load = () => adminApi.adminLanguages()
    .then(({ data }) => setRows(data.data || []))
    .catch(() => toast.error(t('cfg.languages_load_failed', null, 'Failed to load languages.')))
    .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let v = rows;
    const kw = keyword.trim().toLowerCase();
    if (kw) v = v.filter((l) => `${l.name} ${l.code}`.toLowerCase().includes(kw));
    v = [...v].sort((a, b) => {
      const cmp = String(sort === 'name' ? a.name : a.created_at).localeCompare(String(sort === 'name' ? b.name : b.created_at));
      return dir === 'desc' ? -cmp : cmp;
    });
    return v;
  }, [rows, keyword, sort, dir]);

  const add = async () => {
    if (!form.name.trim() || !form.code.trim()) { toast.error(t('cfg.name_code_required', null, 'Name and code are required.')); return; }
    setBusy(true);
    try {
      await adminApi.createLanguage(form);
      setAddOpen(false); setForm({ name: '', code: '' });
      await load(); toast.success(t('cfg.language_added', null, 'Language added.'));
    } catch (err) { toast.error(err.response?.data?.message || t('cfg.add_failed', null, 'Add failed.')); } finally { setBusy(false); }
  };

  const onStatus = async (lang, action) => {
    try { await adminApi.setLanguageStatus(lang.uid, action); load(); } catch (err) { toast.error(err.response?.data?.message || t('cfg.update_failed', null, 'Update failed.')); }
  };
  const onDelete = async (lang) => {
    if (!window.confirm(t('cfg.delete_language_confirm', { name: lang.name }, 'Delete "{name}"?'))) return;
    try { await adminApi.deleteLanguage(lang.uid); load(); toast.success(t('cfg.deleted', null, 'Deleted.')); } catch (err) { toast.error(err.response?.data?.message || t('cfg.delete_failed', null, 'Delete failed.')); }
  };

  return (
    <AppLayout>
      <div className="admin-page">
        <header className="admin-header">
          <nav><button type="button" onClick={() => navigate('/dashboard')}>{t('cfg.home', null, 'Home')}</button></nav>
          <h1><span className="material-symbols-rounded">translate</span>{t('cfg.languages', null, 'Languages')}</h1>
        </header>

        <section className="admin-content">
          <p className="set-intro">{t('cfg.languages_intro', null, 'Our multilingual system allows you to use different, translated versions of the web application. You can switch to a preferred language or even add your own one. You can customize the user interface (UI) text by translating it the way you desire.')}</p>

          <div className="admin-filter-bar">
            <span className="admin-filter-label">{t('cfg.sort_by', null, 'Sort by')}</span>
            <select className="input" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="name">{t('cfg.name', null, 'Name')}</option><option value="created_at">{t('cfg.created_at', null, 'Created at')}</option>
            </select>
            <button type="button" className="btn-secondary admin-icon-btn" onClick={() => setDir((d) => (d === 'desc' ? 'asc' : 'desc'))}><span className="material-symbols-rounded">sort</span></button>
            <div className="admin-filter-search"><input className="input" placeholder={t('cfg.type_to_search', null, 'Type to search')} value={keyword} onChange={(e) => setKeyword(e.target.value)} /><span className="material-symbols-rounded">search</span></div>
            <button type="button" className="btn-secondary admin-filter-add" onClick={() => navigate('/admin/languages/new')}><span className="material-symbols-rounded">add</span> {t('cfg.new_language', null, 'New language')}</button>
          </div>

          {loading ? <div className="admin-empty"><Spinner size="lg" /></div> : (
            <>
              <div className="lang-list">{filtered.map((l) => <LangRow key={l.uid} lang={l} onStatus={onStatus} onDelete={onDelete} onTranslate={(lang) => navigate(`/admin/languages/${lang.code}/translate`)} />)}</div>
              <div className="admin-cur-footer"><span>{t('cfg.items_per_page', { count: 15 }, '{count} items per page')}</span><span className="admin-cur-footer-sep">|</span><span>{t('cfg.records_range', { from: filtered.length ? 1 : 0, to: filtered.length, total: filtered.length }, 'From {from} to {to}. Total {total} records')}</span></div>
            </>
          )}
        </section>
      </div>

      {addOpen && (
        <div className="tax-modal-overlay" onClick={() => setAddOpen(false)}>
          <div className="tax-modal sa-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sa-modal-head"><h3>{t('cfg.new_language', null, 'New language')}</h3><button type="button" onClick={() => setAddOpen(false)}>✕</button></div>
            <div className="sa-modal-body">
              <label className="admin-detail-field admin-detail-field-full"><span>{t('cfg.name_required', null, 'Name *')}</span><input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} autoFocus /></label>
              <label className="admin-detail-field admin-detail-field-full"><span>{t('cfg.code_required', null, 'Code *')}</span><input className="input" placeholder={t('cfg.code_example', null, 'e.g. fr')} value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} /></label>
            </div>
            <div className="sa-modal-foot">
              <button type="button" className="btn-secondary" onClick={() => setAddOpen(false)}>{t('common.cancel', null, 'Cancel')}</button>
              <button type="button" className="btn-secondary wp-create-btn" onClick={add} disabled={busy}>{busy ? t('cfg.adding', null, 'Adding…') : t('cfg.add', null, 'Add')}</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
};

export default LanguagesPage;
