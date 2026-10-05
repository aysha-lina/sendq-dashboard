import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { adminApi } from '../../api/services';
import { Spinner, toast } from '../../components/ui';
import { useTranslation } from '../../i18n';

// kind: 'bounce' | 'feedback'
const CONFIG = {
  bounce: {
    label: 'bounce handler', crumb: 'Bounce handlers', backTo: '/admin/bounce-handlers',
    detail: adminApi.bounceHandlerDetail, create: adminApi.createBounceHandler,
    update: adminApi.updateBounceHandler,
  },
  feedback: {
    label: 'feedback loop handler', crumb: 'Feedback loop handlers', backTo: '/admin/feedback-handlers',
    detail: adminApi.feedbackHandlerDetail, create: adminApi.createFeedbackHandler,
    update: adminApi.updateFeedbackHandler,
  },
};

const MailboxHandlerEditorPage = ({ kind }) => {
  const cfg = CONFIG[kind];
  const { t } = useTranslation();
  const { uid } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(uid);

  const cfgLabel = kind === 'bounce'
    ? t('ase.bounce_handler', null, 'bounce handler')
    : t('ase.feedback_loop_handler', null, 'feedback loop handler');
  const cfgCrumb = kind === 'bounce'
    ? t('ase.bounce_handlers', null, 'Bounce handlers')
    : t('ase.feedback_loop_handlers', null, 'Feedback loop handlers');

  const [form, setForm] = useState({
    name: '', host: '', port: '', email: '', username: '', password: '', protocol: 'imap', encryption: 'tls',
  });
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) return;
    cfg.detail(uid)
      .then(({ data }) => setForm((f) => ({
        ...f, name: data.name || '', host: data.host || '', port: data.port || '', email: data.email || '',
        username: data.username || '', password: '', protocol: data.protocol || 'imap', encryption: data.encryption || 'tls',
      })))
      .catch(() => { toast.error(t('ase.failed_to_load', null, 'Failed to load.')); navigate(cfg.backTo); })
      .finally(() => setLoading(false));
  }, [uid, editing]);  

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const validate = () => {
    for (const [k, lbl] of [
      ['name', t('common.name', null, 'Name')],
      ['host', t('ase.hostname', null, 'Hostname')],
      ['port', t('ase.port', null, 'Port')],
      ['email', t('ase.email', null, 'Email')],
      ['username', t('ase.username', null, 'Username')],
    ]) {
      if (!String(form[k]).trim()) { toast.error(t('ase.field_is_required', { field: lbl }, '{field} is required.')); return false; }
    }
    if (!editing && !form.password) { toast.error(t('ase.password_is_required', null, 'Password is required.')); return false; }
    return true;
  };

  const [testing, setTesting] = useState(false);
  const testConnection = async () => {
    for (const [k, lbl] of [
      ['host', t('ase.hostname', null, 'Hostname')],
      ['port', t('ase.port', null, 'Port')],
      ['username', t('ase.username', null, 'Username')],
    ]) {
      if (!String(form[k]).trim()) { toast.error(t('ase.field_is_required_to_test', { field: lbl }, '{field} is required to test.')); return; }
    }
    if (!form.password) { toast.error(t('ase.enter_password_to_test', null, 'Enter the password to test the connection.')); return; }
    setTesting(true);
    try {
      const { data } = await adminApi.testMailboxHandler({
        host: form.host, port: form.port, username: form.username, password: form.password,
        protocol: form.protocol, encryption: form.encryption,
      });
      toast.success(data.message || t('ase.connection_successful', null, 'Connection successful.'));
    } catch (err) {
      toast.error(err.response?.data?.message || t('ase.connection_failed', null, 'Connection failed.'));
    } finally { setTesting(false); }
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = { ...form };
      if (editing && !payload.password) delete payload.password;
      if (editing) await cfg.update(uid, payload);
      else await cfg.create(payload);
      toast.success(editing ? t('ase.saved', null, 'Saved.') : t('ase.created', null, 'Created.'));
      navigate(cfg.backTo);
    } catch (err) {
      toast.error(err.response?.data?.message || t('ase.save_failed', null, 'Save failed.'));
    } finally { setSaving(false); }
  };

  return (
    <AppLayout>
      <div className="admin-page">
        <header className="admin-header">
          <nav>
            <button type="button" onClick={() => navigate('/dashboard')}>{t('ase.home', null, 'Home')}</button>
            <span>›</span>
            <button type="button" onClick={() => navigate(cfg.backTo)}>{cfgCrumb}</button>
          </nav>
          <h1><span className="material-symbols-rounded">add</span>{editing ? t('ase.edit_label', { label: cfgLabel }, 'Edit {label}') : t('ase.new_label', { label: cfgLabel }, 'New {label}')}</h1>
        </header>

        <section className="admin-content">
          {loading ? (
            <div className="admin-empty"><Spinner size="lg" /></div>
          ) : (
            <div className="mbx-editor">
              <div className="mbx-grid">
                <label className="admin-detail-field"><span>{t('ase.name_required', null, 'Name *')}</span>
                  <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} /></label>
                <label className="admin-detail-field"><span>{t('ase.hostname_required', null, 'Hostname *')}</span>
                  <input className="input" value={form.host} onChange={(e) => set('host', e.target.value)} /></label>
                <label className="admin-detail-field"><span>{t('ase.port_required', null, 'Port *')}</span>
                  <input className="input" value={form.port} onChange={(e) => set('port', e.target.value)} /></label>

                <label className="admin-detail-field"><span>{t('ase.email_required', null, 'Email *')}</span>
                  <input className="input" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} /></label>
                <label className="admin-detail-field"><span>{t('ase.username_required', null, 'Username *')}</span>
                  <input className="input" value={form.username} onChange={(e) => set('username', e.target.value)} /></label>
                <label className="admin-detail-field"><span>{t('ase.password_required', null, 'Password *')}</span>
                  <input className="input" type="password" value={form.password} onChange={(e) => set('password', e.target.value)} /></label>

                <label className="admin-detail-field"><span>{t('ase.protocol_required', null, 'Protocol *')}</span>
                  <select className="input" value={form.protocol} onChange={(e) => set('protocol', e.target.value)}>
                    <option value="imap">imap</option><option value="pop3">pop3</option>
                  </select></label>
                <label className="admin-detail-field"><span>{t('ase.encryption_required', null, 'Encryption *')}</span>
                  <select className="input" value={form.encryption} onChange={(e) => set('encryption', e.target.value)}>
                    <option value="tls">tls</option><option value="starttls">starttls</option>
                    <option value="notls">notls</option><option value="ssl">ssl</option>
                  </select></label>
              </div>

              <div className="mbx-actions">
                <button type="button" className="btn-danger" onClick={testConnection} disabled={testing}>
                  <span className="material-symbols-rounded">cable</span> {testing ? t('ase.testing', null, 'Testing…') : t('ase.test', null, 'Test')}
                </button>
                <button type="button" className="btn-secondary" onClick={save} disabled={saving}>{saving ? t('ase.saving', null, 'Saving…') : t('common.save', null, 'Save')}</button>
              </div>
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
};

export default MailboxHandlerEditorPage;
