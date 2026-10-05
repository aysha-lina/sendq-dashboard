import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { adminApi } from '../../api/services';
import { Spinner, toast } from '../../components/ui';
import useClickOutside from '../../hooks/useClickOutside';
import { useTranslation } from '../../i18n';

const PER_PAGE = 12;

const TemplateCard = ({ tpl, navigate, onAction }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false), open);
  return (
    <div className="tg-card">
      <div className="tg-thumb">
        {tpl.image ? <img src={tpl.image} alt="" /> : <div className="tg-thumb-ph"><span className="material-symbols-rounded">image</span></div>}
        <div className="tg-overlay">
          <button type="button" className="btn-secondary tg-ov-btn" onClick={() => onAction('preview', tpl)}>
            <span className="material-symbols-rounded">search</span> {t('atp.preview', null, 'Preview')}
          </button>
          <button type="button" className="tg-probuilder" onClick={() => navigate(`/admin/template-gallery/${tpl.uid}/design`)}>
            {t('atp.pro_builder', null, 'PRO builder')}
          </button>
        </div>
      </div>
      <div className="tg-card-body">
        <p className="tg-card-name" title={tpl.name}>{tpl.name}</p>
        <strong className="tg-card-cat">{tpl.category}</strong>
        <div ref={ref} className="admin-dd tg-actions">
          <button type="button" className="btn-secondary" onClick={() => setOpen((v) => !v)}>{t('common.actions', null, 'Actions')} <span className="admin-caret">⌄</span></button>
          {open && (
            <div className="admin-dd-menu admin-dd-menu-up">
              <button type="button" onClick={() => { setOpen(false); onAction('rename', tpl); }}><span className="material-symbols-rounded">edit</span> {t('atp.change_name', null, 'Change name')}</button>
              <button type="button" onClick={() => { setOpen(false); onAction('preview', tpl); }}><span className="material-symbols-rounded">search</span> {t('atp.preview', null, 'Preview')}</button>
              <button type="button" onClick={() => { setOpen(false); onAction('thumbnail', tpl); }}><span className="material-symbols-rounded">image</span> {t('atp.change_thumbnail', null, 'Change thumbnail')}</button>
              {tpl.image && <button type="button" onClick={() => { setOpen(false); onAction('remove_thumbnail', tpl); }}><span className="material-symbols-rounded">hide_image</span> {t('atp.remove_thumbnail', null, 'Remove thumbnail')}</button>}
              <button type="button" onClick={() => { setOpen(false); onAction('categories', tpl); }}><span className="material-symbols-rounded">category</span> {t('atp.categories', null, 'Categories')}</button>
              <button type="button" onClick={() => { setOpen(false); onAction('export', tpl); }}><span className="material-symbols-rounded">download</span> {t('atp.export', null, 'Export')}</button>
              <button type="button" onClick={() => { setOpen(false); onAction('copy', tpl); }}><span className="material-symbols-rounded">content_copy</span> {t('atp.copy', null, 'Copy')}</button>
              <button type="button" onClick={() => { setOpen(false); onAction('delete', tpl); }}><span className="material-symbols-rounded">delete_outline</span> {t('common.delete', null, 'Delete')}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const TemplateGalleryPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const uploadRef = useRef(null);
  const thumbRef = useRef(null);
  const [rows, setRows] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('created_at');
  const [dir, setDir] = useState('desc');
  const [category, setCategory] = useState('all');
  const [keyword, setKeyword] = useState('');
  const [view, setView] = useState('grid');
  const [page, setPage] = useState(1);
  const [catModal, setCatModal] = useState(null);
  const [preview, setPreview] = useState(null);
  const thumbTarget = useRef(null);

  const load = () => Promise.all([adminApi.templateGallery(), adminApi.templateGalleryCategories()])
    .then(([tpls, cats]) => { setRows(tpls.data.data || []); setCategories(cats.data.data || []); })
    .catch(() => toast.error(t('atp.failed_load_templates', null, 'Failed to load templates.')))
    .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let v = rows;
    if (category !== 'all') v = v.filter((t) => t.category === category);
    const kw = keyword.trim().toLowerCase();
    if (kw) v = v.filter((t) => t.name.toLowerCase().includes(kw));
    v = [...v].sort((a, b) => {
      const av = sort === 'name' ? a.name : (a.created_at || '');
      const bv = sort === 'name' ? b.name : (b.created_at || '');
      const cmp = String(av).localeCompare(String(bv));
      return dir === 'desc' ? -cmp : cmp;
    });
    return v;
  }, [rows, category, keyword, sort, dir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const pageRows = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const onAction = async (action, tpl) => {
    if (action === 'rename') {
      const name = window.prompt(t('atp.template_name', null, 'Template name'), tpl.name);
      if (name && name.trim()) { await adminApi.updateTemplateGallery(tpl.uid, { name: name.trim() }); load(); toast.success(t('atp.renamed', null, 'Renamed.')); }
    } else if (action === 'preview') {
      const { data } = await adminApi.templateGalleryDetail(tpl.uid);
      setPreview({ name: tpl.name, content: data.content || '' });
    } else if (action === 'thumbnail') {
      thumbTarget.current = tpl; thumbRef.current?.click();
    } else if (action === 'remove_thumbnail') {
      if (window.confirm(t('atp.remove_thumbnail_confirm', null, 'Remove this thumbnail?'))) {
        await adminApi.updateTemplateGallery(tpl.uid, { image: null }); load(); toast.success(t('atp.thumbnail_removed', null, 'Thumbnail removed.'));
      }
    } else if (action === 'categories') {
      setCatModal({ tpl, selected: new Set(tpl.category_ids || []) });
    } else if (action === 'export') {
      const { data } = await adminApi.templateGalleryDetail(tpl.uid);
      const blob = new Blob([data.content || ''], { type: 'text/html' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = `${tpl.name}.html`; a.click();
    } else if (action === 'copy') {
      await adminApi.copyTemplateGallery(tpl.uid); load(); toast.success(t('atp.copied', null, 'Copied.'));
    } else if (action === 'delete') {
      if (window.confirm(t('atp.delete_confirm', { name: tpl.name }, 'Delete "{name}"?'))) { await adminApi.deleteTemplateGallery(tpl.uid); load(); toast.success(t('atp.deleted', null, 'Deleted.')); }
    }
  };

  const onThumbFile = async (e) => {
    const file = e.target.files?.[0]; const tpl = thumbTarget.current;
    if (file && tpl) {
      // Upload the file and store its short URL — the image column is VARCHAR(255)
      // and cannot hold a base64 data URL (it would be rejected/truncated).
      try {
        const { data } = await adminApi.uploadSettingImage(file);
        await adminApi.updateTemplateGallery(tpl.uid, { image: data.url });
        load(); toast.success(t('atp.thumbnail_updated', null, 'Thumbnail updated.'));
      } catch (err) {
        toast.error(err.response?.data?.message || t('atp.thumbnail_failed', null, 'Failed to update thumbnail.'));
      }
    }
    e.target.value = '';
  };

  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const content = await file.text();
      await adminApi.createTemplateGallery({ name: file.name.replace(/\.[^.]+$/, ''), content });
      load(); toast.success(t('atp.template_uploaded', null, 'Template uploaded.'));
    }
    e.target.value = '';
  };

  const saveCategories = async () => {
    await adminApi.updateTemplateGallery(catModal.tpl.uid, { category_ids: [...catModal.selected] });
    setCatModal(null); load(); toast.success(t('atp.categories_updated', null, 'Categories updated.'));
  };

  return (
    <AppLayout>
      <div className="admin-page">
        <header className="admin-header">
          <nav><button type="button" onClick={() => navigate('/dashboard')}>{t('atp.home', null, 'Home')}</button></nav>
          <h1><span className="material-symbols-rounded">grid_view</span>{t('atp.templates', null, 'Templates')}</h1>
        </header>

        <section className="admin-content">
          <p className="set-intro">{t('atp.tg_intro_1', null, 'Below are BASE templates available for all users registered in the applicaiton')}<br />{t('atp.tg_intro_2', null, 'When it comes to compose an email, users can upload or create a new email template from a base one')}</p>

          <div className="admin-filter-bar tg-bar">
            <select className="input" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="created_at">{t('atp.created_at', null, 'Created at')}</option><option value="name">{t('common.name', null, 'Name')}</option>
            </select>
            <button type="button" className="btn-secondary admin-icon-btn" onClick={() => setDir((d) => (d === 'desc' ? 'asc' : 'desc'))}><span className="material-symbols-rounded">sort</span></button>
            <select className="input" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}>
              <option value="all">{t('atp.all_categories', null, 'All categories')}</option>
              {[...new Set(rows.map((r) => r.category))].filter(Boolean).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <div className="admin-filter-search"><input className="input" placeholder={t('atp.type_to_search', null, 'Type to search')} value={keyword} onChange={(e) => { setKeyword(e.target.value); setPage(1); }} /><span className="material-symbols-rounded">search</span></div>
            <div className="tg-spacer" />
            <div className="tg-view">
              <button type="button" className={view === 'grid' ? 'is-active' : ''} onClick={() => setView('grid')}><span className="material-symbols-rounded">grid_view</span></button>
              <button type="button" className={view === 'list' ? 'is-active' : ''} onClick={() => setView('list')}><span className="material-symbols-rounded">view_list</span></button>
            </div>
            <button type="button" className="btn-secondary" onClick={() => uploadRef.current?.click()}><span className="material-symbols-rounded">upload</span> {t('atp.upload', null, 'Upload')}</button>
            <button type="button" className="btn-secondary" onClick={() => navigate('/admin/template-gallery/new')}><span className="material-symbols-rounded">add</span> {t('common.create', null, 'Create')}</button>
            <input ref={uploadRef} type="file" accept=".html,.htm" hidden onChange={onUpload} />
            <input ref={thumbRef} type="file" accept="image/*" hidden onChange={onThumbFile} />
          </div>

          {loading ? <div className="admin-empty"><Spinner size="lg" /></div> : (
            <>
              <div className={view === 'grid' ? 'tg-grid' : 'tg-list-view'}>
                {pageRows.map((t) => <TemplateCard key={t.uid} tpl={t} navigate={navigate} onAction={onAction} />)}
              </div>
              <div className="admin-cur-footer tg-footer">
                <span>{t('atp.items_per_page', { count: PER_PAGE }, '{count} items per page')}</span><span className="admin-cur-footer-sep">|</span>
                <span>{t('atp.records_range', { from: filtered.length ? (page - 1) * PER_PAGE + 1 : 0, to: Math.min(page * PER_PAGE, filtered.length), total: filtered.length }, 'From {from} to {to}. Total {total} records')}</span>
                <div className="tg-pager">
                  <span>{t('atp.page_of', { page, total: totalPages }, 'Page {page} of {total}')}</span>
                  <button type="button" className="tg-page-link" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>{t('atp.previous', null, 'Previous')}</button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                    <button key={n} type="button" className={`tg-page-num ${n === page ? 'is-active' : ''}`} onClick={() => setPage(n)}>{n}</button>
                  ))}
                  <button type="button" className="tg-page-link" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>{t('atp.next', null, 'Next')}</button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      {catModal && (
        <div className="tax-modal-overlay" onClick={() => setCatModal(null)}>
          <div className="tax-modal sa-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sa-modal-head"><h3>{t('atp.categories', null, 'Categories')} — {catModal.tpl.name}</h3><button type="button" onClick={() => setCatModal(null)}>✕</button></div>
            <div className="sa-modal-body">
              {categories.length === 0 ? <p className="set-muted">{t('atp.no_categories_defined', null, 'No categories defined.')}</p> : categories.map((c) => (
                <label key={c.id} className="tg-cat-check">
                  <input type="checkbox" checked={catModal.selected.has(c.id)} onChange={(e) => {
                    const next = new Set(catModal.selected);
                    if (e.target.checked) next.add(c.id); else next.delete(c.id);
                    setCatModal({ ...catModal, selected: next });
                  }} /> {c.name}
                </label>
              ))}
            </div>
            <div className="sa-modal-foot">
              <button type="button" className="btn-secondary" onClick={() => setCatModal(null)}>{t('common.cancel', null, 'Cancel')}</button>
              <button type="button" className="btn-secondary wp-create-btn" onClick={saveCategories}>{t('common.save', null, 'Save')}</button>
            </div>
          </div>
        </div>
      )}

      {preview && (
        <div className="template-modal-backdrop" onMouseDown={() => setPreview(null)}>
          <div className="template-modal" style={{ maxWidth: 860, width: '90vw' }} onMouseDown={(e) => e.stopPropagation()}>
            <div className="template-modal-head">
              <h2><span className="material-symbols-rounded">search</span> {preview.name}</h2>
              <button type="button" onClick={() => setPreview(null)} aria-label="Close">✕</button>
            </div>
            {preview.content ? (
              <iframe
                srcDoc={preview.content}
                title={t('atp.preview', null, 'Preview')}
                sandbox="allow-same-origin"
                style={{ width: '100%', height: 500, border: 'none', borderRadius: 6, background: '#fff' }}
              />
            ) : (
              <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-muted)' }}>{t('atp.no_content', null, 'This template has no content yet.')}</p>
            )}
            <div className="template-modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setPreview(null)}>{t('atp.close', null, 'Close')}</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
};

export default TemplateGalleryPage;
