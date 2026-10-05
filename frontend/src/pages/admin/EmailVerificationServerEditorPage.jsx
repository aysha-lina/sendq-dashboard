import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { adminApi } from '../../api/services';
import { Spinner, toast } from '../../components/ui';
import { useTranslation } from '../../i18n';

const SERVICE_TYPES = [
  { value: '', label: 'Choose' },
  { value: 'mx', label: 'MX Record Check (Built-in)' },
  { value: 'emailable', label: 'Emailable' },
  { value: 'zerobounce', label: 'ZeroBounce' },
  { value: 'kickbox', label: 'Kickbox IO' },
  { value: 'verifyemail', label: 'VerifyEmail ORG' },
  { value: 'localmail', label: 'Localmail IO' },
  { value: 'debounce', label: 'Debounce IO' },
  { value: 'emailchecker', label: 'EmailChecker' },
  { value: 'cloudvision', label: 'Cloud Vision' },
  { value: 'cloudmersive', label: 'Cloudmersive' },
  { value: 'emaillist_validation', label: 'Emaillist Validation' },
  { value: 'bounceless', label: 'Bounceless.io' },
  { value: 'bouncify', label: 'Bouncify' },
  { value: 'myemailverifier', label: 'myEmailVerifier' },
  { value: 'emailevss', label: 'EmailEVSs' },
  { value: 'verifiedemails', label: 'VerifiedEmails.io' },
  { value: 'reoon', label: 'Reoon.com' },
  { value: 'emaillistverify', label: 'EmailListVerify.com' },
  { value: 'neverbounce', label: 'NerverBounce.com' },
];
const UNITS = [
  { value: '', label: 'Choose' },
  { value: 'minute', label: 'minute' },
  { value: 'hour', label: 'hour' },
  { value: 'day', label: 'day' },
];

const EmailVerificationServerEditorPage = () => {
  const { t } = useTranslation();
  const { uid } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(uid);

  const [form, setForm] = useState({ name: '', type: '', api_key: '', limit_value: '', limit_base: '', limit_unit: '' });
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) return;
    adminApi.emailVerificationServerDetail(uid)
      .then(({ data }) => {
        const o = data.options || {};
        setForm({
          name: data.name || '', type: data.type || '', api_key: o.api_key || '',
          limit_value: o.limit_value ?? '', limit_base: o.limit_base ?? '', limit_unit: o.limit_unit || '',
        });
      })
      .catch(() => { toast.error(t('ase.failed_to_load', null, 'Failed to load.')); navigate('/admin/email-verification-servers'); })
      .finally(() => setLoading(false));
  }, [uid, editing, navigate]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const needsApiKey = form.type && form.type !== 'mx';

  const save = async () => {
    if (!form.name.trim()) { toast.error(t('ase.name_is_required', null, 'Name is required.')); return; }
    if (!form.type) { toast.error(t('ase.service_type_is_required', null, 'Service type is required.')); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name, type: form.type, api_key: form.api_key,
        limit_value: form.limit_value, limit_base: form.limit_base, limit_unit: form.limit_unit,
      };
      if (editing) await adminApi.updateEmailVerificationServer(uid, payload);
      else await adminApi.createEmailVerificationServer(payload);
      toast.success(editing ? t('ase.saved', null, 'Saved.') : t('ase.created', null, 'Created.'));
      navigate('/admin/email-verification-servers');
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
            <button type="button" onClick={() => navigate('/admin/email-verification-servers')}>{t('ase.email_verification_servers', null, 'Email verification servers')}</button>
          </nav>
          <h1><span className="material-symbols-rounded">add</span>{editing ? t('ase.edit', null, 'Edit') : t('ase.create_new', null, 'Create new')}</h1>
        </header>

        <section className="admin-content">
          {loading ? (
            <div className="admin-empty"><Spinner size="lg" /></div>
          ) : (
            <div className="evs-editor">
              <div className="evs-grid">
                <label className="admin-detail-field"><span>{t('ase.name_required', null, 'Name *')}</span>
                  <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} /></label>
                <label className="admin-detail-field"><span>{t('ase.service_type_required', null, 'Service type *')}</span>
                  <select className="input" value={form.type} onChange={(e) => set('type', e.target.value)}>
                    {SERVICE_TYPES.map((st) => <option key={st.value} value={st.value}>{st.value === '' ? t('ase.choose', null, 'Choose') : st.label}</option>)}
                  </select></label>
              </div>

              {needsApiKey && (
                <label className="admin-detail-field admin-detail-field-full evs-field"><span>{t('ase.api_key_required', null, 'API Key *')}</span>
                  <input className="input" type="password" value={form.api_key} onChange={(e) => set('api_key', e.target.value)} /></label>
              )}

              <h2 className="sq-section-title evs-section">{t('ase.checking_limit', null, 'Checking limit')}</h2>
              <p className="evs-muted">
                {t('ase.checking_limit_intro_1', null, 'The configuration setting below allows you to set a limit on the verification speed. For example, to limit the verification speed to')}{' '}
                <strong>{t('ase.checking_limit_example', null, '2,000 emails every 5 minutes')}</strong>,{' '}
                {t('ase.checking_limit_intro_2', null, 'you can set')} <strong>{t('ase.checking_limit_value_example', null, 'Limit value = 2000')}</strong>,
                <strong> {t('ase.checking_limit_base_example', null, 'Limit base = 5')}</strong>, {t('ase.and', null, 'and')} <strong>{t('ase.checking_limit_unit_example', null, 'Limit unit = minute')}</strong>.
              </p>
              <div className="evs-grid evs-grid-3">
                <label className="admin-detail-field"><span>{t('ase.limit_value_required', null, 'Limit value *')}</span>
                  <input className="input" type="number" value={form.limit_value} onChange={(e) => set('limit_value', e.target.value)} /></label>
                <label className="admin-detail-field"><span>{t('ase.limit_base_required', null, 'Limit base *')}</span>
                  <input className="input" type="number" value={form.limit_base} onChange={(e) => set('limit_base', e.target.value)} /></label>
                <label className="admin-detail-field"><span>{t('ase.limit_time_unit_required', null, 'Limit time unit *')}</span>
                  <select className="input" value={form.limit_unit} onChange={(e) => set('limit_unit', e.target.value)}>
                    {UNITS.map((u) => <option key={u.value} value={u.value}>{u.value === '' ? t('ase.choose', null, 'Choose') : u.label}</option>)}
                  </select></label>
              </div>

              <div className="evs-actions">
                <button type="button" className="btn-danger" onClick={save} disabled={saving}>{saving ? t('ase.saving', null, 'Saving…') : t('common.save', null, 'Save')}</button>
                <button type="button" className="btn-secondary" onClick={() => navigate('/admin/email-verification-servers')}>{t('common.cancel', null, 'Cancel')}</button>
              </div>
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
};

export default EmailVerificationServerEditorPage;
