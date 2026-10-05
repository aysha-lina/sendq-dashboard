import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import grapesjs from 'grapesjs';
import presetNewsletter from 'grapesjs-preset-newsletter';
import customCode from 'grapesjs-custom-code';
import styleBg from 'grapesjs-style-bg';
import 'grapesjs/dist/css/grapes.min.css';
import { adminApi } from '../../api/services';
import { Spinner, toast } from '../../components/ui';
import { useTranslation } from '../../i18n';
import { registerCodeEditor } from '../templates/grapesCodeEditor';
import '../templates/templateBuilder.css';

const MaterialIcon = ({ name }) => <span className="material-symbols-rounded">{name}</span>;
const SendQLogo = () => <img className="tb-logo" src="/assets/3.png" alt="SendQ" />;

const exportHtml = (editor) => {
  try { const inlined = editor.runCommand('gjs-get-inlined-html'); if (inlined) return inlined; } catch { /* noop */ }
  return `${editor.getHtml()}<style>${editor.getCss()}</style>`;
};

const TemplateGalleryDesignPage = () => {
  const { t } = useTranslation();
  const { uid } = useParams();
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const editorRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let editor; let cancelled = false;
    adminApi.templateGalleryDetail(uid)
      .then(({ data }) => {
        if (cancelled) return;
        setName(data.name || t('atp.template', null, 'Template'));
        editor = grapesjs.init({
          container: containerRef.current, height: '100%', width: 'auto', fromElement: false,
          storageManager: false, assetManager: { upload: false, dropzone: false },
          plugins: [presetNewsletter, (ed) => customCode(ed, {}), (ed) => styleBg(ed, {})],
        });
        registerCodeEditor(editor, { applyLabel: t('atp.save_apply', null, 'Save & apply'), title: t('atp.edit_code', null, 'Edit code') });
        editor.setComponents(data.content || '');
        editorRef.current = editor;
        setLoading(false);
      })
      .catch(() => { toast.error(t('atp.failed_load_template', null, 'Failed to load template.')); navigate('/admin/template-gallery'); });
    return () => { cancelled = true; try { editor?.destroy(); } catch { /* noop */ } editorRef.current = null; };
  }, [uid, navigate]);

  const runSave = async () => {
    const editor = editorRef.current; if (!editor) return false;
    setSaving(true);
    try { await adminApi.updateTemplateGallery(uid, { name, content: exportHtml(editor) }); return true; }
    catch (err) { toast.error(err.response?.data?.message || t('atp.save_failed', null, 'Save failed')); return false; }
    finally { setSaving(false); }
  };

  return (
    <div className="tb-page">
      <header className="tb-topbar">
        <div className="tb-topbar-left"><SendQLogo /><span className="tb-name" title={name}>{name}</span></div>
        <div className="tb-topbar-center">
          <button type="button" className="tb-icon-btn" onClick={() => editorRef.current?.runCommand('core:undo')} title={t('atp.undo', null, 'Undo')}><MaterialIcon name="undo" /></button>
          <button type="button" className="tb-icon-btn" onClick={() => editorRef.current?.runCommand('core:redo')} title={t('atp.redo', null, 'Redo')}><MaterialIcon name="redo" /></button>
          <span className="tb-divider" />
          <button type="button" className="tb-icon-btn" onClick={() => editorRef.current?.runCommand('preview')} title={t('atp.preview', null, 'Preview')}><MaterialIcon name="visibility" /></button>
          <button type="button" className="tb-icon-btn" onClick={() => editorRef.current?.runCommand('tb-edit-code')} title={t('atp.edit_code', null, 'Edit code')}><MaterialIcon name="code" /></button>
        </div>
        <div className="tb-topbar-right">
          <button type="button" className="btn-primary tb-save" onClick={runSave} disabled={saving || loading}>{saving ? <Spinner size="sm" /> : <MaterialIcon name="save" />} {t('common.save', null, 'Save')}</button>
          <button type="button" className="tb-saveclose" onClick={async () => { if (await runSave()) navigate('/admin/template-gallery'); }} disabled={saving || loading}>{t('atp.save_and_close', null, 'Save & Close')}</button>
          <button type="button" className="tb-close" onClick={() => navigate('/admin/template-gallery')} aria-label="Close">✕</button>
        </div>
      </header>
      {loading && <div className="tb-loading"><Spinner size="lg" /></div>}
      <div className="tb-editor-wrap" style={loading ? { visibility: 'hidden' } : undefined}><div ref={containerRef} className="tb-editor" /></div>
    </div>
  );
};

export default TemplateGalleryDesignPage;
