import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { sendingApi } from '../../api/services';
import { toast } from '../../components/ui';
import { useTranslation } from '../../i18n';

const SAMPLE = `<div builder-element="TextElement" style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5; color: #333;">
  <p builder-element="TextElement">
    <strong builder-element="TextElement" style="font-size: 16px;">John Doe</strong><br>
    Software Engineer<br>
    <a builder-element href="mailto:johndoe@example.com" style="color: #007BFF; text-decoration: none;">
      johndoe@example.com
    </a><br>
    <a builder-element href="tel:+1234567890" style="color: #007BFF; text-decoration: none;">
      +1 (234) 567-890
    </a><br>
    <a builder-element href="https://www.linkedin.com/in/johndoe" style="color: #007BFF; text-decoration: none;">
      LinkedIn
    </a>
  </p>
</div>`;

const SignatureEditorPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const editing = Boolean(id);
  const listPath = '/sending/signatures';

  const [name, setName] = useState('');
  const [content, setContent] = useState(editing ? '' : SAMPLE);
  const [isDefault, setIsDefault] = useState(false);
  const [tab, setTab] = useState('source'); // 'source' | 'preview'
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const gutterRef = useRef(null);
  const lineNumbers = useMemo(() => Array.from({ length: Math.max(content.split('\n').length, 1) }, (_, i) => i + 1), [content]);
  const syncScroll = (e) => { if (gutterRef.current) gutterRef.current.scrollTop = e.target.scrollTop; };

  useEffect(() => {
    if (!editing) return;
    sendingApi.signatures()
      .then(({ data }) => {
        const sig = (data.data || []).find((s) => String(s.id) === String(id));
        if (!sig) { toast.error(t('snd.signature_not_found')); navigate(listPath); return; }
        setName(sig.name || '');
        setContent(sig.content || '');
        setIsDefault(Boolean(sig.is_default));
      })
      .catch(() => { toast.error(t('snd.failed_to_load')); navigate(listPath); })
      .finally(() => setLoading(false));
  }, [id, editing, navigate]);

  const save = async () => {
    if (!name.trim()) { toast.error(t('snd.signature_name_required')); return; }
    if (!content.trim()) { toast.error(t('snd.signature_content_required')); return; }
    setSaving(true);
    try {
      const payload = { name, content, is_default: isDefault, status: 'active' };
      if (editing) await sendingApi.updateSignature(id, payload);
      else await sendingApi.createSignature(payload);
      toast.success(editing ? t('snd.saved') : t('snd.created'));
      navigate(listPath);
    } catch (err) {
      toast.error(err.response?.data?.message || t('snd.save_failed'));
    } finally { setSaving(false); }
  };

  return (
    <AppLayout>
      <div className="admin-page">
        <header className="admin-header">
          <nav>
            <button type="button" onClick={() => navigate('/dashboard')}>{t('common.home')}</button>
            <span>›</span>
            <button type="button" onClick={() => navigate(listPath)}>{t('snd.signatures')}</button>
          </nav>
          <h1><span className="material-symbols-rounded">draw</span>{editing ? t('snd.edit_signature') : t('snd.add_new_signature')}</h1>
        </header>

        <section className="admin-content">
          <p className="set-intro">{t('snd.signatures_intro')}</p>

          {loading ? <div className="admin-empty">{t('common.loading')}</div> : (
            <>
              <label className="admin-detail-field admin-detail-field-full sig-field"><span>{t('snd.signature_name_label')}</span>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} /></label>

              <div className="sig-content-head">
                <span className="sig-label">{t('snd.signature_content_label')}</span>
                <div className="sig-tabs">
                  <button type="button" className={`sig-tab ${tab === 'source' ? 'is-active' : ''}`} onClick={() => setTab('source')}>{t('snd.source_code')}</button>
                  <button type="button" className={`sig-tab ${tab === 'preview' ? 'is-active' : ''}`} onClick={() => setTab('preview')}>{t('snd.preview')}</button>
                </div>
              </div>

              {tab === 'source' ? (
                <div className="sig-code-wrap">
                  <div className="sig-gutter" ref={gutterRef}>{lineNumbers.map((n) => <span key={n}>{n}</span>)}</div>
                  <textarea className="sig-code" spellCheck={false} value={content} onChange={(e) => setContent(e.target.value)} onScroll={syncScroll} rows={16} />
                </div>
              ) : (
                <iframe className="sig-preview" title={t('snd.signature_preview')} srcDoc={content} />
              )}

              <div className="sig-default-row">
                <button type="button" role="switch" aria-checked={isDefault} className={`admin-switch ${isDefault ? 'is-on' : ''}`} onClick={() => setIsDefault((v) => !v)}><span /></button>
                <div>
                  <strong>{t('snd.make_default_signature')}</strong>
                  <p className="evs-muted">{t('snd.make_default_signature_desc')}</p>
                </div>
              </div>

              <div className="evs-actions">
                <button type="button" className="btn-secondary" onClick={save} disabled={saving}>{saving ? t('subs.saving') : t('common.save')}</button>
                <button type="button" className="btn-secondary" onClick={() => navigate(listPath)}>{t('common.cancel')}</button>
              </div>
            </>
          )}
        </section>
      </div>
    </AppLayout>
  );
};

export default SignatureEditorPage;
