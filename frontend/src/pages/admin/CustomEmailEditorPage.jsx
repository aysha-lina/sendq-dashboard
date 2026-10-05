import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import grapesjs from 'grapesjs';
import customCode from 'grapesjs-custom-code';
import styleBg from 'grapesjs-style-bg';
import 'grapesjs/dist/css/grapes.min.css';
import { adminApi } from '../../api/services';
import { Spinner, toast } from '../../components/ui';
import { useTranslation } from '../../i18n';
import { registerCodeEditor } from '../templates/grapesCodeEditor';
import '../templates/templateBuilder.css';
import './invoiceTemplate.css';

const MaterialIcon = ({ name }) => <span className="material-symbols-rounded">{name}</span>;
const SendQLogo = () => <img className="tb-logo" src="/assets/3.png" alt="SendQ" />;

const TAGS = [
  'LIST_NAME', 'CONTACT_NAME', 'CONTACT_STATE', 'CONTACT_ADDRESS_1', 'CONTACT_ADDRESS_2',
  'CONTACT_CITY', 'CONTACT_ZIP', 'CONTACT_COUNTRY', 'CONTACT_PHONE', 'CONTACT_EMAIL', 'CONTACT_URL',
];

const exportHtml = (editor) => {
  const css = editor.getCss();
  const html = editor.getHtml();
  return css ? `${html}<style>${css}</style>` : html;
};

const CustomEmailEditorPage = () => {
  const { t } = useTranslation();
  const { uid } = useParams();
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const editorRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let editor; let cancelled = false;
    adminApi.customTemplateDetail(uid)
      .then(({ data }) => {
        if (cancelled) return;
        setName(data.name || t('atp.template', null, 'Template'));
        setSubject(data.subject || '');
        editor = grapesjs.init({
          container: containerRef.current, height: '100%', width: 'auto', fromElement: false,
          storageManager: false, panels: { defaults: [] }, assetManager: { upload: false, dropzone: false },
          plugins: [(ed) => customCode(ed, {}), (ed) => styleBg(ed, {})],
        });
        registerCodeEditor(editor, { applyLabel: t('atp.save_apply', null, 'Save & apply'), title: t('atp.edit_code', null, 'Edit code') });
        editor.setComponents(data.content || '');
        editorRef.current = editor;
        setLoading(false);
      })
      .catch(() => { toast.error(t('atp.failed_load_template', null, 'Failed to load template.')); navigate('/admin/custom-emails'); });
    return () => { cancelled = true; try { editor?.destroy(); } catch { /* noop */ } editorRef.current = null; };
  }, [uid, navigate]);

  const insertTag = (tag) => {
    const editor = editorRef.current; if (!editor) return;
    const token = `{${tag}}`;
    try {
      const doc = editor.Canvas.getDocument();
      if (doc.activeElement?.isContentEditable) { doc.execCommand('insertText', false, token); return; }
    } catch { /* fall through */ }
    const sel = editor.getSelected();
    if (sel) { sel.append(token); toast.success(t('atp.inserted_token', { token }, 'Inserted {token}')); }
    else { editor.getWrapper().append(`<div>${token}</div>`); toast(t('atp.double_click_hint', null, 'Double-click a text area, then click a tag to insert at the cursor.')); }
  };

  const runSave = async () => {
    const editor = editorRef.current; if (!editor) return false;
    setSaving(true);
    try { await adminApi.updateCustomTemplate(uid, { subject, content: exportHtml(editor) }); toast.success(t('atp.saved', null, 'Saved.')); return true; }
    catch (err) { toast.error(err.response?.data?.message || t('atp.save_failed', null, 'Save failed')); return false; }
    finally { setSaving(false); }
  };

  return (
    <div className="tb-page">
      <header className="tb-topbar">
        <div className="tb-topbar-left"><SendQLogo /><span className="tb-name" title={name}>{name}</span></div>
        <div className="tb-topbar-right">
          <button type="button" className="tb-saveclose" onClick={() => navigate('/admin/custom-emails')}><MaterialIcon name="arrow_back" /> {t('atp.go_back', null, 'Go back')}</button>
          <button type="button" className="tb-icon-btn" onClick={() => editorRef.current?.runCommand('tb-edit-code')} title={t('atp.edit_code', null, 'Edit code')}><MaterialIcon name="code" /></button>
          <button type="button" className="btn-primary tb-save" onClick={runSave} disabled={saving || loading}>{saving ? <Spinner size="sm" /> : <MaterialIcon name="save" />} {t('common.save', null, 'Save')}</button>
          <button type="button" className="tb-close" onClick={() => navigate('/admin/custom-emails')} aria-label="Close">✕</button>
        </div>
      </header>

      {loading && <div className="tb-loading"><Spinner size="lg" /></div>}

      <div className="inv-body" style={loading ? { visibility: 'hidden' } : undefined}>
        <div className="tb-editor-wrap inv-editor-wrap"><div ref={containerRef} className="tb-editor" /></div>
        <aside className="inv-tags">
          <h3>{t('atp.subject', null, 'Subject')}</h3>
          <input className="input" style={{ marginBottom: 18 }} value={subject} onChange={(e) => setSubject(e.target.value)} />
          <h3>{t('atp.available_tags', null, 'Available tags:')}</h3>
          <div className="inv-tags-grid">
            {TAGS.map((tag) => (
              <button key={tag} type="button" className="inv-tag" onClick={() => insertTag(tag)} title={t('atp.insert_tag', { tag: `{${tag}}` }, 'Insert {tag}')}>{`{${tag}}`}</button>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
};

export default CustomEmailEditorPage;
