import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { sendingApi } from '../../api/services';
import { Spinner, toast } from '../../components/ui';
import { useTranslation } from '../../i18n';

const fmt = (v) => { const d = new Date(v); return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString('sv').slice(0, 16); };

const BlacklistPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('created_at');
  const [dir, setDir] = useState('desc');
  const [keyword, setKeyword] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ email: '', reason: '' });
  const [busy, setBusy] = useState(false);

  const load = () => sendingApi.blacklist()
    .then(({ data }) => { setRows(data.data || []); setSelected(new Set()); })
    .catch(() => toast.error(t('snd.failed_load_blacklist')))
    .finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let v = rows;
    const kw = keyword.trim().toLowerCase();
    if (kw) v = v.filter((r) => (r.email || '').toLowerCase().includes(kw));
    v = [...v].sort((a, b) => {
      const av = String((sort === 'email' ? a.email : a.created_at) || '');
      const bv = String((sort === 'email' ? b.email : b.created_at) || '');
      const cmp = av.localeCompare(bv);
      return dir === 'desc' ? -cmp : cmp;
    });
    return v;
  }, [rows, keyword, sort, dir]);

  const allSel = filtered.length > 0 && selected.size === filtered.length;
  const toggleAll = () => setSelected(allSel ? new Set() : new Set(filtered.map((r) => r.id)));
  const toggleRow = (id) => setSelected((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const remove = async (r) => {
    if (!window.confirm(t('snd.confirm_remove_from_blacklist', { email: r.email }))) return;
    try { await sendingApi.deleteBlacklist(r.id); load(); toast.success(t('snd.removed')); } catch (err) { toast.error(err.response?.data?.message || t('snd.remove_failed')); }
  };
  const removeSelected = async () => {
    const ids = [...selected];
    if (!ids.length) { toast.error(t('snd.select_rows_first')); return; }
    if (!window.confirm(t('snd.confirm_remove_selected_emails', { count: ids.length }))) return;
    try { await Promise.all(ids.map((id) => sendingApi.deleteBlacklist(id))); load(); toast.success(t('snd.removed')); } catch (err) { toast.error(err.response?.data?.message || t('snd.remove_failed')); }
  };

  const add = async () => {
    if (!form.email.trim()) { toast.error(t('snd.email_required')); return; }
    setBusy(true);
    try {
      await sendingApi.createBlacklist(form);
      setAddOpen(false); setForm({ email: '', reason: '' });
      await load(); toast.success(t('snd.address_blacklisted'));
    } catch (err) { toast.error(err.response?.data?.message || t('snd.add_failed')); } finally { setBusy(false); }
  };

  return (
    <AppLayout>
      <div className="admin-page">
        <header className="admin-header">
          <nav><button type="button" onClick={() => navigate('/dashboard')}>{t('common.home')}</button></nav>
          <h1><span className="material-symbols-rounded">format_list_bulleted</span>{t('snd.blacklist')}</h1>
        </header>

        <section className="admin-content">
          <div className="admin-filter-bar">
            <select className="input" value="" onChange={(e) => { if (e.target.value === 'remove') removeSelected(); e.target.value = ''; }}>
              <option value="">{t('snd.select')}</option>
              <option value="remove">{t('snd.remove_selected')}</option>
            </select>
            <span className="admin-filter-label">{t('common.sort_by')}</span>
            <select className="input" value={sort} onChange={(e) => setSort(e.target.value)}><option value="created_at">{t('common.created_at')}</option><option value="email">{t('snd.email')}</option></select>
            <button type="button" className="btn-secondary admin-icon-btn" onClick={() => setDir((d) => (d === 'desc' ? 'asc' : 'desc'))}><span className="material-symbols-rounded">sort</span></button>
            <div className="admin-filter-search"><input className="input" placeholder={t('common.type_to_search')} value={keyword} onChange={(e) => setKeyword(e.target.value)} /><span className="material-symbols-rounded">search</span></div>
            <button type="button" className="btn-secondary admin-filter-add" onClick={() => navigate('/sending/blacklist/import')}><span className="material-symbols-rounded">upload</span> {t('common.import')}</button>
            <button type="button" className="btn-primary admin-filter-add" onClick={() => setAddOpen(true)}><span className="material-symbols-rounded">add</span> {t('snd.add_address')}</button>
          </div>

          {loading ? <div className="admin-empty"><Spinner size="lg" /></div> : (
            <div className="rl-table-wrap">
              <table className="rl-table">
                <thead><tr>
                  <th className="rl-check"><input type="checkbox" checked={allSel} onChange={toggleAll} /></th>
                  <th>{t('snd.email')}</th><th>{t('snd.reason')}</th><th>{t('common.created_at')}</th><th className="rl-action">{t('snd.action')}</th>
                </tr></thead>
                <tbody>
                  {filtered.length === 0 ? <tr><td colSpan={5} className="rl-empty">{t('snd.no_blacklist_records')}</td></tr>
                    : filtered.map((r) => (
                      <tr key={r.id}>
                        <td className="rl-check"><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleRow(r.id)} /></td>
                        <td className="rl-link">{r.email}</td>
                        <td>{r.reason || '-'}</td>
                        <td>{fmt(r.created_at)}</td>
                        <td className="rl-action"><button type="button" className="btn-danger" onClick={() => remove(r)}>{t('snd.remove')}</button></td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {addOpen && (
        <div className="tax-modal-overlay" onClick={() => setAddOpen(false)}>
          <div className="tax-modal sa-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sa-modal-head"><h3>{t('snd.add_address')}</h3><button type="button" onClick={() => setAddOpen(false)}>✕</button></div>
            <div className="sa-modal-body">
              <label className="admin-detail-field admin-detail-field-full"><span>{t('snd.email_label')}</span><input className="input" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} autoFocus placeholder="spammer@example.com" /></label>
              <label className="admin-detail-field admin-detail-field-full"><span>{t('snd.reason')}</span><input className="input" value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} placeholder={t('snd.optional_reason')} /></label>
            </div>
            <div className="sa-modal-foot">
              <button type="button" className="btn-secondary" onClick={() => setAddOpen(false)}>{t('common.cancel')}</button>
              <button type="button" className="btn-primary wp-create-btn" onClick={add} disabled={busy}>{busy ? t('snd.adding') : t('snd.add')}</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
};

export default BlacklistPage;
