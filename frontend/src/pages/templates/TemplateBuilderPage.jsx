import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import grapesjs from 'grapesjs';
import presetNewsletter from 'grapesjs-preset-newsletter';
import presetWebpage from 'grapesjs-preset-webpage';
import blocksBasic from 'grapesjs-blocks-basic';
import formsPlugin from 'grapesjs-plugin-forms';
import customCode from 'grapesjs-custom-code';
import styleBg from 'grapesjs-style-bg';
import 'grapesjs/dist/css/grapes.min.css';
import { templatesApi } from '../../api/services';
import { Spinner } from '../../components/ui';
import { registerSections } from './builderBlocks';
import './templateBuilder.css';

const MaterialIcon = ({ name }) => <span className="material-symbols-rounded">{name}</span>;

const SendQLogo = () => <img className="tb-logo" src="/assets/3.png" alt="SendQ" />;

const DEVICES = [
  { id: 'Mobile', icon: 'smartphone', label: 'Mobile' },
  { id: 'Tablet', icon: 'tablet', label: 'Tablet' },
  { id: 'Desktop', icon: 'desktop_windows', label: 'Desktop' },
];

// Pull export-ready HTML out of the editor. In email mode the newsletter preset
// inlines CSS for email clients; in page mode we keep the <style> block.
const exportHtml = (editor) => {
  try {
    const inlined = editor.runCommand('gjs-get-inlined-html');
    if (inlined) return inlined;
  } catch { /* not in email mode — fall through */ }
  const css = editor.getCss();
  const html = editor.getHtml();
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${html}</body></html>`;
};

// Build a GrapesJS instance configured for the given mode.
//   email -> table-based, CSS-inlined output (safe in Gmail/Outlook)
//   page  -> modern div/flex output for landing / web pages
const buildEditor = (container, mode, content) => {
  const presetPlugins = mode === 'page'
    ? [
        (ed) => presetWebpage(ed, {
          modalImportTitle: 'Import',
          modalImportButton: 'Import',
          modalImportLabel: 'Paste your HTML/CSS here and import',
        }),
        (ed) => blocksBasic(ed, { flexGrid: true, category: 'Basic' }),
        (ed) => formsPlugin(ed, {}),
      ]
    : [
        (ed) => presetNewsletter(ed, {
          modalTitleImport: 'Import template',
          modalLabelImport: 'Paste your HTML/CSS here and import',
          importPlaceholder: '<table class="table">...</table>',
          cellStyle: { 'font-size': '14px', 'font-family': 'Arial, Helvetica, sans-serif' },
        }),
      ];

  // Custom uploader: route image uploads through our axios client so the JWT
  // auth header is attached (GrapesJS' built-in uploader would skip it).
  let editor;
  const uploadFile = async (e) => {
    const files = e?.dataTransfer ? e.dataTransfer.files : e?.target?.files;
    if (!files || !files.length) return;
    try {
      const { data } = await templatesApi.uploadAssets(files);
      editor.AssetManager.add(data.data || []);
    } catch (err) {
      editor.log?.(err.response?.data?.message || 'Image upload failed', { level: 'error' });
    }
  };

  editor = grapesjs.init({
    container,
    height: '100%',
    width: 'auto',
    fromElement: false,
    storageManager: false,
    assetManager: {
      // A truthy `upload` makes GrapesJS render the file-picker / drop area.
      // The actual upload is handled by `uploadFile` below (so the JWT is sent).
      upload: '/api/v1/assets',
      uploadFile,
      dropzone: true,
      multiUpload: true,
      autoAdd: true,
      dropzoneContent: 'Drop images here or click to upload',
    },
    plugins: [
      ...presetPlugins,
      (ed) => customCode(ed, {}),
      (ed) => styleBg(ed, {}),
    ],
  });

  registerSections(editor, mode);

  // Editable code popup: edit the full HTML/CSS in a textarea and apply it back
  // to the canvas. Overrides the built-in read-only "Export template" view so
  // BOTH the topbar and the canvas code buttons open this editable one.
  const openEditableCode = () => {
    const cssStr = editor.getCss();
    const htmlStr = editor.getHtml();
    const full = cssStr ? `<style>\n${cssStr}\n</style>\n${htmlStr}` : htmlStr;

    const wrap = document.createElement('div');
    wrap.className = 'tb-code-modal';
    const ta = document.createElement('textarea');
    ta.className = 'tb-code-textarea';
    ta.spellcheck = false;
    ta.value = full;
    const actions = document.createElement('div');
    actions.className = 'tb-code-actions';
    const apply = document.createElement('button');
    apply.type = 'button';
    apply.className = 'tb-code-apply';
    apply.textContent = 'Save & apply';
    apply.addEventListener('click', () => {
      editor.setComponents(ta.value);
      editor.Modal.close();
    });
    actions.appendChild(apply);
    wrap.appendChild(ta);
    wrap.appendChild(actions);
    editor.Modal.open({ title: 'Edit code', content: wrap }).onceClose(() => {});
  };

  editor.Commands.add('tb-edit-code', { run: openEditableCode });
  // Replace the built-in read-only export command so the canvas code button
  // (</>)  also opens the editable popup.
  editor.Commands.add('export-template', { run: openEditableCode });

  editor.setComponents(content || '');
  return editor;
};

const detectMode = (content) => {
  if (!content || /<table[\s>]/i.test(content)) return 'email';
  return 'page';
};

const TemplateBuilderPage = () => {
  const { uid } = useParams();
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const editorRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [device, setDevice] = useState('Desktop');
  const [mode, setMode] = useState('email');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let editor;
    let cancelled = false;

    templatesApi.get(uid)
      .then(({ data }) => {
        if (cancelled) return;
        setName(data.name || 'Untitled template');
        const initialMode = detectMode(data.content);
        setMode(initialMode);
        editor = buildEditor(containerRef.current, initialMode, data.content || '');
        editorRef.current = editor;
        setLoading(false);
      })
      .catch(() => navigate('/templates'));

    return () => {
      cancelled = true;
      try { editor?.destroy(); } catch { /* noop */ }
      editorRef.current = null;
    };
  }, [uid, navigate]);

  const changeDevice = (id) => {
    setDevice(id);
    editorRef.current?.setDevice(id);
  };

  // Switch between Email and Page builders, carrying the current design across.
  const switchMode = (newMode) => {
    const editor = editorRef.current;
    if (!editor || newMode === mode) return;
    const css = editor.getCss();
    const html = editor.getHtml();
    const carried = css ? `<style>${css}</style>${html}` : html;
    try { editor.destroy(); } catch { /* noop */ }
    const next = buildEditor(containerRef.current, newMode, carried);
    next.setDevice(device);
    editorRef.current = next;
    setMode(newMode);
  };

  const runSave = async () => {
    const editor = editorRef.current;
    if (!editor) return false;
    setSaving(true);
    setError('');
    try {
      await templatesApi.update(uid, { name, content: exportHtml(editor) });
      setSavedAt(new Date());
      return true;
    } catch (err) {
      setError(err.response?.data?.message || 'Save failed');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveAndClose = async () => {
    if (await runSave()) navigate('/templates');
  };

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
          <div className="tb-mode-switch" role="group" aria-label="Builder mode">
            <button
              type="button"
              className={mode === 'email' ? 'is-active' : ''}
              onClick={() => switchMode('email')}
              title="Email-safe template (Gmail/Outlook)"
            >
              <MaterialIcon name="mail" /> Email
            </button>
            <button
              type="button"
              className={mode === 'page' ? 'is-active' : ''}
              onClick={() => switchMode('page')}
              title="Web / landing page"
            >
              <MaterialIcon name="web" /> Page
            </button>
          </div>
        </div>

        <div className="tb-topbar-center">
          <button type="button" className="tb-icon-btn" onClick={undo} title="Undo"><MaterialIcon name="undo" /></button>
          <button type="button" className="tb-icon-btn" onClick={redo} title="Redo"><MaterialIcon name="redo" /></button>
          <span className="tb-divider" />
          {DEVICES.map((d) => (
            <button
              key={d.id}
              type="button"
              className={`tb-icon-btn ${device === d.id ? 'is-active' : ''}`}
              onClick={() => changeDevice(d.id)}
              title={d.label}
            >
              <MaterialIcon name={d.icon} />
            </button>
          ))}
          <span className="tb-divider" />
          <button type="button" className="tb-icon-btn" onClick={togglePreview} title="Preview"><MaterialIcon name="visibility" /></button>
          <button type="button" className="tb-icon-btn" onClick={openCode} title="View code"><MaterialIcon name="code" /></button>
        </div>

        <div className="tb-topbar-right">
          {error && <span className="tb-save-msg tb-save-error">{error}</span>}
          {!error && savedAt && <span className="tb-save-msg">Last save: today</span>}
          <button type="button" className="btn-primary tb-save" onClick={runSave} disabled={saving || loading}>
            {saving ? <Spinner size="sm" /> : <MaterialIcon name="save" />} Save
          </button>
          <button type="button" className="tb-saveclose" onClick={saveAndClose} disabled={saving || loading}>
            Save &amp; Close
          </button>
          <button type="button" className="tb-close" onClick={() => navigate('/templates')} title="Close" aria-label="Close">✕</button>
        </div>
      </header>

      {loading && (
        <div className="tb-loading"><Spinner size="lg" /></div>
      )}
      <div className="tb-editor-wrap" style={loading ? { visibility: 'hidden' } : undefined}>
        <div ref={containerRef} className="tb-editor" />
      </div>
    </div>
  );
};

export default TemplateBuilderPage;
