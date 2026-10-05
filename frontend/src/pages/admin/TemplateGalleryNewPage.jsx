import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { adminApi } from '../../api/services';
import { Spinner, toast } from '../../components/ui';
import { useTranslation } from '../../i18n';

const CategorySection = ({ title, items, onPick }) => {
  const { t } = useTranslation();
  const [sort, setSort] = useState('default');
  const [keyword, setKeyword] = useState('');
  let v = items;
  const kw = keyword.trim().toLowerCase();
  if (kw) v = v.filter((t) => t.name.toLowerCase().includes(kw));
  if (sort === 'name') v = [...v].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="tgn-section">
      <h2 className="tgn-cat-title">{title}</h2>
      <div className="admin-filter-bar tgn-bar">
        <span className="admin-filter-label">{t('atp.sort_by', null, 'Sort by')}</span>
        <select className="input" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="default">{t('atp.default', null, 'Default')}</option><option value="name">{t('common.name', null, 'Name')}</option>
        </select>
        <button type="button" className="btn-secondary admin-icon-btn"><span className="material-symbols-rounded">sort</span></button>
        <div className="admin-filter-search"><input className="input" placeholder={t('atp.type_to_search', null, 'Type to search')} value={keyword} onChange={(e) => setKeyword(e.target.value)} /><span className="material-symbols-rounded">search</span></div>
      </div>
      <div className="tgn-grid">
        {v.map((t) => (
          <button key={t.uid} type="button" className="tgn-card" onClick={() => onPick(t)}>
            <div className="tgn-thumb">{t.image ? <img src={t.image} alt="" /> : <div className="tg-thumb-ph"><span className="material-symbols-rounded">image</span></div>}</div>
            <span className="tgn-name">{t.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

const TemplateGalleryNewPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [name, setName] = useState('Untitled template');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    adminApi.templateGallery()
      .then(({ data }) => setRows(data.data || []))
      .catch(() => toast.error(t('atp.failed_load_base_templates', null, 'Failed to load base templates.')))
      .finally(() => setLoading(false));
  }, []);

  const groups = useMemo(() => {
    const g = {};
    rows.forEach((t) => { (g[t.category] = g[t.category] || []).push(t); });
    return g;
  }, [rows]);

  const createFrom = async (base) => {
    setBusy(true);
    try {
      let content = '';
      if (base) { const { data } = await adminApi.templateGalleryDetail(base.uid); content = data.content || ''; }
      const { data } = await adminApi.createTemplateGallery({ name: name.trim() || 'Untitled template', content });
      navigate(`/admin/template-gallery/${data.uid}/design`);
    } catch (err) {
      toast.error(err.response?.data?.message || t('atp.could_not_create_template', null, 'Could not create template.'));
      setBusy(false);
    }
  };

  return (
    <AppLayout>
      <div className="admin-page">
        <header className="admin-header">
          <nav>
            <button type="button" onClick={() => navigate('/dashboard')}>{t('atp.home', null, 'Home')}</button>
            <span>›</span>
            <button type="button" onClick={() => navigate('/admin/template-gallery')}>{t('atp.templates', null, 'Templates')}</button>
          </nav>
          <h1>{t('atp.new_template', null, 'New template')}</h1>
        </header>

        <section className="admin-content">
          <label className="admin-detail-field admin-detail-field-full set-field" style={{ maxWidth: 1500 }}>
            <span>{t('atp.enter_template_name', null, "Enter your template's name here *")}</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </label>

          <div className="tgn-head">
            <h2 className="set-edit-title" style={{ margin: 0 }}>{t('atp.select_base_template', null, 'Select one from the base templates below')}</h2>
            <button type="button" className="btn-secondary" onClick={() => createFrom(null)} disabled={busy}>{busy ? t('atp.starting', null, 'Starting…') : t('atp.start_design', null, 'Start Design')}</button>
          </div>

          {loading ? <div className="admin-empty"><Spinner size="lg" /></div> : (
            Object.keys(groups).length === 0
              ? <div className="admin-empty"><span className="material-symbols-rounded">grid_view</span><p>{t('atp.no_base_templates', null, 'No base templates yet')}</p></div>
              : Object.entries(groups).map(([cat, items]) => <CategorySection key={cat} title={cat} items={items} onPick={createFrom} />)
          )}
        </section>
      </div>
    </AppLayout>
  );
};

export default TemplateGalleryNewPage;
