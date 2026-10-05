import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { adminApi } from '../../api/services';
import { Spinner, toast } from '../../components/ui';
import { useTranslation } from '../../i18n';

const fmt = (v) => { const d = new Date(v); return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString('sv').slice(0, 16); };

const BlacklistPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dir, setDir] = useState('desc');
  const [keyword, setKeyword] = useState('');
  const [selected, setSelected] = useState(() => new Set());

  const load = () => adminApi.blacklist({ page: 1, per_page: 200 })
    .then(({ data }) => { setRows(data.data || []); setSelected(new Set()); })
    .catch(() => toast.error(t('ase.failed_to_load_blacklist', null, 'Failed to load blacklist.')))
    .finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let v = rows;
    const kw = keyword.trim().toLowerCase();
    if (kw) v = v.filter((r) => (r.email || '').toLowerCase().includes(kw));
    v = [...v].sort((a, b) => { const cmp = String(a.created_at || '').localeCompare(String(b.created_at || '')); return dir === 'desc' ? -cmp : cmp; });
    return v;
  }, [rows, keyword, dir]);

  const allSel = filtered.length > 0 && selected.size === filtered.length;
  const toggleAll = () => setSelected(allSel ? new Set() : new Set(filtered.map((r) => r.id)));
  const toggleRow = (id) => setSelected((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const remove = async (r) => {
    if (!window.confirm(t('ase.remove_from_blacklist_confirm', { email: r.email }, 'Remove "{email}" from blacklist?'))) return;
    try { await adminApi.deleteBlacklist(r.id); load(); toast.success(t('ase.removed', null, 'Removed.')); } catch (err) { toast.error(err.response?.data?.message || t('ase.remove_failed', null, 'Remove failed.')); }
  };
  const removeSelected = async () => {
    const ids = [...selected];
    if (!ids.length) { toast.error(t('ase.select_rows_first', null, 'Select rows first.')); return; }
    if (!window.confirm(t('ase.remove_selected_confirm', { count: ids.length }, 'Remove {count} selected email(s)?'))) return;
    try { await Promise.all(ids.map((id) => adminApi.deleteBlacklist(id))); load(); toast.success(t('ase.removed', null, 'Removed.')); } catch (err) { toast.error(err.response?.data?.message || t('ase.remove_failed', null, 'Remove failed.')); }
  };

  return (
    <AppLayout>
      <div className="admin-page">
        <header className="admin-header">
          <nav><button type="button" onClick={() => navigate('/dashboard')}>{t('ase.home', null, 'Home')}</button></nav>
          <h1><span className="material-symbols-rounded">person_off</span>{t('ase.blacklist', null, 'Blacklist')}</h1>
        </header>

        <section className="admin-content">
          <div className="admin-filter-bar">
            <select className="input" value="" onChange={(e) => { if (e.target.value === 'remove') removeSelected(); e.target.value = ''; }}>
              <option value="">{t('ase.select', null, 'Select')}</option>
              <option value="remove">{t('ase.remove_selected', null, 'Remove selected')}</option>
            </select>
            <span className="admin-filter-label">{t('ase.sort_by', null, 'Sort by')}</span>
            <select className="input" value="created_at" disabled><option value="created_at">{t('ase.created_at', null, 'Created at')}</option></select>
            <button type="button" className="btn-secondary admin-icon-btn" onClick={() => setDir((d) => (d === 'desc' ? 'asc' : 'desc'))}><span className="material-symbols-rounded">sort</span></button>
            <div className="admin-filter-search"><input className="input" placeholder={t('ase.type_to_search', null, 'Type to search')} value={keyword} onChange={(e) => setKeyword(e.target.value)} /><span className="material-symbols-rounded">search</span></div>
            <button type="button" className="btn-secondary admin-filter-add" onClick={() => navigate('/admin/blacklist/import')}><span className="material-symbols-rounded">upload</span> {t('common.import', null, 'Import')}</button>
          </div>

          {loading ? <div className="admin-empty"><Spinner size="lg" /></div> : (
            <div className="rl-table-wrap">
              <table className="rl-table">
                <thead><tr>
                  <th className="rl-check"><input type="checkbox" checked={allSel} onChange={toggleAll} /></th>
                  <th>{t('ase.email', null, 'Email')}</th><th>{t('ase.created_at', null, 'Created at')}</th><th className="rl-action">{t('ase.action', null, 'Action')}</th>
                </tr></thead>
                <tbody>
                  {filtered.length === 0 ? <tr><td colSpan={4} className="rl-empty">{t('ase.no_blacklisted_emails', null, 'No blacklisted emails.')}</td></tr>
                    : filtered.map((r) => (
                      <tr key={r.id}>
                        <td className="rl-check"><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleRow(r.id)} /></td>
                        <td className="rl-link">{r.email}</td>
                        <td>{fmt(r.created_at)}</td>
                        <td className="rl-action"><button type="button" className="btn-danger" onClick={() => remove(r)}>{t('ase.remove', null, 'Remove')}</button></td>
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

export default BlacklistPage;
