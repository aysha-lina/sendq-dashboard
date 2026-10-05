import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { sendingApi } from '../../api/services';
import { toast } from '../../components/ui';
import { MaterialIcon, formatSendingDate } from './SendingDomainsPage';
import { useTranslation } from '../../i18n';

// ─── Per-section configuration ──────────────────────────────────────────────────
// String fields hold i18n keys (resolved via t() at render time).
const configs = {
  servers: {
    crumb: 'snd.sending_servers',
    title: 'snd.sending_servers',
    description: 'snd.sending_servers_desc',
    action: 'snd.new_sending_server',
    emptyIcon: 'dns',
    emptyText: 'snd.no_sending_servers',
    api: {
      list: sendingApi.sendingServers,
      create: sendingApi.createSendingServer,
      update: sendingApi.updateSendingServer,
      remove: sendingApi.deleteSendingServer,
      test: sendingApi.testSendingServer,
    },
    columns: [
      { key: 'name', label: 'common.name', render: (r) => r.name },
      { key: 'type', label: 'snd.type', render: (r) => (r.type || 'smtp').toUpperCase() },
      { key: 'host', label: 'snd.host', render: (r) => r.host || (r.aws_region ? `SES ${r.aws_region}` : '-') },
      { key: 'status', label: 'common.status', render: (r) => <StatusBadge status={r.status} /> },
    ],
    fields: [
      { name: 'name', label: 'common.name', required: true, placeholder: 'My SMTP server' },
      { name: 'type', label: 'snd.type', type: 'select', required: true, default: 'smtp', options: ['smtp', 'ses', 'gmail', 'sendmail'] },
      { name: 'host', label: 'snd.smtp_host', placeholder: 'smtp.example.com' },
      { name: 'smtp_port', label: 'snd.port', placeholder: '587' },
      { name: 'smtp_protocol', label: 'snd.encryption', type: 'select', options: ['tls', 'ssl', 'none'], default: 'tls' },
      { name: 'smtp_username', label: 'snd.username', placeholder: 'user@example.com' },
      { name: 'smtp_password', label: 'snd.password', type: 'password', placeholder: '••••••••' },
      { name: 'aws_access_key_id', label: 'snd.aws_access_key', placeholder: 'AKIA…' },
      { name: 'aws_secret_access_key', label: 'snd.aws_secret_key', type: 'password', placeholder: 'secret' },
      { name: 'aws_region', label: 'snd.aws_region', placeholder: 'us-east-1' },
      { name: 'status', label: 'common.status', type: 'select', options: ['active', 'inactive'], default: 'active' },
    ],
    canEdit: true,
    canTest: true,
  },
  tracking: {
    crumb: 'snd.tracking_domains',
    title: 'snd.tracking_domains',
    description: 'snd.tracking_domains_desc',
    action: 'snd.new_tracking_domain',
    createPath: '/sending/tracking-domains/new',
    emptyIcon: 'public',
    emptyText: 'snd.no_tracking_domains',
    api: {
      list: sendingApi.trackingDomains,
      create: sendingApi.createTrackingDomain,
      remove: sendingApi.deleteTrackingDomain,
      verify: sendingApi.verifyTrackingDomain,
    },
    columns: [
      { key: 'name', label: 'snd.domain', render: (r) => r.name },
      { key: 'scheme', label: 'snd.scheme', render: (r) => r.scheme || 'http' },
      { key: 'status', label: 'common.status', render: (r) => <StatusBadge status={r.status} /> },
      { key: 'created_at', label: 'common.created_at', render: (r) => formatSendingDate(r.created_at) },
    ],
    fields: [
      { name: 'name', label: 'snd.domain', required: true, placeholder: 'track.example.com' },
      { name: 'scheme', label: 'snd.scheme', type: 'select', options: ['http', 'https'], default: 'http' },
    ],
    canVerify: true,
  },
  signatures: {
    crumb: 'snd.signatures',
    title: 'snd.signatures',
    description: 'snd.signatures_desc',
    action: 'snd.new_signature',
    emptyIcon: 'draw',
    emptyText: 'snd.no_signatures',
    api: {
      list: sendingApi.signatures,
      create: sendingApi.createSignature,
      update: sendingApi.updateSignature,
      remove: sendingApi.deleteSignature,
    },
    columns: [
      { key: 'name', label: 'common.name', render: (r) => r.name },
      { key: 'is_default', label: 'snd.default', render: (r, t) => (r.is_default ? t('snd.yes') : t('snd.no')) },
      { key: 'status', label: 'common.status', render: (r) => <StatusBadge status={r.status} /> },
      { key: 'created_at', label: 'common.created_at', render: (r) => formatSendingDate(r.created_at) },
    ],
    fields: [
      { name: 'name', label: 'common.name', required: true, placeholder: 'Marketing signature' },
      { name: 'content', label: 'snd.content_html', type: 'textarea', required: true, placeholder: '<p>Best regards…</p>' },
      { name: 'status', label: 'common.status', type: 'select', options: ['active', 'inactive'], default: 'active' },
      { name: 'is_default', label: 'snd.set_as_default', type: 'checkbox' },
    ],
    canEdit: true,
  },
  verification: {
    crumb: 'snd.email_verification_servers',
    title: 'snd.email_verification_servers',
    description: 'snd.email_verification_servers_desc',
    action: 'snd.new_server',
    createPath: '/sending/email-verification-servers/new',
    emptyIcon: 'dns',
    emptyText: 'snd.no_email_verification_servers',
    api: {
      list: sendingApi.verificationServers,
      remove: sendingApi.deleteVerificationServer,
    },
    columns: [
      { key: 'name', label: 'common.name', render: (r) => r.name },
      { key: 'type', label: 'snd.type', render: (r) => r.type },
      { key: 'status', label: 'common.status', render: (r) => <StatusBadge status={r.status} /> },
      { key: 'created_at', label: 'common.created_at', render: (r) => formatSendingDate(r.created_at) },
    ],
    fields: [],
    canEdit: true,
    editPath: (r) => `/sending/email-verification-servers/${r.id}/edit`,
  },
  blacklist: {
    crumb: 'snd.blacklist',
    title: 'snd.blacklist',
    description: 'snd.blacklist_desc',
    action: 'snd.add_address',
    emptyIcon: 'person_remove',
    emptyText: 'snd.no_blacklist_records',
    api: {
      list: sendingApi.blacklist,
      create: sendingApi.createBlacklist,
      remove: sendingApi.deleteBlacklist,
      import: sendingApi.importBlacklist,
    },
    columns: [
      { key: 'email', label: 'snd.email', render: (r) => r.email },
      { key: 'reason', label: 'snd.reason', render: (r) => r.reason || '-' },
      { key: 'created_at', label: 'common.created_at', render: (r) => formatSendingDate(r.created_at) },
    ],
    fields: [
      { name: 'email', label: 'snd.email', required: true, placeholder: 'spammer@example.com' },
      { name: 'reason', label: 'snd.reason', type: 'textarea', placeholder: 'snd.optional_reason' },
    ],
    canImport: true,
  },
};

function StatusBadge({ status }) {
  const { t } = useTranslation();
  const ok = ['active', 'verified'].includes(status);
  return (
    <span className={`sending-status-pill ${ok ? 'sending-ok' : 'sending-blocked'}`}>
      {status || t('snd.unverified')}
    </span>
  );
}

// Resolve a value that may be an i18n key (snd.* / common.*) or a literal string.
const tx = (t, val) => (typeof val === 'string' && /^(snd|common|subs)\./.test(val) ? t(val) : val);

// ─── Create / edit modal ────────────────────────────────────────────────────────
const ResourceModal = ({ config, record, onSave, onClose }) => {
  const { t } = useTranslation();
  const editing = Boolean(record);
  const [form, setForm] = useState(() => config.fields.reduce((acc, f) => {
    acc[f.name] = record?.[f.name] ?? (f.type === 'checkbox' ? false : f.default ?? '');
    return acc;
  }, {}));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const setField = (name, value) => setForm((prev) => ({ ...prev, [name]: value }));

  const submit = async () => {
    const missing = config.fields.filter((f) => f.required && !String(form[f.name] ?? '').trim());
    if (missing.length) { setError(t('snd.fields_required', { fields: missing.map((f) => tx(t, f.label)).join(', ') })); return; }
    setSaving(true); setError('');
    try {
      await onSave(form);
    } catch (err) {
      setError(err.response?.data?.message || t('snd.save_failed'));
      setSaving(false);
    }
  };

  return (
    <div className="sending-modal-backdrop" onClick={onClose}>
      <div className="sending-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sending-modal-head">
          <h3>{editing ? t('snd.edit_named', { name: tx(t, config.title).toLowerCase() }) : tx(t, config.action)}</h3>
          <button type="button" onClick={onClose} aria-label={t('snd.close')}>✕</button>
        </div>
        {config.fields.map((field) => (
          <label key={field.name} className="sending-modal-field">
            <span>{tx(t, field.label)}{field.required ? ' *' : ''}</span>
            {field.type === 'select' ? (
              <select value={form[field.name]} onChange={(e) => setField(field.name, e.target.value)}>
                {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : field.type === 'textarea' ? (
              <textarea rows={4} value={form[field.name]} placeholder={tx(t, field.placeholder)}
                onChange={(e) => setField(field.name, e.target.value)} />
            ) : field.type === 'checkbox' ? (
              <input type="checkbox" checked={Boolean(form[field.name])}
                onChange={(e) => setField(field.name, e.target.checked)} />
            ) : (
              <input type={field.type === 'password' ? 'password' : 'text'} value={form[field.name]} placeholder={tx(t, field.placeholder)}
                onChange={(e) => setField(field.name, e.target.value)} />
            )}
          </label>
        ))}
        {error && <p className="sending-modal-error">{error}</p>}
        <div className="sending-modal-actions">
          <button type="button" className="btn-primary" onClick={submit} disabled={saving}>
            {saving ? t('subs.saving') : t('common.save')}
          </button>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>{t('common.cancel')}</button>
        </div>
      </div>
    </div>
  );
};

const ImportModal = ({ onImport, onClose }) => {
  const { t } = useTranslation();
  const [emails, setEmails] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async () => {
    if (!emails.trim()) { setError(t('snd.paste_at_least_one_email')); return; }
    setBusy(true); setError('');
    try { await onImport({ emails, reason }); }
    catch (err) { setError(err.response?.data?.message || t('snd.import_failed')); setBusy(false); }
  };
  return (
    <div className="sending-modal-backdrop" onClick={onClose}>
      <div className="sending-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sending-modal-head"><h3>{t('snd.import_blacklist')}</h3><button type="button" onClick={onClose}>✕</button></div>
        <label className="sending-modal-field">
          <span>{t('snd.emails_input_label')}</span>
          <textarea rows={6} value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="a@x.com&#10;b@y.com" />
        </label>
        <label className="sending-modal-field">
          <span>{t('snd.reason')}</span>
          <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('snd.imported_placeholder')} />
        </label>
        {error && <p className="sending-modal-error">{error}</p>}
        <div className="sending-modal-actions">
          <button type="button" className="btn-primary" onClick={run} disabled={busy}>{busy ? t('snd.importing') : t('common.import')}</button>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>{t('common.cancel')}</button>
        </div>
      </div>
    </div>
  );
};

// ─── Page ───────────────────────────────────────────────────────────────────────
const SendingResourcePage = ({ type }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const config = configs[type];
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [keyword, setKeyword] = useState('');
  const [modal, setModal] = useState({ open: false, record: null });
  const [importOpen, setImportOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await config.api.list();
      setRows(res.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || t('snd.unable_load_records'));
    } finally {
      setLoading(false);
    }
  }, [config]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (!keyword.trim()) return rows;
    const k = keyword.toLowerCase();
    return rows.filter((r) => JSON.stringify(r).toLowerCase().includes(k));
  }, [rows, keyword]);

  const save = async (formData) => {
    if (modal.record) await config.api.update(modal.record.id, formData);
    else await config.api.create(formData);
    setModal({ open: false, record: null });
    setNotice(t('snd.saved'));
    load();
  };

  const remove = async (row) => {
    if (!window.confirm(t('snd.confirm_delete_record'))) return;
    try { await config.api.remove(row.id); load(); }
    catch (err) { toast.error(err.response?.data?.message || t('snd.delete_failed')); }
  };

  const verify = async (row) => {
    try {
      const res = await config.api.verify(row.id);
      setNotice(res.data?.status === 'verified' ? t('snd.domain_verified') : t('snd.could_not_verify_dns'));
      load();
    } catch (err) { toast.error(err.response?.data?.message || t('snd.verify_failed')); }
  };

  const test = async (row) => {
    try {
      const res = await config.api.test(row.id);
      toast.success(res.data?.message || t('snd.connection_successful'));
    } catch (err) {
      toast.error(err.response?.data?.message || t('snd.connection_failed'));
    }
  };

  const runImport = async (payload) => {
    const res = await config.api.import(payload);
    setImportOpen(false);
    setNotice(res.data?.message || t('snd.imported'));
    load();
  };

  return (
    <AppLayout>
      <div className="sending-page">
        <header className="sending-page-title sending-compact-title">
          <nav><span>{t('common.home')}</span><span>&gt;</span><span>{t(config.crumb)}</span></nav>
          <h1>{t(config.title)}</h1>
        </header>

        <section className="sending-intro">
          <h2>{t(config.title)}</h2>
          <p>{t(config.description)}</p>
        </section>

        <div className="sending-top-controls">
          <div className="sending-filter-box">
            <label className="sending-search">
              <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder={t('common.type_to_search')} />
              <MaterialIcon>search</MaterialIcon>
            </label>
          </div>
          <div className="sending-action-group">
            {config.canImport && (
              <button type="button" className="btn-secondary" onClick={() => setImportOpen(true)}>
                <MaterialIcon>upload</MaterialIcon> {t('common.import')}
              </button>
            )}
            <button type="button" className="btn-primary sending-create-button" onClick={() => (config.createPath ? navigate(config.createPath) : setModal({ open: true, record: null }))}>
              <MaterialIcon>add</MaterialIcon> {t(config.action)}
            </button>
          </div>
        </div>

        {notice && <div className="sending-notice">{notice}</div>}
        {error && <div className="sending-notice sending-notice-error">{error}</div>}

        {loading ? (
          <div className="sending-empty-list"><MaterialIcon>hourglass_empty</MaterialIcon><p>{t('common.loading')}</p></div>
        ) : filtered.length === 0 ? (
          <div className="sending-empty-list">
            <MaterialIcon>{config.emptyIcon}</MaterialIcon>
            <p>{t(config.emptyText)}</p>
          </div>
        ) : (
          <div className="sending-table-wrap">
            <table className="sending-table">
              <thead>
                <tr>
                  {config.columns.map((c) => <th key={c.key}>{t(c.label)}</th>)}
                  <th>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id}>
                    {config.columns.map((c) => <td key={c.key}>{c.render(row, t)}</td>)}
                    <td className="sending-row-actions">
                      {config.canVerify && (
                        <button type="button" className="btn-secondary" onClick={() => verify(row)}>{t('snd.verify')}</button>
                      )}
                      {config.canTest && (
                        <button type="button" className="btn-secondary" onClick={() => test(row)}>{t('snd.test')}</button>
                      )}
                      {config.canEdit && (
                        <button type="button" className="btn-secondary" onClick={() => (config.editPath ? navigate(config.editPath(row)) : setModal({ open: true, record: row }))}>{t('common.edit')}</button>
                      )}
                      <button type="button" className="sending-delete-btn" onClick={() => remove(row)}>{t('common.delete')}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <footer className="sending-footer">{t('common.copyright')}</footer>
      </div>

      {modal.open && (
        <ResourceModal config={config} record={modal.record} onSave={save} onClose={() => setModal({ open: false, record: null })} />
      )}
      {importOpen && <ImportModal onImport={runImport} onClose={() => setImportOpen(false)} />}
    </AppLayout>
  );
};

export default SendingResourcePage;
