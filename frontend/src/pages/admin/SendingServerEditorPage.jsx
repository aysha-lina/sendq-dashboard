import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { adminApi } from '../../api/services';
import { Spinner, toast } from '../../components/ui';
import { getServerType, SPEED_LIMITS, speedLabel } from '../../constants/sendingServerTypes';
import { useTranslation } from '../../i18n';

const DASHBOARD_URLS = {
  Sendgrid: 'https://app.sendgrid.com',
  Mailgun: 'https://app.mailgun.com',
  SparkPost: 'https://app.sparkpost.com',
  'Amazon SES': 'https://console.aws.amazon.com/ses',
  'Elastic Email': 'https://elasticemail.com/account',
};

const SendingServerEditorPage = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editing = Boolean(id);

  const [typeKey, setTypeKey] = useState(searchParams.get('type') || 'smtp');
  const [serverUid, setServerUid] = useState('');
  const [form, setForm] = useState({ name: '', default_from: '', speed: '100 emails per 1 minute', status: 'active' });
  const [creds, setCreds] = useState({});
  const [credsLocked, setCredsLocked] = useState(false);
  const [pwShown, setPwShown] = useState({});
  // provider identity (read-only, verified against the provider)
  const [providerDomains, setProviderDomains] = useState([]);
  const [availableAll, setAvailableAll] = useState({});
  const [allowVerify, setAllowVerify] = useState(true);
  // local identity (editable delivery domains)
  const [localIdentities, setLocalIdentities] = useState([]);
  const [localFlags, setLocalFlags] = useState({ allow_unverified_from: false, allow_verify_domains: true, allow_verify_emails: true });
  // bounce / feedback handlers
  const [bounceHandlers, setBounceHandlers] = useState([]);
  const [feedbackHandlers, setFeedbackHandlers] = useState([]);
  const [bounceHandlerId, setBounceHandlerId] = useState('');
  const [feedbackHandlerId, setFeedbackHandlerId] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const type = getServerType(typeKey);

  useEffect(() => {
    const reqs = [
      adminApi.sendingDomains({ per_page: 200 }).catch(() => ({ data: { data: [] } })),
      adminApi.bounceHandlers({ per_page: 200 }).catch(() => ({ data: { data: [] } })),
      adminApi.feedbackHandlers({ per_page: 200 }).catch(() => ({ data: { data: [] } })),
    ];
    if (editing) reqs.push(adminApi.sendingServerDetail(id));
    Promise.all(reqs)
      .then(([domRes, bounceRes, fbRes, detail]) => {
        setProviderDomains((domRes.data?.data || []).map((d) => ({
          name: d.name || d.domain || d.host || '—',
          status: d.status || 'active',
          added_by: d.customer ? `${d.customer.first_name || ''} ${d.customer.last_name || ''}`.trim() : null,
        })));
        setBounceHandlers(bounceRes.data?.data || []);
        setFeedbackHandlers(fbRes.data?.data || []);
        if (editing && detail) {
          const s = detail.data;
          setTypeKey(s.type || 'smtp');
          setServerUid(s.uid || '');
          const opts = s.options || {};
          setForm({
            name: s.name || '', default_from: opts.default_from || '',
            speed: speedLabel(s.quota_value, s.quota_base, s.quota_unit), status: s.status || 'active',
          });
          const st = getServerType(s.type);
          const c = {};
          st.creds.forEach((f) => { c[f.key] = s[f.key] || ''; });
          setCreds(c);
          setCredsLocked(true);
          setAvailableAll(opts.available_all || {});
          if (typeof opts.allow_verify_own === 'boolean') setAllowVerify(opts.allow_verify_own);
          setLocalIdentities(Array.isArray(opts.identities) ? opts.identities : []);
          setLocalFlags({
            allow_unverified_from: opts.allow_unverified_from_email === true || opts.allow_unverified_from_email === 'yes',
            allow_verify_domains: opts.allow_verify_domain_against_sendq !== false && opts.allow_verify_domain_against_sendq !== 'no',
            allow_verify_emails: opts.allow_verify_email_against_sendq !== false && opts.allow_verify_email_against_sendq !== 'no',
          });
          setBounceHandlerId(s.bounce_handler_id || '');
          setFeedbackHandlerId(s.feedback_loop_handler_id || '');
        }
      })
      .catch(() => { toast.error(t('ase.failed_to_load', null, 'Failed to load.')); navigate('/admin/sending-servers'); })
      .finally(() => setLoading(false));
  }, [id, editing, navigate]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setCred = (k, v) => setCreds((c) => ({ ...c, [k]: v }));
  const togglePw = (k) => setPwShown((p) => ({ ...p, [k]: !p[k] }));

  // Send the current credentials (covers SMTP + every *-api type) to the server.
  const credsPayload = () => ({
    type: typeKey,
    host: creds.host, smtp_port: creds.smtp_port, smtp_username: creds.smtp_username,
    smtp_password: creds.smtp_password, smtp_protocol: creds.smtp_protocol,
    api_key: creds.api_key, domain: creds.domain,
    username: creds.username, sendmail_path: creds.sendmail_path,
    aws_access_key_id: creds.aws_access_key_id, aws_secret_access_key: creds.aws_secret_access_key, aws_region: creds.aws_region,
    from: form.default_from,
  });

  const testConnection = async () => {
    setTesting(true);
    try {
      const { data } = await adminApi.testSendingServerConnection(credsPayload(), editing ? id : undefined);
      toast.success(data.message || t('ase.connection_succeeded', null, 'Connection succeeded.'));
    } catch (err) {
      toast.error(err.response?.data?.message || t('ase.connection_failed', null, 'Connection failed.'));
    } finally { setTesting(false); }
  };

  const sendTestEmail = async () => {
    const to = window.prompt(t('ase.send_test_email_prompt', null, 'Send a test email to which address?'));
    if (!to) return;
    setTesting(true);
    try {
      const { data } = await adminApi.testSendingServerEmail({ ...credsPayload(), to: to.trim() }, editing ? id : undefined);
      toast.success(data.message || t('ase.test_email_sent', null, 'Test email sent.'));
    } catch (err) {
      toast.error(err.response?.data?.message || t('ase.could_not_send_test_email', null, 'Could not send test email.'));
    } finally { setTesting(false); }
  };

  // local identity actions
  const addLocalIdentity = () => {
    const v = window.prompt(t('ase.add_email_domain_prompt', null, 'Enter an email address or domain to allow:'));
    const val = (v || '').trim().toLowerCase();
    if (!val) return;
    if (localIdentities.some((d) => d.value === val)) { toast.error(t('ase.identity_exists', null, 'That email/domain is already listed.')); return; }
    setLocalIdentities((list) => [...list, { value: val, available_all: false }]);
  };
  const toggleLocalAll = (i) => setLocalIdentities((list) => list.map((d, idx) => (idx === i ? { ...d, available_all: !d.available_all } : d)));
  const removeLocalIdentity = (i) => setLocalIdentities((list) => list.filter((_, idx) => idx !== i));

  const save = async () => {
    if (!form.name.trim()) { toast.error(t('ase.name_is_required', null, 'Name is required.')); return; }
    const sp = SPEED_LIMITS.find((s) => s.label === form.speed) || SPEED_LIMITS[2];
    const options = { default_from: form.default_from, available_all: availableAll, allow_verify_own: allowVerify };
    if (type.identityKind === 'local') {
      options.identities = localIdentities;
      options.allow_unverified_from_email = localFlags.allow_unverified_from ? 'yes' : 'no';
      options.allow_verify_domain_against_sendq = localFlags.allow_verify_domains ? 'yes' : 'no';
      options.allow_verify_email_against_sendq = localFlags.allow_verify_emails ? 'yes' : 'no';
    }
    // Omit empty password-type creds so an unchanged (masked) secret is preserved
    // server-side rather than overwritten with null.
    const sentCreds = { ...creds };
    type.creds.forEach((f) => {
      if (f.type === 'password' && !String(sentCreds[f.key] || '').trim()) delete sentCreds[f.key];
    });
    const payload = {
      name: form.name, type: typeKey, status: form.status,
      quota_value: sp.value, quota_base: sp.base, quota_unit: sp.unit,
      options: JSON.stringify(options),
      ...sentCreds,
    };
    if (type.handlers) {
      payload.bounce_handler_id = bounceHandlerId || null;
      payload.feedback_loop_handler_id = feedbackHandlerId || null;
    }
    if (creds.smtp_port) payload.smtp_port = Number(creds.smtp_port);
    setSaving(true);
    try {
      if (editing) await adminApi.updateSendingServer(id, payload);
      else await adminApi.createSendingServer(payload);
      toast.success(editing ? t('ase.sending_server_saved', null, 'Sending server saved.') : t('ase.sending_server_created', null, 'Sending server created.'));
      navigate('/admin/sending-servers');
    } catch (err) {
      toast.error(err.response?.data?.message || t('ase.save_failed', null, 'Save failed.'));
    } finally { setSaving(false); }
  };

  const renderCred = (f) => {
    const locked = editing && credsLocked && f.type === 'password';
    if (f.type === 'select') {
      return (
        <select className="input" value={creds[f.key] || ''} onChange={(e) => setCred(f.key, e.target.value)}>
          {f.options.map((o) => <option key={o} value={o}>{o ? o.toUpperCase() : t('ase.none', null, 'None')}</option>)}
        </select>
      );
    }
    if (f.type === 'password') {
      const shown = pwShown[f.key];
      return (
        <div className="ss-pw">
          <input className="input" type={shown && !locked ? 'text' : 'password'}
            value={locked ? '' : (creds[f.key] || '')} placeholder={locked ? '••••••••••••••••••••••••' : ''}
            disabled={locked} onChange={(e) => setCred(f.key, e.target.value)} />
          <button type="button" className="ss-eye" tabIndex={-1} aria-label={shown ? 'Hide' : 'Show'} onClick={() => togglePw(f.key)}>
            <span className="material-symbols-rounded">{shown ? 'visibility_off' : 'visibility'}</span>
          </button>
        </div>
      );
    }
    return (
      <input className="input" type={f.type === 'number' ? 'number' : 'text'}
        value={creds[f.key] || ''} onChange={(e) => setCred(f.key, e.target.value)} />
    );
  };

  const webhookUrl = `${(typeof window !== 'undefined' ? window.location.origin : '')}/track/webhook/${serverUid || 'server'}`;

  return (
    <AppLayout>
      <div className="admin-page">
        <header className="admin-header">
          <nav>
            <button type="button" onClick={() => navigate('/dashboard')}>{t('ase.home', null, 'Home')}</button>
            <span>›</span>
            <button type="button" onClick={() => navigate('/admin/sending-servers')}>{t('ase.sending_servers', null, 'Sending servers')}</button>
            <span>›</span>
            <span>{editing ? t('ase.edit', null, 'Edit') : t('ase.new', null, 'New')}</span>
          </nav>
          <h1>
            <span className="material-symbols-rounded">{editing ? 'edit' : 'add'}</span>
            {editing ? (form.name || type.name) : type.name}
            {editing && <span className={`admin-status-badge admin-status-${form.status}`} style={{ marginLeft: 12 }}>{form.status}</span>}
          </h1>
        </header>

        <section className="admin-content">
          {loading ? (
            <div className="admin-empty"><Spinner size="lg" /></div>
          ) : (
            <div className="ss-editor">
              {/* Webhook settings callout (SMTP-style/local types) */}
              {type.webhook && editing && (
                <div className="ss-webhook">
                  <span className="material-symbols-rounded">check_circle</span>
                  <div>
                    <strong>{t('ase.webhook_settings', null, 'Webhook settings')}</strong>
                    <p>{t('ase.webhook_intro', null, 'In order for the application to receive delivery issues notification for bounce, feedback, etc., set up the following URL to your provider webhook settings')}</p>
                    <a href={webhookUrl} target="_blank" rel="noopener noreferrer">{webhookUrl}</a>
                  </div>
                </div>
              )}

              {/* Credentials */}
              {type.creds.length > 0 && (
                <>
                  <p className="ss-intro">{t('ase.creds_intro', { name: type.name }, 'Enter your {name} credentials to connect and send emails. Make sure your credentials have full access to your account.')}</p>
                  {type.creds.map((f) => (
                    <label key={f.key} className="admin-detail-field admin-detail-field-full ss-field">
                      <span>{f.label}{f.required ? ' *' : ''}</span>
                      {renderCred(f)}
                    </label>
                  ))}
                  <div className="ss-cred-actions">
                    <button type="button" className="btn-secondary" disabled={testing} onClick={testConnection}>{testing ? t('ase.testing', null, 'Testing…') : t('ase.test_connection', null, 'Test Connection')}</button>
                    <button type="button" className="btn-secondary" disabled={testing} onClick={sendTestEmail}>{t('ase.send_a_test_email', null, 'Send A Test Email')}</button>
                    {editing && credsLocked && <button type="button" className="ss-link" onClick={() => setCredsLocked(false)}>{t('ase.edit', null, 'Edit')}</button>}
                  </div>
                </>
              )}

              {/* Configuration settings */}
              <h2 className="sq-section-title ss-section">{t('ase.configuration_settings', null, 'Configuration settings')}</h2>
              <p className="ss-muted">{t('ase.configuration_settings_intro', null, 'Provide more configuration settings for your sending server')}</p>
              <label className="admin-detail-field admin-detail-field-full ss-field"><span>{t('ase.name_required', null, 'Name *')}</span>
                <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} /></label>
              <label className="admin-detail-field admin-detail-field-full ss-field"><span>{t('ase.default_from_email', null, 'Default FROM email')}</span>
                <input className="input" type="email" value={form.default_from} onChange={(e) => set('default_from', e.target.value)} /></label>

              {type.handlers && (
                <>
                  <label className="admin-detail-field admin-detail-field-full ss-field"><span>{t('ase.bounce_handler', null, 'Bounce handler')}</span>
                    <select className="input" value={bounceHandlerId} onChange={(e) => setBounceHandlerId(e.target.value)}>
                      <option value="">{t('ase.choose', null, 'Choose')}</option>
                      {bounceHandlers.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                    </select></label>
                  <label className="admin-detail-field admin-detail-field-full ss-field"><span>{t('ase.feedback_loop_handler', null, 'Feedback loop handler')}</span>
                    <select className="input" value={feedbackHandlerId} onChange={(e) => setFeedbackHandlerId(e.target.value)}>
                      <option value="">{t('ase.choose', null, 'Choose')}</option>
                      {feedbackHandlers.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                    </select></label>
                </>
              )}

              <p className="ss-muted">{t('ase.speed_limit_intro', null, 'Specify speed limit to control how fast your application can send through this connection in terms of email throughput.')}</p>
              <label className="admin-detail-field admin-detail-field-full ss-field"><span>{t('ase.speed_limit', null, 'Speed limit')}</span>
                <select className="input" value={form.speed} onChange={(e) => set('speed', e.target.value)}>
                  {SPEED_LIMITS.map((s) => <option key={s.label} value={s.label}>{s.label}</option>)}
                </select></label>

              {/* Sending identity — provider (verified against the provider account) */}
              {type.identityKind === 'provider' && (
                <>
                  <h2 className="sq-section-title ss-section">{t('ase.sending_identity', null, 'Sending identity')}</h2>
                  <p className="ss-muted">{t('ase.sending_identity_intro', { dashboard: type.dashboard }, 'The following domains were verified against your {dashboard} account. User can only send from the domains below and is not allowed to send on their own identity')}</p>
                  <table className="ss-identity-table">
                    <thead><tr><th>{t('ase.domain', null, 'Domain')}</th><th>{t('common.status', null, 'Status')}</th><th>{t('ase.available_for_all', null, 'Available for all')}</th><th>{t('ase.added_by', null, 'Added by')}</th></tr></thead>
                    <tbody>
                      {providerDomains.length === 0 ? (
                        <tr><td colSpan={4} className="ss-identity-empty">{t('ase.no_verified_domains', null, 'No verified domains found.')}</td></tr>
                      ) : providerDomains.map((d) => (
                        <tr key={d.name}>
                          <td>{d.name}</td>
                          <td><span className={`admin-status-badge admin-status-${d.status}`}>{d.status}</span></td>
                          <td>
                            {d.added_by ? <span className="ss-private">{t('ase.private', null, 'Private')}</span> : (
                              <button type="button" className={`admin-switch ${availableAll[d.name] ? 'is-on' : ''}`}
                                onClick={() => setAvailableAll((a) => ({ ...a, [d.name]: !a[d.name] }))} aria-pressed={Boolean(availableAll[d.name])}><span /></button>
                            )}
                          </td>
                          <td>{d.added_by ? <span className="ss-addedby">{d.added_by}</span> : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button type="button" className="btn-secondary ss-dashboard-btn" onClick={() => window.open(DASHBOARD_URLS[type.dashboard] || `https://www.google.com/search?q=${encodeURIComponent(`${type.dashboard} dashboard`)}`, '_blank', 'noopener')}>{t('ase.go_to_dashboard', { dashboard: type.dashboard }, 'Go to {dashboard} dashboard')}</button>
                  <p className="ss-muted ss-verify-note">{t('ase.verify_own_note', { dashboard: type.dashboard }, 'You can also allow your users to verify an identity on their own. That is, user can request to verify their own email address or domain against your {dashboard} account')}</p>
                  <label className="ss-checkbox">
                    <input type="checkbox" checked={allowVerify} onChange={(e) => setAllowVerify(e.target.checked)} /> {t('ase.allow_verifying_own_domains', null, "Allow verifying user's own domains")}
                  </label>
                </>
              )}

              {/* Sending identity — local (editable delivery domains) */}
              {type.identityKind === 'local' && (
                <>
                  <h2 className="sq-section-title ss-section">{t('ase.sending_identity', null, 'Sending identity')}</h2>
                  <p className="ss-muted">{t('ase.local_identity_intro', null, 'Specify the delivery domains that users can use. That is, user can specify a FROM email address that does match one of the following domains')}</p>
                  <table className="ss-identity-table">
                    <thead><tr><th>{t('ase.domain', null, 'Domain')}</th><th>{t('common.status', null, 'Status')}</th><th>{t('ase.available_for_all', null, 'Available for all')}</th><th>{t('ase.added_by', null, 'Added by')}</th><th>{t('ase.action', null, 'Action')}</th></tr></thead>
                    <tbody>
                      {localIdentities.length === 0 ? (
                        <tr><td colSpan={5} className="ss-identity-empty">{t('ase.no_identities', null, 'No delivery domains yet.')}</td></tr>
                      ) : localIdentities.map((d, i) => (
                        <tr key={d.value}>
                          <td>{d.value}</td>
                          <td><span className="admin-status-badge admin-status-active">{t('ase.active', null, 'active')}</span></td>
                          <td>
                            <button type="button" className={`admin-switch ${d.available_all ? 'is-on' : ''}`} onClick={() => toggleLocalAll(i)} aria-pressed={Boolean(d.available_all)}><span /></button>
                          </td>
                          <td />
                          <td><button type="button" className="ss-identity-del" onClick={() => removeLocalIdentity(i)}>{t('common.delete', null, 'Delete')}</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button type="button" className="btn-secondary ss-add-domain" onClick={addLocalIdentity}>{t('ase.add_email_domain', null, 'Add email/domain')}</button>
                  <p className="ss-muted ss-verify-note">{t('ase.local_verify_note', null, 'You can enable the options below to allow your users to verify and use their own sending identities and/or domains.')}</p>
                  <label className="ss-checkbox">
                    <input type="checkbox" checked={localFlags.allow_unverified_from} onChange={(e) => setLocalFlags((f) => ({ ...f, allow_unverified_from: e.target.checked }))} /> {t('ase.allow_unverified_from', null, 'Allow unverified FROM email addresses')}
                  </label>
                  <label className="ss-checkbox">
                    <input type="checkbox" checked={localFlags.allow_verify_domains} onChange={(e) => setLocalFlags((f) => ({ ...f, allow_verify_domains: e.target.checked }))} /> {t('ase.allow_verifying_own_domains', null, "Allow verifying user's own domains")}
                  </label>
                  <label className="ss-checkbox">
                    <input type="checkbox" checked={localFlags.allow_verify_emails} onChange={(e) => setLocalFlags((f) => ({ ...f, allow_verify_emails: e.target.checked }))} /> {t('ase.allow_verifying_own_emails', null, "Allow verifying user's own emails")}
                  </label>
                </>
              )}

              <div className="ss-actions">
                <button type="button" className="btn-secondary" onClick={save} disabled={saving}>{saving ? t('ase.saving', null, 'Saving…') : t('common.save', null, 'Save')}</button>
                <button type="button" className="ss-link" onClick={() => navigate('/admin/sending-servers')}>{t('common.cancel', null, 'Cancel')}</button>
              </div>
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
};

export default SendingServerEditorPage;
