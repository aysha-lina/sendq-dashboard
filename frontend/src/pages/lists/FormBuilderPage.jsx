import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import grapesjs from 'grapesjs';
import pluginForms from 'grapesjs-plugin-forms';
import customCode from 'grapesjs-custom-code';
import styleBg from 'grapesjs-style-bg';
import 'grapesjs/dist/css/grapes.min.css';
import { registerCodeEditor } from '../templates/grapesCodeEditor';
import { listsApi } from '../../api/services';
import { Spinner } from '../../components/ui';
import { useTranslation } from '../../i18n/index.jsx';
import { toBuilderHtml } from './formHtml';
import '../templates/templateBuilder.css';

const MaterialIcon = ({ name }) => <span className="material-symbols-rounded">{name}</span>;
const SendQLogo = () => <img className="tb-logo" src="/assets/3.png" alt="SendQ" />;

const exportHtml = (editor) => {
  const css = editor.getCss();
  const html = editor.getHtml();
  return css ? `${html}<style>${css}</style>` : html;
};

const EmbedModal = ({ formUid, onClose }) => {
  const { t } = useTranslation();
  const hostedUrl = `${window.location.origin}/forms/${formUid}`;
  const iframe = `<iframe src="${hostedUrl}" width="100%" height="520" frameborder="0"></iframe>`;
  const copy = (text) => navigator.clipboard?.writeText(text);
  return (
    <div className="admin-modal-backdrop" onClick={onClose}>
      <div className="admin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 620 }}>
        <div className="admin-modal-head"><h3>{t('frm.embed_share')}</h3><button type="button" onClick={onClose}>✕</button></div>
        <label className="admin-modal-field"><span>{t('frm.hosted_form_link')}</span>
          <input type="text" readOnly value={hostedUrl} onFocus={(e) => e.target.select()} />
        </label>
        <button type="button" className="btn-secondary" onClick={() => copy(hostedUrl)}>{t('frm.copy_link')}</button>
        <label className="admin-modal-field" style={{ marginTop: 16 }}><span>{t('frm.iframe_embed')}</span>
          <textarea readOnly rows={2} value={iframe} onFocus={(e) => e.target.select()} />
        </label>
        <button type="button" className="btn-secondary" onClick={() => copy(iframe)}>{t('frm.copy_iframe')}</button>
        <div className="admin-modal-actions"><button type="button" className="btn-primary" onClick={onClose}>{t('frm.done')}</button></div>
      </div>
    </div>
  );
};

const FormBuilderPage = () => {
  const { t } = useTranslation();
  const DEVICES = [
    { id: 'Mobile', icon: 'smartphone', label: t('frm.device_mobile') },
    { id: 'Tablet', icon: 'tablet', label: t('frm.device_tablet') },
    { id: 'Desktop', icon: 'desktop_windows', label: t('frm.device_desktop') },
  ];
  const { listUid, formUid } = useParams();
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const editorRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [device, setDevice] = useState('Desktop');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [error, setError] = useState('');
  const [showEmbed, setShowEmbed] = useState(false);

  useEffect(() => {
    let editor;
    let cancelled = false;

    listsApi.forms(listUid)
      .then(({ data }) => {
        if (cancelled) return;
        const found = (data.data || data || []).find((f) => f.uid === formUid);
        if (!found) { navigate('/lists/forms'); return; }
        setName(found.name || t('frm.untitled_form'));

        editor = grapesjs.init({
          container: containerRef.current,
          height: '100%',
          width: 'auto',
          fromElement: false,
          storageManager: false,
          assetManager: { upload: false, dropzone: false },
          plugins: [pluginForms, (ed) => customCode(ed, {}), (ed) => styleBg(ed, {})],
          pluginsOpts: { 'grapesjs-plugin-forms': {} },
        });
        registerCodeEditor(editor, { applyLabel: t('frm.save_apply', null, 'Save & apply'), title: t('frm.edit_code', null, 'Edit code') });

        // A couple of generic content blocks alongside the form blocks.
        editor.BlockManager.add('sq-heading', {
          label: t('frm.block_heading'), category: t('frm.block_basic'),
          content: `<h3 style="font-size:22px;margin:0 0 8px;">${t('frm.block_heading_content')}</h3>`,
        });
        editor.BlockManager.add('sq-text', {
          label: t('frm.block_text'), category: t('frm.block_basic'),
          content: `<p style="font-size:14px;margin:0 0 12px;">${t('frm.block_text_content')}</p>`,
        });

        editor.setComponents(toBuilderHtml(found.content));
        editorRef.current = editor;
        setLoading(false);
      })
      .catch(() => navigate('/lists/forms'));

    return () => {
      cancelled = true;
      try { editor?.destroy(); } catch { /* noop */ }
      editorRef.current = null;
    };
  }, [listUid, formUid, navigate]);

  const changeDevice = (id) => { setDevice(id); editorRef.current?.setDevice(id); };

  const runSave = async () => {
    const editor = editorRef.current;
    if (!editor) return false;
    setSaving(true); setError('');
    try {
      await listsApi.updateForm(listUid, formUid, { content: exportHtml(editor) });
      setSavedAt(new Date());
      return true;
    } catch (err) {
      setError(err.response?.data?.message || t('frm.save_failed'));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveAndClose = async () => { if (await runSave()) navigate('/lists/forms'); };
  const togglePreview = () => editorRef.current?.runCommand('preview');
  const openCode = () => editorRef.current?.runCommand('tb-edit-code');
  const undo = () => editorRef.current?.runCommand('core:undo');
  const redo = () => editorRef.current?.runCommand('core:redo');

  return (
    <div className="tb-page">
      <header className="tb-topbar">
        <div className="tb-topbar-left">
          <SendQLogo />
          <span className="tb-name" title={name}>{name}</span>
        </div>

        <div className="tb-topbar-center">
          <button type="button" className="tb-icon-btn" onClick={undo} title={t('frm.undo')}><MaterialIcon name="undo" /></button>
          <button type="button" className="tb-icon-btn" onClick={redo} title={t('frm.redo')}><MaterialIcon name="redo" /></button>
          <span className="tb-divider" />
          {DEVICES.map((d) => (
            <button key={d.id} type="button" className={`tb-icon-btn ${device === d.id ? 'is-active' : ''}`} onClick={() => changeDevice(d.id)} title={d.label}>
              <MaterialIcon name={d.icon} />
            </button>
          ))}
          <span className="tb-divider" />
          <button type="button" className="tb-icon-btn" onClick={togglePreview} title={t('frm.preview')}><MaterialIcon name="visibility" /></button>
          <button type="button" className="tb-icon-btn" onClick={openCode} title={t('frm.view_code')}><MaterialIcon name="code" /></button>
        </div>

        <div className="tb-topbar-right">
          {error && <span className="tb-save-msg tb-save-error">{error}</span>}
          {!error && savedAt && <span className="tb-save-msg">{t('frm.last_save_today')}</span>}
          <button type="button" className="tb-saveclose" onClick={() => setShowEmbed(true)} disabled={loading}>{t('frm.embed')}</button>
          <button type="button" className="btn-primary tb-save" onClick={runSave} disabled={saving || loading}>
            {saving ? <Spinner size="sm" /> : <MaterialIcon name="save" />} {t('common.save')}
          </button>
          <button type="button" className="tb-saveclose" onClick={saveAndClose} disabled={saving || loading}>{t('frm.save_and_close')}</button>
          <button type="button" className="tb-close" onClick={() => navigate('/lists/forms')} title={t('frm.close')} aria-label={t('frm.close')}>✕</button>
        </div>
      </header>

      {loading && <div className="tb-loading"><Spinner size="lg" /></div>}
      <div className="tb-editor-wrap" style={loading ? { visibility: 'hidden' } : undefined}>
        <div ref={containerRef} className="tb-editor" />
      </div>

      {showEmbed && <EmbedModal formUid={formUid} listUid={listUid} onClose={() => setShowEmbed(false)} />}
    </div>
  );
};

export default FormBuilderPage;
