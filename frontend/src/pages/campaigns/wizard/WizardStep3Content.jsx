import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HtmlEditor, Spinner } from '../../../components/ui';
import { templatesApi, sendingApi } from '../../../api/services';
import { useTranslation } from '../../../i18n';
import CampaignExtras from './CampaignExtras';

const TABS = ['Basic', 'Featured', 'Themes', 'My templates', 'Upload'];
const TAB_LABELS = {
  Basic: { key: 'wiz.tab_basic', en: 'Basic' },
  Featured: { key: 'wiz.tab_featured', en: 'Featured' },
  Themes: { key: 'wiz.tab_themes', en: 'Themes' },
  'My templates': { key: 'wiz.tab_my_templates', en: 'My templates' },
  Upload: { key: 'wiz.tab_upload', en: 'Upload' },
};

const fmtDate = (d) => {
  const date = new Date(d);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 16).replace('T', ' ');
};

// ─── Template picker modal (Basic / Featured / Themes / My templates / Upload) ───
function TemplatePickerModal({ onClose, onPick }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState('Basic');
  const [all, setAll] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [uploadBusy, setUploadBusy] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    Promise.all([
      templatesApi.list({ per_page: 200 }).catch(() => ({ data: { data: [] } })),
      templatesApi.categories().catch(() => ({ data: { data: [] } })),
    ]).then(([tplRes, catRes]) => {
      setAll(tplRes.data?.data || tplRes.data || []);
      setCategories(catRes.data?.data || catRes.data || []);
    }).finally(() => setLoading(false));
  }, []);

  const catUidByName = (name) => categories.find((c) => (c.name || '').toLowerCase() === name.toLowerCase())?.uid;
  const inCategory = (tpl, name) => {
    const uid = catUidByName(name);
    return uid && (tpl.categories || []).some((c) => c.uid === uid);
  };

  const tabList = () => {
    if (tab === 'My templates') return all;
    if (tab === 'Basic') return catUidByName('Basic') ? all.filter((t) => inCategory(t, 'Basic')) : all;
    if (tab === 'Featured') return all.filter((t) => inCategory(t, 'Featured'));
    if (tab === 'Themes') return all.filter((t) => inCategory(t, 'Themes'));
    return [];
  };

  const list = tabList().filter((t) => !search.trim() || (t.name || '').toLowerCase().includes(search.toLowerCase()));

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setUploadBusy(true);
    try {
      const text = await file.text();
      onPick({ name: file.name.replace(/\.[^.]+$/, ''), content: text });
    } finally { setUploadBusy(false); }
  };

  return (
    <div className="cw-modal-backdrop" onClick={onClose}>
      <div className="cw-modal cw-tpl-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="cw-modal-close" onClick={onClose}>✕</button>
        <h2 className="cw-modal-title"><span className="material-symbols-rounded">dashboard</span> {t('wiz.template', null, 'Template')}</h2>
        <p className="cw-modal-sub">{t('wiz.choose_template_sub', null, 'Choose a template for your campaign')}</p>

        <div className="cw-tpl-tabs">
          {TABS.map((tName) => (
            <button key={tName} type="button" className={`cw-tpl-tab ${tab === tName ? 'active' : ''}`} onClick={() => setTab(tName)}>{t(TAB_LABELS[tName].key, null, TAB_LABELS[tName].en)}</button>
          ))}
        </div>

        {tab === 'Upload' ? (
          <div className="cw-tpl-upload">
            <p>{t('wiz.upload_intro', null, 'Select a template package from your PC to upload. A template package should be a .ZIP archive containing an index.html file and other assets like CSS, images… You can also upload a single .html file.')}</p>
            <div className="cw-tpl-upload-note">
              <span className="material-symbols-rounded">info</span>
              {t('wiz.upload_note', null, 'Uploaded templates may not work well with the drag & drop builder. It is always recommended that you create a new template based on one of the available templates, for optimized compatibility and efficiency')}
            </div>
            <label className="cw-label" style={{ marginTop: 16 }}>{t('wiz.choose_file_upload', null, 'Choose a file to upload')}</label>
            <input ref={fileRef} className="input" type="file" accept=".html,.htm,.zip" />
            <button type="button" className="btn-danger" style={{ marginTop: 16 }} onClick={handleUpload} disabled={uploadBusy}>
              {uploadBusy ? t('wiz.uploading', null, 'Uploading…') : t('wiz.upload', null, 'Upload')}
            </button>
          </div>
        ) : (
          <>
            <h3 className="cw-tpl-cat">{t(TAB_LABELS[tab].key, null, TAB_LABELS[tab].en)}</h3>
            <div className="cw-tpl-search">
              <input className="input" placeholder={t('wiz.type_to_search', null, 'Type to search')} value={search} onChange={(e) => setSearch(e.target.value)} />
              <span className="material-symbols-rounded">search</span>
            </div>
            {loading ? (
              <div className="cw-tpl-empty"><Spinner size="lg" /></div>
            ) : list.length === 0 ? (
              <div className="cw-tpl-empty">
                <span className="material-symbols-rounded">dashboard</span>
                <p>{t('wiz.no_template_available', null, 'No template available!')}</p>
              </div>
            ) : (
              <div className="cw-tpl-grid">
                {list.map((tpl) => (
                  <button key={tpl.uid} type="button" className="cw-tpl-card" onClick={() => onPick(tpl)} title={tpl.name}>
                    <div className="cw-tpl-thumb">
                      {tpl.image
                        ? <img src={tpl.image} alt={tpl.name} />
                        : <iframe srcDoc={tpl.content || ''} title={tpl.name} sandbox="allow-same-origin" scrolling="no" />}
                    </div>
                    <span className="cw-tpl-name">{tpl.name || t('wiz.untitled_template', null, 'Untitled template')}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function WizardStep3Content({ form, update, campaignUid, onNext, onBack, saving }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [html, setHtml] = useState(form.html || '');
  const [plain, setPlain] = useState(form.plain || '');
  const [preheader, setPreheader] = useState(form.preheader || '');
  const [showPicker, setShowPicker] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [showPreheader, setShowPreheader] = useState(Boolean(form.preheader));
  const [editedAt, setEditedAt] = useState(form.html ? Date.now() : null);
  const [signatures, setSignatures] = useState([]);
  const [signature, setSignature] = useState('');
  const [error, setError] = useState('');

  const loadSignatures = () => sendingApi.signatures()
    .then(({ data }) => setSignatures(data.data || []))
    .catch(() => setSignatures([]));
  useEffect(() => { loadSignatures(); }, []);

  const pickTemplate = (tpl) => {
    setHtml(tpl.content || '');
    setEditedAt(Date.now());
    setShowPicker(false);
    setError('');
  };

  const handleNext = () => {
    if (form.type === 'plain-text') {
      if (!plain.trim()) { setError(t('wiz.err_plain_required', null, 'Plain text content is required.')); return; }
    } else if (!html.trim()) {
      setError(t('wiz.err_content_required', null, 'Please choose or create email content first.'));
      return;
    }
    // Append the selected signature once if chosen.
    let finalHtml = html;
    const sig = signatures.find((s) => String(s.id) === String(signature));
    if (sig?.content && !html.includes(sig.content)) finalHtml = `${html}${sig.content}`;
    onNext({ html: finalHtml, plain, preheader });
  };

  const hasContent = Boolean(html.trim()) || form.type === 'plain-text';

  return (
    <div className="cw-step">
      <h2 className="cw-step-title">{t('wiz.content_management', null, 'Content Management')}</h2>

      {!hasContent ? (
        // ─── Entry: create from template or upload ───────────────────────────────
        <>
          <h3 className="cw-section-title">{t('wiz.email_content', null, 'Email Content')}</h3>
          <p className="cw-section-intro">
            {t('wiz.email_content_intro', null, 'Create your email from scratch or start from our pre-built templates / themes. Customize the content the way you desire with our powerful but easy-to-use HTML email builder.')}
          </p>
          <div className="cw-content-options">
            <button type="button" className="cw-content-option" onClick={() => setShowPicker(true)}>
              <span className="material-symbols-rounded cw-co-icon">add_circle</span>
              <div>
                <strong>{t('wiz.create_from_template', null, 'Create from an existing template')}</strong>
                <p>{t('wiz.create_from_template_desc', null, 'Craft your beautiful email based off a pre-built template we made for you')}</p>
              </div>
            </button>
            <button type="button" className="cw-content-option" onClick={() => { setShowPicker('upload'); }}>
              <span className="material-symbols-rounded cw-co-icon">upload</span>
              <div>
                <strong>{t('wiz.upload_template', null, 'Upload a template you have')}</strong>
                <p>{t('wiz.upload_template_desc', null, 'Upload your own template in ZIP format')}</p>
              </div>
            </button>
          </div>
        </>
      ) : (
        // ─── Post-select: chosen content + signature + attachments + preheader ────
        <>
          <div className="cw-content-chosen">
            <div>
              <p className="cw-section-intro" style={{ marginBottom: 18 }}>
                {t('wiz.email_content_intro', null, 'Create your email from scratch or start from our pre-built templates / themes. Customize the content the way you desire with our powerful but easy-to-use HTML email builder.')}
              </p>
              <h3 className="cw-chosen-title">{t('wiz.html_email', null, 'HTML Email')}</h3>
              {editedAt && <p className="cw-chosen-date">{t('wiz.last_edited_on', { date: fmtDate(editedAt) }, `Last edited on ${fmtDate(editedAt)}`)}</p>}
              <div className="cw-chosen-actions">
                <button type="button" className="cw-link" onClick={() => setShowPicker(true)}>{t('wiz.change_template', null, 'Change Template')}</button>
                <button type="button" className="cw-link" onClick={() => setShowEditor((s) => !s)}>{showEditor ? t('wiz.close_editor', null, 'Close editor') : t('wiz.edit_content', null, 'Edit content')}</button>
              </div>
            </div>
            {html && (
              <div className="cw-chosen-thumb">
                <iframe srcDoc={html} title="preview" sandbox="allow-same-origin" scrolling="no" />
              </div>
            )}
          </div>

          {showEditor && form.type !== 'plain-text' && (
            <div style={{ margin: '18px 0' }}>
              <HtmlEditor value={html} onChange={(v) => { setHtml(v); setEditedAt(Date.now()); }} height="380px" />
            </div>
          )}
          {form.type === 'plain-text' && (
            <textarea className="input" style={{ width: '100%', minHeight: 220, margin: '18px 0' }} value={plain} onChange={(e) => setPlain(e.target.value)} placeholder={t('wiz.plain_text_placeholder', null, 'Plain text content…')} />
          )}

          {/* Signature */}
          <h3 className="cw-section-title">{t('wiz.select_signature', null, 'Select signature')}</h3>
          <p className="cw-section-intro">{t('wiz.select_signature_desc', null, 'Select a signature for this campaign. It will be automatically inserted into the email template content.')}</p>
          <div className="cw-sig-row">
            <select className="input cw-select" value={signature} onChange={(e) => setSignature(e.target.value)} style={{ maxWidth: 420 }}>
              <option value="">{t('wiz.no_signature', null, 'No signature')}</option>
              {signatures.map((s) => <option key={s.id} value={s.id}>{s.name}{s.is_default ? t('wiz.default_suffix', null, ' (default)') : ''}</option>)}
            </select>
            <button type="button" className="btn-secondary" onClick={loadSignatures}><span className="material-symbols-rounded">refresh</span> {t('wiz.refresh', null, 'Refresh')}</button>
            <button type="button" className="btn-secondary" onClick={() => navigate('/sending/signatures')}><span className="material-symbols-rounded">open_in_new</span> {t('wiz.manage_signatures', null, 'Manage signatures')}</button>
          </div>

          {/* Attachments (real) + custom headers + per-campaign webhooks */}
          <CampaignExtras campaignUid={campaignUid} form={form} update={update} />

          {/* Preheader */}
          <h3 className="cw-section-title">{t('wiz.preheader', null, 'Preheader')}</h3>
          <p className="cw-section-intro">{t('wiz.preheader_desc', null, 'Email preheader text is a single line of text that appears after the subject line in an email inbox. Adding a descriptive preheader might increase open rates.')}</p>
          {showPreheader ? (
            <input className="input" style={{ maxWidth: 720 }} value={preheader} onChange={(e) => setPreheader(e.target.value)} placeholder={t('wiz.preheader_placeholder', null, 'Preheader text')} />
          ) : (
            <button type="button" className="btn-secondary" onClick={() => setShowPreheader(true)}><span className="material-symbols-rounded">add</span> {t('wiz.add_preheader', null, 'Add Preheader')}</button>
          )}
        </>
      )}

      {error && <p className="cw-field-error">{error}</p>}

      <div className="cw-nav cw-nav-split">
        <button className="btn-secondary" onClick={onBack} disabled={saving}>
          <span className="material-symbols-rounded">arrow_back</span> {t('common.back', null, 'Back')}
        </button>
        {hasContent && (
          <button className="btn-primary" onClick={handleNext} disabled={saving}>
            {t('common.next', null, 'Next')} <span className="material-symbols-rounded">arrow_forward</span>
          </button>
        )}
      </div>

      {showPicker && <TemplatePickerModal onClose={() => setShowPicker(false)} onPick={pickTemplate} />}
    </div>
  );
}
