import { useEffect, useRef, useState } from 'react';
import { campaignsApi } from '../../../api/services';
import { useTranslation } from '../../../i18n';

const MaterialIcon = ({ name }) => <span className="material-symbols-rounded">{name}</span>;

const fmtSize = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

// Attachments (real upload to the backend) + custom email headers + per-campaign
// delivery webhooks. Attachments upload immediately (need a saved campaignUid);
// headers/webhooks live in the wizard form and are saved with the step payload.
export default function CampaignExtras({ campaignUid, form, update }) {
  const { t } = useTranslation();
  const fileRef = useRef(null);
  const [attachments, setAttachments] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const headers = form.custom_headers || [];
  const webhooks = form.webhooks || [];

  useEffect(() => {
    if (!campaignUid) return;
    campaignsApi.attachments(campaignUid)
      .then(({ data }) => setAttachments(data.attachments || []))
      .catch(() => setAttachments([]));
  }, [campaignUid]);

  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !campaignUid) return;
    setBusy(true); setError('');
    try {
      const { data } = await campaignsApi.uploadAttachment(campaignUid, file);
      setAttachments(data.attachments || []);
    } catch (err) {
      setError(err.response?.data?.message || t('wiz.attach_failed', null, 'Upload failed.'));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const onRemove = async (id) => {
    try {
      const { data } = await campaignsApi.removeAttachment(campaignUid, id);
      setAttachments(data.attachments || []);
    } catch { /* ignore */ }
  };

  const setHeader = (i, key, val) => update({ custom_headers: headers.map((h, idx) => (idx === i ? { ...h, [key]: val } : h)) });
  const addHeader = () => update({ custom_headers: [...headers, { name: '', value: '' }] });
  const removeHeader = (i) => update({ custom_headers: headers.filter((_, idx) => idx !== i) });

  const setWebhook = (i, val) => update({ webhooks: webhooks.map((w, idx) => (idx === i ? { ...w, url: val } : w)) });
  const addWebhook = () => update({ webhooks: [...webhooks, { url: '' }] });
  const removeWebhook = (i) => update({ webhooks: webhooks.filter((_, idx) => idx !== i) });

  return (
    <>
      {/* Attachments (real) */}
      <h3 className="cw-section-title">{t('wiz.attachment', null, 'Attachment')}</h3>
      <p className="cw-section-intro">
        {t('wiz.attachment_desc', null, 'Files below are sent with the email. Allowed: PDF, images, Office documents, CSV, TXT, RTF, ZIP (max 10 MB).')}
      </p>
      {!campaignUid ? (
        <p className="cw-section-intro" style={{ opacity: 0.7 }}>
          {t('wiz.attach_save_first', null, 'Save the campaign first to add attachments.')}
        </p>
      ) : (
        <>
          <input
            ref={fileRef}
            type="file"
            onChange={onUpload}
            disabled={busy}
            accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.bmp,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.rtf,.zip"
          />
          {error && <p className="cw-field-error">{error}</p>}
          {attachments.length > 0 && (
            <ul className="cw-attach-list">
              {attachments.map((a) => (
                <li key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <MaterialIcon name="description" /> {a.filename}
                  <span style={{ opacity: 0.6 }}>({fmtSize(a.size || 0)})</span>
                  <button type="button" className="cw-link" onClick={() => onRemove(a.id)}>
                    {t('common.remove', null, 'Remove')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {/* Custom email headers */}
      <h3 className="cw-section-title">{t('wiz.custom_headers', null, 'Custom email headers')}</h3>
      <p className="cw-section-intro">
        {t('wiz.custom_headers_desc', null, 'Optional headers added to every email in this campaign (e.g. X-Campaign-Id: summer-sale).')}
      </p>
      {headers.map((h, i) => (
        <div key={i} className="cw-sig-row" style={{ marginBottom: 8 }}>
          <input className="input" style={{ maxWidth: 260 }} placeholder="Header name" value={h.name || ''} onChange={(e) => setHeader(i, 'name', e.target.value)} />
          <input className="input" style={{ maxWidth: 340 }} placeholder="Value" value={h.value || ''} onChange={(e) => setHeader(i, 'value', e.target.value)} />
          <button type="button" className="cw-link" onClick={() => removeHeader(i)}>{t('common.remove', null, 'Remove')}</button>
        </div>
      ))}
      <button type="button" className="btn-secondary" onClick={addHeader}><MaterialIcon name="add" /> {t('wiz.add_header', null, 'Add header')}</button>

      {/* Per-campaign delivery webhooks */}
      <h3 className="cw-section-title">{t('wiz.webhooks', null, 'Delivery webhooks')}</h3>
      <p className="cw-section-intro">
        {t('wiz.webhooks_desc', null, 'POST a JSON summary to these URLs when this campaign finishes sending. Internal/private URLs are blocked.')}
      </p>
      {webhooks.map((w, i) => (
        <div key={i} className="cw-sig-row" style={{ marginBottom: 8 }}>
          <input className="input" style={{ maxWidth: 520 }} placeholder="https://example.com/webhook" value={w.url || ''} onChange={(e) => setWebhook(i, e.target.value)} />
          <button type="button" className="cw-link" onClick={() => removeWebhook(i)}>{t('common.remove', null, 'Remove')}</button>
        </div>
      ))}
      <button type="button" className="btn-secondary" onClick={addWebhook}><MaterialIcon name="add" /> {t('wiz.add_webhook', null, 'Add webhook')}</button>
    </>
  );
}
