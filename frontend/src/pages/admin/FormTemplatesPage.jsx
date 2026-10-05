import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { adminApi } from '../../api/services';
import { Spinner, toast } from '../../components/ui';
import useClickOutside from '../../hooks/useClickOutside';
import { useTranslation } from '../../i18n';

const readFile = (file) => new Promise((resolve) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.readAsDataURL(file);
});

const FormCard = ({ tpl, onAction }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState(null);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false), open);

  useEffect(() => {
    if (tpl.image) return;
    adminApi.formTemplateDetail(tpl.uid).then(({ data }) => setContent(data.content || '')).catch(() => {});
  }, [tpl.uid, tpl.image]);

  return (
    <div className="ft-card">
      <div className="ft-preview">
        {tpl.image
          ? <img src={tpl.image} alt="" />
          : content !== null
            ? <iframe title={tpl.name} srcDoc={content} className="ft-frame" scrolling="no" />
            : <div className="tg-thumb-ph"><span className="material-symbols-rounded">dynamic_form</span></div>}
        <div className="ft-overlay">
          <button type="button" className="ft-ov-preview" onClick={() => onAction('preview', tpl)}><span className="material-symbols-rounded">search</span> {t('atp.preview', null, 'Preview')}</button>
          <button type="button" className="ft-ov-builder" onClick={() => onAction('builder', tpl)}>{t('atp.pro_builder', null, 'PRO builder')}</button>
        </div>
      </div>
      <div className="ft-card-body">
        <strong className="tg-card-cat" title={tpl.name}>{tpl.name}</strong>
        <div ref={ref} className="admin-dd tg-actions">
          <button type="button" className="btn-secondary" onClick={() => setOpen((v) => !v)}>{t('common.actions', null, 'Actions')} <span className="admin-caret">⌄</span></button>
          {open && (
            <div className="admin-dd-menu admin-dd-menu-end admin-dd-menu-up">
              <button type="button" onClick={() => { setOpen(false); onAction('rename', tpl); }}><span className="material-symbols-rounded">edit</span> {t('atp.change_name', null, 'Change name')}</button>
              <button type="button" onClick={() => { setOpen(false); onAction('preview', tpl); }}><span className="material-symbols-rounded">search</span> {t('atp.preview', null, 'Preview')}</button>
              <button type="button" onClick={() => { setOpen(false); onAction('thumbnail', tpl); }}><span className="material-symbols-rounded">image</span> {t('atp.change_thumbnail', null, 'Change thumbnail')}</button>
              <button type="button" onClick={() => { setOpen(false); onAction('copy', tpl); }}><span className="material-symbols-rounded">content_copy</span> {t('atp.copy', null, 'Copy')}</button>
              <button type="button" onClick={() => { setOpen(false); onAction('delete', tpl); }}><span className="material-symbols-rounded">delete_outline</span> {t('common.delete', null, 'Delete')}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const FormTemplatesPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('created_at');
  const [dir, setDir] = useState('desc');
  const [keyword, setKeyword] = useState('');

  // Action modals
  const [nameModal, setNameModal] = useState(null); // { tpl }
  const [nameVal, setNameVal] = useState('');
  const [previewModal, setPreviewModal] = useState(null); // { tpl, content }
  const [thumbModal, setThumbModal] = useState(null); // { tpl }
  const [thumbTab, setThumbTab] = useState('upload');
  const [thumbUrl, setThumbUrl] = useState('');
  const [copyModal, setCopyModal] = useState(null); // { tpl }
  const [copyVal, setCopyVal] = useState('');
  const [deleteModal, setDeleteModal] = useState(null); // { tpl }
  const [busy, setBusy] = useState(false);

  const load = () => adminApi.formTemplates()
    .then(({ data }) => setRows(data.data || []))
    .catch(() => toast.error(t('atp.failed_load_form_templates', null, 'Failed to load form templates.')))
    .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let v = rows;
    const kw = keyword.trim().toLowerCase();
    if (kw) v = v.filter((t) => t.name.toLowerCase().includes(kw));
    v = [...v].sort((a, b) => {
      const av = sort === 'name' ? a.name : (a.created_at || '');
      const bv = sort === 'name' ? b.name : (b.created_at || '');
      const cmp = String(av).localeCompare(String(bv));
      return dir === 'desc' ? -cmp : cmp;
    });
    return v;
  }, [rows, keyword, sort, dir]);

  const onAction = async (action, tpl) => {
    if (action === 'builder') {
      navigate(`/admin/form-templates/${tpl.uid}/builder`);
    } else if (action === 'rename') {
      setNameVal(tpl.name); setNameModal({ tpl });
    } else if (action === 'preview') {
      const { data } = await adminApi.formTemplateDetail(tpl.uid);
      setPreviewModal({ tpl, content: data.content || '' });
    } else if (action === 'thumbnail') {
      setThumbTab('upload'); setThumbUrl(''); setThumbModal({ tpl });
    } else if (action === 'copy') {
      setCopyVal(t('atp.copy_of', { name: tpl.name }, 'Copy of {name}')); setCopyModal({ tpl });
    } else if (action === 'delete') {
      setDeleteModal({ tpl });
    }
  };

  const saveCopy = async () => {
    if (!copyVal.trim()) { toast.error(t('atp.name_required', null, 'Name is required.')); return; }
    setBusy(true);
    try { await adminApi.copyFormTemplate(copyModal.tpl.uid, { name: copyVal.trim() }); setCopyModal(null); await load(); toast.success(t('atp.template_copied', null, 'Template copied.')); }
    catch (err) { toast.error(err.response?.data?.message || t('atp.copy_failed', null, 'Copy failed.')); } finally { setBusy(false); }
  };

  const confirmDelete = async () => {
    setBusy(true);
    try { await adminApi.deleteFormTemplate(deleteModal.tpl.uid); setDeleteModal(null); await load(); toast.success(t('atp.template_deleted', null, 'Template deleted.')); }
    catch (err) { toast.error(err.response?.data?.message || t('atp.delete_failed', null, 'Delete failed.')); } finally { setBusy(false); }
  };

  const saveName = async () => {
    if (!nameVal.trim()) { toast.error(t('atp.name_required', null, 'Name is required.')); return; }
    setBusy(true);
    try { await adminApi.updateFormTemplate(nameModal.tpl.uid, { name: nameVal.trim() }); setNameModal(null); await load(); toast.success(t('atp.name_changed', null, 'Name changed.')); }
    catch (err) { toast.error(err.response?.data?.message || t('atp.save_failed_dot', null, 'Save failed.')); } finally { setBusy(false); }
  };

  const saveThumbFile = async (file) => {
    if (!file) return;
    setBusy(true);
    try { await adminApi.updateFormTemplate(thumbModal.tpl.uid, { image: await readFile(file) }); setThumbModal(null); await load(); toast.success(t('atp.thumbnail_updated', null, 'Thumbnail updated.')); }
    catch (err) { toast.error(err.response?.data?.message || t('atp.upload_failed', null, 'Upload failed.')); } finally { setBusy(false); }
  };

  const saveThumbUrl = async () => {
    if (!thumbUrl.trim()) { toast.error(t('atp.enter_image_url', null, 'Enter an image URL.')); return; }
    setBusy(true);
    try { await adminApi.updateFormTemplate(thumbModal.tpl.uid, { image: thumbUrl.trim() }); setThumbModal(null); await load(); toast.success(t('atp.thumbnail_updated', null, 'Thumbnail updated.')); }
    catch (err) { toast.error(err.response?.data?.message || t('atp.save_failed_dot', null, 'Save failed.')); } finally { setBusy(false); }
  };

  return (
    <AppLayout>
      <div className="admin-page">
        <header className="admin-header">
          <nav><button type="button" onClick={() => navigate('/dashboard')}>{t('atp.home', null, 'Home')}</button></nav>
          <h1><span className="material-symbols-rounded">dynamic_form</span>{t('atp.form_templates', null, 'Form templates')}</h1>
        </header>

        <section className="admin-content">
          <p className="set-intro">{t('atp.ft_intro_1', null, 'Below are BASE form templates available for all users registered in the applicaiton')}<br />{t('atp.ft_intro_2', null, 'When it comes to add a form popup, users can create a new form popup from a base one')}</p>

          <div className="admin-filter-bar">
            <select className="input" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="created_at">{t('atp.created_at', null, 'Created at')}</option><option value="name">{t('common.name', null, 'Name')}</option>
            </select>
            <button type="button" className="btn-secondary admin-icon-btn" onClick={() => setDir((d) => (d === 'desc' ? 'asc' : 'desc'))}><span className="material-symbols-rounded">sort</span></button>
            <div className="admin-filter-search"><input className="input" placeholder={t('atp.type_to_search', null, 'Type to search')} value={keyword} onChange={(e) => setKeyword(e.target.value)} /><span className="material-symbols-rounded">search</span></div>
          </div>

          {loading ? <div className="admin-empty"><Spinner size="lg" /></div> : (
            filtered.length === 0
              ? <div className="hdl-empty"><span className="material-symbols-rounded">dynamic_form</span><p>{t('atp.no_form_templates', null, 'No form templates yet')}</p></div>
              : <div className="ft-grid">{filtered.map((t) => <FormCard key={t.uid} tpl={t} onAction={onAction} />)}</div>
          )}
        </section>
      </div>

      {/* Change name */}
      {nameModal && (
        <div className="tax-modal-overlay" onClick={() => setNameModal(null)}>
          <div className="tax-modal" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="tax-modal-close" onClick={() => setNameModal(null)} aria-label="Close">✕</button>
            <div className="tax-modal-body">
              <h2 className="ftm-title">{t('atp.change_name', null, 'Change name')}</h2>
              <label className="form-label fw-semibold">{t('atp.enter_new_template_name', null, 'Enter your new template name below')}</label>
              <input className="input ftm-input" value={nameVal} autoFocus onChange={(e) => setNameVal(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') saveName(); }} />
              <button type="button" className="btn-danger ftm-save" onClick={saveName} disabled={busy}>{busy ? t('atp.saving', null, 'Saving…') : t('common.save', null, 'Save')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Preview */}
      {previewModal && (
        <div className="ftm-preview-overlay" onClick={() => setPreviewModal(null)}>
          <button type="button" className="ftm-preview-close" onClick={() => setPreviewModal(null)} aria-label="Close">✕</button>
          <div className="ftm-preview-card" onClick={(e) => e.stopPropagation()}>
            <iframe title={previewModal.tpl.name} srcDoc={previewModal.content || '<p style="font-family:sans-serif;padding:40px">No content.</p>'} className="ftm-preview-frame" />
          </div>
        </div>
      )}

      {/* Change thumbnail */}
      {thumbModal && (
        <div className="tax-modal-overlay" onClick={() => setThumbModal(null)}>
          <div className="tax-modal" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="tax-modal-close" onClick={() => setThumbModal(null)} aria-label="Close">✕</button>
            <div className="tax-modal-body">
              <ul className="nav nav-tabs ftm-tabs">
                <li><button type="button" className={`ftm-tab ${thumbTab === 'upload' ? 'is-active' : ''}`} onClick={() => setThumbTab('upload')}>{t('atp.upload', null, 'Upload')}</button></li>
                <li><button type="button" className={`ftm-tab ${thumbTab === 'url' ? 'is-active' : ''}`} onClick={() => setThumbTab('url')}>{t('atp.url', null, 'Url')}</button></li>
              </ul>
              {thumbTab === 'upload' ? (
                <>
                  <h2 className="ftm-title">{t('atp.upload_thumbnail', null, 'Upload thumbnail')}</h2>
                  <p className="set-muted">{t('atp.upload_thumbnail_help', null, 'Upload image for template thumbnail when it shows in list or represent of using the template')}</p>
                  <label className="form-label fw-semibold">{t('atp.choose_file_upload', null, 'Choose a file to upload')}</label>
                  <input className="input ftm-input" type="file" accept="image/*" onChange={(e) => saveThumbFile(e.target.files?.[0])} />
                  <button type="button" className="btn-danger ftm-save" disabled={busy}>{busy ? t('atp.uploading', null, 'Uploading…') : t('atp.upload', null, 'Upload')}</button>
                </>
              ) : (
                <>
                  <h2 className="ftm-title">{t('atp.select_thumbnail_url', null, 'Select thumbnail url')}</h2>
                  <p className="set-muted">{t('atp.thumbnail_url_help', null, 'Enter image url below which will be used as template thumbnail')}</p>
                  <label className="form-label fw-semibold">{t('atp.image_url', null, 'Image URL')}</label>
                  <input className="input ftm-input" placeholder="https://…" value={thumbUrl} onChange={(e) => setThumbUrl(e.target.value)} />
                  <button type="button" className="btn-danger ftm-save" onClick={saveThumbUrl} disabled={busy}>{busy ? t('atp.saving', null, 'Saving…') : t('common.save', null, 'Save')}</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Copy */}
      {copyModal && (
        <div className="tax-modal-overlay" onClick={() => setCopyModal(null)}>
          <div className="tax-modal" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="tax-modal-close" onClick={() => setCopyModal(null)} aria-label="Close">✕</button>
            <div className="tax-modal-body">
              <h2 className="ftm-title">{copyModal.tpl.name}</h2>
              <label className="form-label fw-semibold">{t('atp.name_your_template', null, 'What would you like to name your template?')} <em style={{ color: '#ef4444' }}>*</em></label>
              <input className="input ftm-input" value={copyVal} autoFocus onChange={(e) => setCopyVal(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') saveCopy(); }} />
              <div className="ftm-actions-end">
                <button type="button" className="btn-secondary" onClick={saveCopy} disabled={busy}>{busy ? t('atp.copying', null, 'Copying…') : t('atp.copy', null, 'Copy')}</button>
                <button type="button" className="btn-secondary" onClick={() => setCopyModal(null)}>{t('atp.close', null, 'Close')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteModal && (
        <div className="tax-modal-overlay" onClick={() => setDeleteModal(null)}>
          <div className="tax-modal ftm-confirm" onClick={(e) => e.stopPropagation()}>
            <div className="ftm-confirm-head">
              <span className="ftm-confirm-title"><span className="material-symbols-rounded">help</span> {t('atp.are_you_sure', null, 'Are you sure?')}</span>
              <button type="button" className="tax-modal-close ftm-confirm-x" onClick={() => setDeleteModal(null)} aria-label="Close">✕</button>
            </div>
            <div className="ftm-confirm-body">
              <p>{t('atp.about_to_delete_templates', null, "You're about to delete 1 template(s).")}</p>
              <div className="ftm-confirm-actions">
                <button type="button" className="ftm-cancel-link" onClick={() => setDeleteModal(null)}>{t('common.cancel', null, 'Cancel')}</button>
                <button type="button" className="btn-secondary" onClick={confirmDelete} disabled={busy}>{busy ? t('atp.deleting', null, 'Deleting…') : t('atp.confirm', null, 'Confirm')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
};

export default FormTemplatesPage;
