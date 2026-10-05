import { useEffect, useState } from 'react';
import { campaignsApi, subscribersApi } from '../../../api/services';
import { toast } from '../../../components/ui';
import { useTranslation } from '../../../i18n';

const compact = (n) => {
  if (n == null) return '0';
  if (n >= 1000) return `${Math.round(n / 1000)}K`;
  return String(n);
};

// ─── "Send a test email" modal ───────────────────────────────────────────────
function TestEmailModal({ campaignUid, name, onClose }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!email.trim()) { toast.error(t('wiz.err_enter_email', null, 'Enter an email address.')); return; }
    setBusy(true);
    try {
      const { data } = await campaignsApi.sendTest(campaignUid, email.trim());
      toast.success(data.message || t('wiz.test_email_sent', null, 'Test email sent.'));
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || t('wiz.err_test_email', null, 'Could not send test email.'));
    } finally { setBusy(false); }
  };
  return (
    <div className="cw-modal-backdrop" onClick={onClose}>
      <div className="cw-modal" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="cw-modal-close" onClick={onClose}>✕</button>
        <h2 className="cw-modal-title" style={{ fontSize: 20 }}>{name || t('wiz.untitled', null, 'Untitled')}</h2>
        <p style={{ margin: '6px 0 14px', fontSize: 15 }}>{t('wiz.enter_email_for_test', null, 'Enter an email address for testing campaign')}</p>
        <input className="input" style={{ width: '100%', height: 46 }} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 18 }}>
          <button type="button" className="btn-danger" onClick={send} disabled={busy}>{busy ? t('wiz.sending', null, 'Sending…') : t('wiz.send', null, 'Send')}</button>
          <button type="button" className="btn-secondary" onClick={onClose}>{t('wiz.close', null, 'Close')}</button>
        </div>
      </div>
    </div>
  );
}

// ─── "Preview as" modal — search contacts, show per-contact web-view URL ──────
function PreviewAsModal({ campaignUid, listUid, onClose }) {
  const { t } = useTranslation();
  const [keyword, setKeyword] = useState('');
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const webUrl = `${window.location.origin}/campaigns/${campaignUid}`;

  const load = (kw = '') => {
    setLoading(true);
    subscribersApi.list({ list_uid: listUid, keyword: kw, per_page: 25 })
      .then(({ data }) => setContacts(data.data || []))
      .catch(() => setContacts([]))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load();   }, []);

  return (
    <div className="cw-modal-backdrop" onClick={onClose}>
      <div className="cw-modal" style={{ maxWidth: 760 }} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="cw-modal-close" onClick={onClose}>✕</button>
        <h2 className="cw-modal-title" style={{ justifyContent: 'center', fontSize: 22 }}>{t('wiz.enter_contact_email', null, 'Enter contact email to search')}</h2>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', margin: '6px 0 20px' }}>
          <div className="cw-tpl-search" style={{ margin: 0 }}>
            <input className="input" placeholder={t('wiz.type_to_search', null, 'Type to search')} value={keyword} onChange={(e) => setKeyword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load(keyword)} />
            <span className="material-symbols-rounded">search</span>
          </div>
          <button type="button" className="btn-danger" onClick={() => load(keyword)}>{t('wiz.ok', null, 'OK')}</button>
        </div>
        {loading ? (
          <div className="cw-tpl-empty"><span className="material-symbols-rounded rotating">sync</span></div>
        ) : contacts.length === 0 ? (
          <div className="cw-tpl-empty"><span className="material-symbols-rounded">group</span><p>{t('wiz.no_contacts_found', null, 'No contacts found.')}</p></div>
        ) : (
          <div className="cw-prev-list">
            {contacts.map((c) => (
              <div key={c.uid || c.email} className="cw-prev-row">
                <span className="material-symbols-rounded cw-prev-avatar">account_circle</span>
                <div className="cw-prev-body">
                  <a className="cw-prev-email" href={webUrl} target="_blank" rel="noreferrer">{c.email}</a>
                  <div className="cw-prev-url-label">{t('wiz.web_view_url', null, 'Web view URL:')}</div>
                  <div className="cw-prev-url-row">
                    <input className="input" readOnly value={webUrl} />
                    <button type="button" className="btn-secondary" onClick={() => window.open(webUrl, '_blank')}><span className="material-symbols-rounded">open_in_new</span> {t('wiz.open', null, 'open')}</button>
                    <button type="button" className="btn-secondary" onClick={() => { navigator.clipboard?.writeText(webUrl); toast.success(t('wiz.copied', null, 'Copied.')); }}><span className="material-symbols-rounded">content_copy</span> {t('wiz.copy', null, 'Copy')}</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function WizardStep5Confirm({ form, campaignUid, onEdit, onSend, onSaveOnly, saving, error, isEdit, canSend }) {
  const { t } = useTranslation();
  const [recipients, setRecipients] = useState(null);
  const [showTest, setShowTest] = useState(false);
  const [showPreviewAs, setShowPreviewAs] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [spam, setSpam] = useState(null);
  const [spamLoading, setSpamLoading] = useState(false);

  useEffect(() => {
    if (!form.mail_list_uid) { setRecipients(0); return; }
    subscribersApi.list({ list_uid: form.mail_list_uid, status: 'subscribed', per_page: 1 })
      .then(({ data }) => setRecipients(data.pagination?.total ?? (data.data || []).length))
      .catch(() => setRecipients(null));
  }, [form.mail_list_uid]);

  // Inline spam-score check on the confirm step (matches PHP's review-page score row).
  useEffect(() => {
    if (!form.subject && !form.html && !form.plain) { setSpam(null); return; }
    setSpamLoading(true);
    campaignsApi.spamScore({ subject: form.subject, html: form.html, plain: form.plain })
      .then(({ data }) => setSpam(data))
      .catch(() => setSpam(null))
      .finally(() => setSpamLoading(false));
  }, [form.subject, form.html, form.plain]);

  const tracking = [form.track_open && t('wiz.opens', null, 'Opens'), form.track_click && t('wiz.clicks', null, 'Clicks')].filter(Boolean).join(', ') || t('wiz.none', null, 'None');

  const recipientsCount = recipients == null ? '…' : Number(recipients).toLocaleString();
  const rows = [
    { key: 'recipients', title: t('wiz.row_recipients', { count: recipientsCount }, `${recipientsCount} Recipients`), sub: compact(recipients), action: t('common.edit', null, 'Edit'), onClick: () => onEdit(0) },
    { key: 'subject', title: t('wiz.label_subject', null, 'Email subject'), sub: form.subject || '—', action: t('common.edit', null, 'Edit'), onClick: () => onEdit(1) },
    { key: 'reply_to', title: t('wiz.label_reply_to', null, 'Reply to'), sub: form.reply_to || form.from_email || '—', action: t('common.edit', null, 'Edit'), onClick: () => onEdit(1) },
    { key: 'tracking', title: t('wiz.tracking', null, 'Tracking'), sub: tracking, action: t('common.edit', null, 'Edit'), onClick: () => onEdit(1) },
    { key: 'webhooks', title: t('wiz.webhooks_count', { count: 0 }, '0 Webhooks'), sub: t('wiz.webhooks_sub', null, 'Send notifications to your 3rd application'), action: t('wiz.manage', null, 'Manage'), onClick: () => toast(t('wiz.webhooks_toast', null, 'Webhooks are managed under Lists › Webhook.')) },
    {
      key: 'schedule',
      title: form.schedule === 'later' ? t('wiz.scheduled', null, 'Scheduled') : t('wiz.run_immediately', null, 'Run immediately'),
      sub: form.schedule === 'later' ? new Date(form.scheduled_at).toLocaleString() : t('wiz.click_send_proceed', null, 'Click send button to proceed'),
      action: t('common.edit', null, 'Edit'), onClick: () => onEdit(3),
    },
  ];

  return (
    <div className="cw-step">
      <div className="cw-confirm-head">
        <h2>{t('wiz.all_set', null, "You're all set to send!")}</h2>
        <p>{t('wiz.review_feedback', null, 'Review the feedback below before sending your campaign.')}</p>
      </div>

      <div className="cw-confirm-list">
        {rows.map((r) => (
          <div key={r.key} className="cw-confirm-row">
            <span className="material-symbols-rounded cw-confirm-check">check_circle</span>
            <div className="cw-confirm-text">
              <strong>{r.title}</strong>
              <p>{r.sub}</p>
            </div>
            <button type="button" className="btn-secondary cw-confirm-edit" onClick={r.onClick}>{r.action}</button>
          </div>
        ))}
      </div>

      <div className={`cw-spam-panel cw-spam-${spam ? spam.rating : 'pending'}`}>
        <div className="cw-spam-head">
          <span className="material-symbols-rounded">verified_user</span>
          <strong>{t('wiz.spam_score', null, 'Spam score')}</strong>
          {spamLoading ? (
            <em className="cw-spam-loading">{t('wiz.spam_checking', null, 'Checking…')}</em>
          ) : spam ? (
            <span className={`cw-spam-badge cw-spam-badge-${spam.rating}`}>
              {spam.score}/100 · {t(`wiz.spam_${spam.rating}`, null, spam.rating)}
            </span>
          ) : null}
        </div>
        {spam && spam.issues?.length > 0 && (
          <ul className="cw-spam-issues">
            {spam.issues.map((it, i) => (
              <li key={i} className={`cw-spam-issue-${it.level}`}>
                <span className="material-symbols-rounded">{it.level === 'high' ? 'error' : it.level === 'medium' ? 'warning' : 'info'}</span>
                {it.message}
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <div className="wizard-error-banner"><span className="material-symbols-rounded">error</span>{error}</div>}

      <div className="cw-confirm-actions">
        <button type="button" className="btn-secondary" onClick={() => setShowPreviewAs(true)}><span className="material-symbols-rounded">mail</span> {t('wiz.preview_as', null, 'Preview as')}</button>
        <button type="button" className="btn-secondary" onClick={() => setShowPreview(true)}><span className="material-symbols-rounded">visibility</span> {t('wiz.preview', null, 'Preview')}</button>
        <button type="button" className="btn-secondary" onClick={() => setShowTest(true)}>{t('wiz.send_test_email', null, 'Send a test email')}</button>
        {canSend ? (
          <button type="button" className="btn-danger cw-send-btn" onClick={onSend} disabled={saving}>
            {saving ? t('wiz.working', null, 'Working…') : (form.schedule === 'later' ? t('wiz.schedule_bang', null, 'Schedule!') : t('wiz.send_or_schedule', null, 'Send or Schedule!'))}
          </button>
        ) : isEdit && onSaveOnly && (
          <button type="button" className="btn-danger cw-send-btn" onClick={onSaveOnly} disabled={saving}>{saving ? t('wiz.saving', null, 'Saving…') : t('wiz.save_changes', null, 'Save Changes')}</button>
        )}
      </div>

      {showTest && <TestEmailModal campaignUid={campaignUid} name={form.name} onClose={() => setShowTest(false)} />}
      {showPreviewAs && <PreviewAsModal campaignUid={campaignUid} listUid={form.mail_list_uid} onClose={() => setShowPreviewAs(false)} />}
      {showPreview && (
        <div className="cw-modal-backdrop" onClick={() => setShowPreview(false)}>
          <div className="cw-modal" style={{ maxWidth: 760, padding: 0, overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
            <button type="button" className="cw-modal-close" onClick={() => setShowPreview(false)}>✕</button>
            <iframe title="Preview" srcDoc={form.html || `<p style="padding:24px;font-family:sans-serif">${t('wiz.no_content', null, 'No content')}</p>`} style={{ width: '100%', height: '80vh', border: 0, background: '#fff' }} sandbox="allow-same-origin" />
          </div>
        </div>
      )}
    </div>
  );
}
