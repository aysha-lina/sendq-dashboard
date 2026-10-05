import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { templatesApi } from '../../api/services';
import { Spinner } from '../../components/ui';
import useClickOutside from '../../hooks/useClickOutside';

const MaterialIcon = ({ name, className = '' }) => (
  <span className={`material-symbols-rounded ${className}`}>{name}</span>
);

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toISOString().slice(0, 16).replace('T', ' ');
};

const TemplateThumb = ({ src, name, onClick }) => (
  <button
    type="button"
    className="template-thumb"
    onClick={onClick}
    aria-label={`Preview ${name || 'template'}`}
  >
    {src ? (
      <img src={src} alt="" />
    ) : (
      <span className="template-thumb-placeholder">
        <i />
        <b />
      </span>
    )}
  </button>
);

const EmptyTemplates = ({ keyword }) => (
  <div className="template-empty-list">
    <MaterialIcon name="auto_awesome_mosaic" />
    <span>{keyword ? 'No search result' : 'There are no templates yet'}</span>
  </div>
);

const TemplateActionMenu = ({ onAction }) => {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  useClickOutside(menuRef, () => setOpen(false), open);
  const actions = [
    ['badge', 'Change name'],
    ['zoom_in', 'Preview'],
    ['image', 'Change thumbnail'],
    ['category', 'Categories'],
    ['download', 'Export'],
    ['copy_all', 'Copy'],
    ['delete_outline', 'Delete'],
  ];

  return (
    <div ref={menuRef} className="template-row-menu">
      <button type="button" className="template-caret-button" onClick={() => setOpen((c) => !c)} aria-label="Template actions">
        ⌄
      </button>
      {open && (
        <div className="template-dropdown-menu">
          {actions.map(([icon, label]) => (
            <button
              key={label}
              type="button"
              onClick={() => { setOpen(false); onAction(label); }}
            >
              <MaterialIcon name={icon} />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Preview modal ────────────────────────────────────────────────────────────
const PreviewModal = ({ template, onClose }) => {
  if (!template) return null;
  return (
    <div className="template-modal-backdrop" onMouseDown={onClose}>
      <div
        className="template-modal"
        style={{ maxWidth: 860, width: '90vw' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="template-modal-head">
          <h2><MaterialIcon name="zoom_in" /> {template.name}</h2>
          <button type="button" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {template.content ? (
          <iframe
            srcDoc={template.content}
            title="Template preview"
            sandbox="allow-same-origin"
            style={{ width: '100%', height: 500, border: 'none', borderRadius: 6, background: '#fff' }}
          />
        ) : (
          <p style={{ color: 'var(--color-muted)', padding: '2rem', textAlign: 'center' }}>
            This template has no HTML content yet.
          </p>
        )}
        <div className="template-modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

// ─── Upload modal ─────────────────────────────────────────────────────────────
const UploadTemplateModal = ({ open, onClose, onSaved }) => {
  const fileRef = useRef(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const reset = () => { setName(''); setSaving(false); setError(''); if (fileRef.current) fileRef.current.value = ''; };

  const handleClose = () => { reset(); onClose(); };

  const handleUpload = async () => {
    if (!name.trim()) { setError('Template name is required.'); return; }
    const file = fileRef.current?.files?.[0];
    if (!file) { setError('Please select an HTML file.'); return; }

    setError('');
    setSaving(true);
    try {
      const content = await file.text();
      await templatesApi.create({ name: name.trim(), content });
      reset();
      onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Upload failed.');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="template-modal-backdrop" onMouseDown={handleClose}>
      <div className="template-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="template-modal-head">
          <h2><MaterialIcon name="file_upload" /> Upload template</h2>
          <button type="button" onClick={handleClose} aria-label="Close">✕</button>
        </div>
        {error && <div className="template-alert" style={{ color: '#e53e3e', borderColor: '#e53e3e' }}>{error}</div>}
        <label>
          <span>Template name <em>*</em></span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="My template" />
        </label>
        <label>
          <span>HTML file <em>*</em></span>
          <input ref={fileRef} className="input" type="file" accept=".html,.htm" />
        </label>
        <div className="template-modal-actions">
          <button type="button" className="btn-primary" onClick={handleUpload} disabled={saving}>
            {saving ? <Spinner size="sm" /> : <MaterialIcon name="check" />}
            {saving ? 'Uploading…' : 'Upload'}
          </button>
          <button type="button" className="btn-secondary" onClick={handleClose} disabled={saving}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

// ─── Create modal ─────────────────────────────────────────────────────────────
const CreateTemplateModal = ({ open, onClose, onSaved }) => {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const reset = () => { setName(''); setSaving(false); setError(''); };
  const handleClose = () => { reset(); onClose(); };

  const handleCreate = async () => {
    if (!name.trim()) { setError('Template name is required.'); return; }
    setError('');
    setSaving(true);
    try {
      await templatesApi.create({ name: name.trim(), content: '' });
      reset();
      onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Create failed.');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="template-modal-backdrop" onMouseDown={handleClose}>
      <div className="template-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="template-modal-head">
          <h2><MaterialIcon name="add" /> Create template</h2>
          <button type="button" onClick={handleClose} aria-label="Close">✕</button>
        </div>
        {error && <div className="template-alert" style={{ color: '#e53e3e', borderColor: '#e53e3e' }}>{error}</div>}
        <label>
          <span>Template name <em>*</em></span>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="My newsletter template"
            autoFocus
          />
        </label>
        <div className="template-modal-actions">
          <button type="button" className="btn-primary" onClick={handleCreate} disabled={saving}>
            {saving ? <Spinner size="sm" /> : null}
            {saving ? 'Creating…' : 'Create'}
          </button>
          <button type="button" className="btn-secondary" onClick={handleClose} disabled={saving}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

// ─── Change name modal ──────────────────────────────────────────────────────────
const RenameModal = ({ template, onClose, onSaved }) => {
  const [name, setName] = useState(template?.name || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (!name.trim()) { setError('Template name is required.'); return; }
    setSaving(true); setError('');
    try {
      await templatesApi.update(template.uid, { name: name.trim() });
      onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not rename template.');
      setSaving(false);
    }
  };

  return (
    <div className="template-modal-backdrop" onMouseDown={onClose}>
      <div className="template-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="template-modal-head">
          <h2><MaterialIcon name="badge" /> Change name</h2>
          <button type="button" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {error && <div className="template-alert" style={{ color: '#e53e3e', borderColor: '#e53e3e' }}>{error}</div>}
        <label>
          <span>Template name <em>*</em></span>
          <input
            className="input"
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
          />
        </label>
        <div className="template-modal-actions">
          <button type="button" className="btn-primary" onClick={save} disabled={saving}>
            {saving ? <Spinner size="sm" /> : <MaterialIcon name="check" />}
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

// ─── Change thumbnail modal ─────────────────────────────────────────────────────
const ThumbnailModal = ({ template, onClose, onSaved }) => {
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [url, setUrl] = useState('');
  const [preview, setPreview] = useState(template?.image || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const onPick = (e) => {
    const picked = e.target.files?.[0];
    if (!picked) return;
    if (!picked.type.startsWith('image/')) { setError('Please choose an image file.'); return; }
    setError('');
    setFile(picked);
    setUrl('');
    setPreview(URL.createObjectURL(picked));
  };

  const onUrl = (e) => {
    const v = e.target.value;
    setUrl(v);
    setFile(null);
    setPreview(v);
  };

  const save = async () => {
    setSaving(true); setError('');
    try {
      if (url.trim()) {
        await templatesApi.update(template.uid, { image: url.trim() });
      } else if (file) {
        await templatesApi.uploadThumbnail(template.uid, file);
      } else {
        setError('Choose an image file or paste an image URL.');
        setSaving(false);
        return;
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update thumbnail.');
      setSaving(false);
    }
  };

  return (
    <div className="template-modal-backdrop" onMouseDown={onClose}>
      <div className="template-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="template-modal-head">
          <h2><MaterialIcon name="image" /> Change thumbnail</h2>
          <button type="button" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {error && <div className="template-alert" style={{ color: '#e53e3e', borderColor: '#e53e3e' }}>{error}</div>}
        <div className="template-thumb-preview">
          {preview ? <img src={preview} alt="Thumbnail preview" /> : <span>No thumbnail yet</span>}
        </div>
        <label>
          <span>Choose image</span>
          <input ref={fileRef} className="input" type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={onPick} />
        </label>
        <label>
          <span>…or paste an image URL</span>
          <input className="input" type="url" placeholder="https://…/image.png" value={url} onChange={onUrl} />
        </label>
        <div className="template-modal-actions">
          <button type="button" className="btn-primary" onClick={save} disabled={saving}>
            {saving ? <Spinner size="sm" /> : <MaterialIcon name="check" />}
            {saving ? 'Uploading…' : 'Save'}
          </button>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

// ─── Categories modal (assign to a template + manage the category list) ─────────
const CategoryModal = ({ template, categories, onClose, onChanged }) => {
  const [selected, setSelected] = useState(() => new Set((template.categories || []).map((c) => c.id)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggle = (id) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const save = async () => {
    setSaving(true); setError('');
    try {
      await templatesApi.update(template.uid, { category_ids: [...selected] });
      onChanged();
      onClose();
    } catch (err) { setError(err.response?.data?.message || 'Save failed.'); setSaving(false); }
  };

  return (
    <div className="template-modal-backdrop" onMouseDown={onClose}>
      <div className="template-modal template-category-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="template-modal-head template-modal-head-centered">
          <h2>{template.name || 'Template'}</h2>
          <button type="button" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="template-category-body">
          <h3>Set template category</h3>
          <p>Choose one or more categories for your template. Notice: if your template does not fall upon any category, it will not be visible to users.</p>

          {error && <div className="template-alert" style={{ color: '#e53e3e', borderColor: '#e53e3e' }}>{error}</div>}

          <div className="template-category-list">
            {categories.length === 0 && <p style={{ color: '#9a9aa8' }}>No categories available.</p>}
            {categories.map((cat) => (
              <label key={cat.id} className="template-category-item">
                <input type="checkbox" checked={selected.has(cat.id)} onChange={() => toggle(cat.id)} />
                <span>{cat.name}</span>
              </label>
            ))}
          </div>

          <div className="template-category-actions">
            <button type="button" className="btn-secondary" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────
const TemplatesPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [keyword, setKeyword] = useState('');
  const [sortOrder, setSortOrder] = useState('created_at');
  const [sortDirection, setSortDirection] = useState('desc');
  const [showUpload, setShowUpload] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [categoryTemplate, setCategoryTemplate] = useState(null);
  const [renameTemplate, setRenameTemplate] = useState(null);
  const [thumbnailTemplate, setThumbnailTemplate] = useState(null);

  const from = searchParams.get('from') === 'gallery' ? 'gallery' : 'mine';
  const view = searchParams.get('view') === 'grid' ? 'grid' : 'list';

  const loadCategories = useCallback(() => {
    templatesApi.categories()
      .then(({ data }) => setCategories(data.data || []))
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => { loadCategories(); }, [loadCategories]);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        per_page: 100,
        sort_order: sortOrder,
        sort_direction: sortDirection,
        shared: from === 'gallery' ? 'true' : 'false',
        ...(categoryFilter ? { category: categoryFilter } : {}),
      };
      const { data } = await templatesApi.list(params);
      setTemplates(data.data || []);
    } catch {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, [from, sortOrder, sortDirection, categoryFilter]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const filteredTemplates = useMemo(() => {
    if (!keyword) return templates;
    return templates.filter((t) => t.name?.toLowerCase().includes(keyword.toLowerCase()));
  }, [keyword, templates]);

  const switchMode = (nextFrom, nextView = view) => {
    navigate(`/templates?from=${nextFrom}&view=${nextView}`);
  };

  const openPreview = async (template) => {
    if (template.content !== undefined) { setPreviewTemplate(template); return; }
    try {
      const { data } = await templatesApi.get(template.uid);
      setPreviewTemplate(data);
    } catch {
      setPreviewTemplate(template);
    }
  };

  const exportTemplate = (template) => {
    const blob = new Blob([template.content || ''], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${template.name.replace(/[^a-z0-9]/gi, '_')}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onTemplateAction = async (label, template) => {
    if (label === 'Change name') { setRenameTemplate(template); return; }
    if (label === 'Preview') { openPreview(template); return; }
    if (label === 'Change thumbnail') { setThumbnailTemplate(template); return; }
    if (label === 'Categories') { setCategoryTemplate(template); return; }

    if (label === 'Export') {
      if (template.content === undefined) {
        const { data } = await templatesApi.get(template.uid);
        exportTemplate(data);
      } else {
        exportTemplate(template);
      }
      return;
    }

    if (label === 'Copy') {
      await templatesApi.copy(template.uid);
      fetchTemplates();
      return;
    }

    if (label === 'Delete') {
      if (!window.confirm(`Delete template "${template.name}"?`)) return;
      await templatesApi.delete(template.uid);
      fetchTemplates();
    }
  };

  return (
    <AppLayout>
      <div className={`templates-page view-${view}`}>
        <header className="templates-page-title">
          <nav>Home</nav>
          <div className="templates-title-row">
            <h1>
              <MaterialIcon name="format_list_bulleted" />
              Templates
            </h1>
            <div className="templates-source-toggle">
              <button
                type="button"
                className={from === 'mine' ? 'active' : ''}
                onClick={() => switchMode('mine', 'list')}
              >
                <MaterialIcon name="portrait" /> My templates
              </button>
              <button
                type="button"
                className={from === 'gallery' ? 'active' : ''}
                onClick={() => switchMode('gallery', 'grid')}
              >
                <MaterialIcon name="collections" /> Base Template Gallery
              </button>
            </div>
          </div>
        </header>

        <section className="templates-listing-form">
          <div className="templates-top-controls">
            <div className="templates-filter-box">
              {view === 'list' && (
                <label className="templates-checkbox">
                  <input type="checkbox" />
                </label>
              )}
              <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
                <option value="created_at">Created at</option>
                <option value="name">Name</option>
              </select>
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} title="Filter by category">
                <option value="">All categories</option>
                {categories.map((c) => <option key={c.uid} value={c.uid}>{c.name}</option>)}
              </select>
              <button
                type="button"
                className="templates-sort-button"
                onClick={() => setSortDirection((c) => (c === 'desc' ? 'asc' : 'desc'))}
                title="Change sort direction"
              >
                <MaterialIcon name="sort" />
              </button>
              <div className="templates-search">
                <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Type to search" />
                <MaterialIcon name="search" />
              </div>
            </div>

            <div className="templates-right-controls">
              <div className="templates-view-toggle">
                <button
                  type="button"
                  className={view === 'grid' ? 'active' : ''}
                  onClick={() => switchMode(from, 'grid')}
                  title="Grid view"
                >
                  <MaterialIcon name="grid_view" />
                </button>
                <button
                  type="button"
                  className={view === 'list' ? 'active' : ''}
                  onClick={() => switchMode(from, 'list')}
                  title="List view"
                >
                  <MaterialIcon name="reorder" />
                </button>
              </div>
              {from === 'mine' && (
                <>
                  <button type="button" className="btn-secondary templates-action-button" onClick={() => setShowUpload(true)}>
                    <MaterialIcon name="file_upload" /> Upload
                  </button>
                  <button type="button" className="btn-primary templates-action-button" onClick={() => navigate('/templates/new')}>
                    <MaterialIcon name="add" /> Create
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="templates-content">
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                <Spinner size="lg" />
              </div>
            ) : filteredTemplates.length === 0 ? (
              <EmptyTemplates keyword={keyword} />
            ) : view === 'grid' ? (
              <div className="templates-grid">
                {filteredTemplates.map((template) => (
                  <article key={template.uid || template.id} className="template-card">
                    <div className="template-card-image">
                      <TemplateThumb src={template.image} name={template.name} onClick={() => openPreview(template)} />
                      <div className="template-card-overlay">
                        <button type="button" className="btn-primary" onClick={() => openPreview(template)}>
                          <MaterialIcon name="zoom_in" /> Preview
                        </button>
                        {from === 'mine' && (
                          <button type="button" className="templates-pro-builder" onClick={() => navigate(`/templates/${template.uid}/builder`)}>
                            PRO builder
                          </button>
                        )}
                        {from === 'gallery' && (
                          <button type="button" className="btn-secondary" onClick={async () => { await templatesApi.copy(template.uid); switchMode('mine'); }}>
                            <MaterialIcon name="copy_all" /> Use template
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="template-card-body">
                      <h2>{template.name || '-'}</h2>
                      <p>{formatDate(template.created_at)}</p>
                      {from === 'mine' && <TemplateActionMenu onAction={(label) => onTemplateAction(label, template)} />}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <table className="templates-table">
                <tbody>
                  {filteredTemplates.map((template) => (
                    <tr key={template.uid || template.id}>
                      <td className="templates-check-cell">
                        <label className="templates-checkbox"><input type="checkbox" /></label>
                      </td>
                      <td className="templates-thumb-cell">
                        <TemplateThumb src={template.image} name={template.name} onClick={() => openPreview(template)} />
                      </td>
                      <td className="templates-name-cell">
                        <button
                          type="button"
                          className="templates-title-link"
                          onClick={() => from === 'mine' ? navigate(`/templates/${template.uid}/builder`) : openPreview(template)}
                        >
                          {template.name || '-'}
                        </button>
                        <span className="templates-muted">Updated at: {formatDate(template.updated_at || template.created_at)}</span>
                      </td>
                      <td className="templates-actions-cell">
                        <div className="templates-actions">
                          <button type="button" className="btn-primary" onClick={() => openPreview(template)}>
                            <MaterialIcon name="zoom_in" /> Preview
                          </button>
                          {from === 'mine' && (
                            <button type="button" className="templates-pro-builder" onClick={() => navigate(`/templates/${template.uid}/builder`)}>
                              PRO builder
                            </button>
                          )}
                          {from === 'mine' && <TemplateActionMenu onAction={(label) => onTemplateAction(label, template)} />}
                          {from === 'gallery' && (
                            <button type="button" className="btn-secondary" onClick={async () => { await templatesApi.copy(template.uid); switchMode('mine'); }}>
                              <MaterialIcon name="copy_all" /> Use template
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>

      <UploadTemplateModal open={showUpload} onClose={() => setShowUpload(false)} onSaved={fetchTemplates} />
      <CreateTemplateModal open={showCreate} onClose={() => setShowCreate(false)} onSaved={fetchTemplates} />
      <PreviewModal template={previewTemplate} onClose={() => setPreviewTemplate(null)} />
      {renameTemplate && (
        <RenameModal
          template={renameTemplate}
          onClose={() => setRenameTemplate(null)}
          onSaved={fetchTemplates}
        />
      )}
      {thumbnailTemplate && (
        <ThumbnailModal
          template={thumbnailTemplate}
          onClose={() => setThumbnailTemplate(null)}
          onSaved={fetchTemplates}
        />
      )}
      {categoryTemplate && (
        <CategoryModal
          template={categoryTemplate}
          categories={categories}
          onClose={() => setCategoryTemplate(null)}
          onChanged={() => { loadCategories(); fetchTemplates(); }}
        />
      )}
    </AppLayout>
  );
};

export default TemplatesPage;
