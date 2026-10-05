import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { sendingApi } from '../../api/services';
import { toast } from '../../components/ui';
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

const VerificationServerEditorPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const editing = Boolean(id);
  const listPath = '/sending/email-verification-servers';
  const optLabel = (value, label) => {
    const map = {
      '': t('snd.choose'),
      mx: t('snd.mx_record_check'),
      minute: t('snd.unit_minute'),
      hour: t('snd.unit_hour'),
      day: t('snd.unit_day'),
    };
    return map[value] ?? label;
  };

  const [form, setForm] = useState({ name: '', type: '', api_key: '', limit_value: '', limit_base: '', limit_unit: '' });
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) return;
    sendingApi.verificationServerDetail(id)
      .then(({ data }) => {
        const o = data.options || {};
        setForm({
          name: data.name || '', type: data.type || '', api_key: o.api_key || '',
          limit_value: o.limit_value ?? '', limit_base: o.limit_base ?? '', limit_unit: o.limit_unit || '',
        });
      })
      .catch(() => { toast.error(t('snd.failed_to_load')); navigate(listPath); })
      .finally(() => setLoading(false));
  }, [id, editing, navigate]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const needsApiKey = form.type && form.type !== 'mx';

  const save = async () => {
    if (!form.name.trim()) { toast.error(t('snd.name_required')); return; }
    if (!form.type) { toast.error(t('snd.service_type_required')); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name, type: form.type, api_key: form.api_key,
        limit_value: form.limit_value, limit_base: form.limit_base, limit_unit: form.limit_unit,
      };
      if (editing) await sendingApi.updateVerificationServer(id, payload);
      else await sendingApi.createVerificationServer(payload);
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
            <button type="button" onClick={() => navigate(listPath)}>{t('snd.email_verification_servers')}</button>
          </nav>
          <h1><span className="material-symbols-rounded">add</span>{editing ? t('common.edit') : t('snd.create_new')}</h1>
        </header>

        <section className="admin-content">
          {loading ? (
            <div className="admin-empty">{t('common.loading')}</div>
          ) : (
            <div className="evs-editor">
              <div className="evs-grid">
                <label className="admin-detail-field"><span>{t('snd.name_label')}</span>
                  <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} /></label>
                <label className="admin-detail-field"><span>{t('snd.service_type_label')}</span>
                  <select className="input" value={form.type} onChange={(e) => set('type', e.target.value)}>
                    {SERVICE_TYPES.map((st) => <option key={st.value} value={st.value}>{optLabel(st.value, st.label)}</option>)}
                  </select></label>
              </div>

              {needsApiKey && (
                <label className="admin-detail-field admin-detail-field-full evs-field"><span>{t('snd.api_key_label')}</span>
                  <input className="input" type="password" value={form.api_key} onChange={(e) => set('api_key', e.target.value)} /></label>
              )}

              <h2 className="sq-section-title evs-section">{t('snd.checking_limit')}</h2>
              <p className="evs-muted">
                {t('snd.checking_limit_desc_pre')} <strong>{t('snd.checking_limit_desc_example')}</strong>{t('snd.checking_limit_desc_mid')} <strong>{t('snd.limit_value_eq')}</strong>,
                <strong> {t('snd.limit_base_eq')}</strong>{t('snd.checking_limit_desc_and')} <strong>{t('snd.limit_unit_eq')}</strong> {t('snd.checking_limit_desc_post')}
              </p>
              <div className="evs-grid evs-grid-3">
                <label className="admin-detail-field"><span>{t('snd.limit_value_label')}</span>
                  <input className="input" type="number" value={form.limit_value} onChange={(e) => set('limit_value', e.target.value)} /></label>
                <label className="admin-detail-field"><span>{t('snd.limit_base_label')}</span>
                  <input className="input" type="number" value={form.limit_base} onChange={(e) => set('limit_base', e.target.value)} /></label>
                <label className="admin-detail-field"><span>{t('snd.limit_time_unit_label')}</span>
                  <select className="input" value={form.limit_unit} onChange={(e) => set('limit_unit', e.target.value)}>
                    {UNITS.map((u) => <option key={u.value} value={u.value}>{optLabel(u.value, u.label)}</option>)}
                  </select></label>
              </div>

              <div className="evs-actions">
                <button type="button" className="btn-danger" onClick={save} disabled={saving}>{saving ? t('subs.saving') : t('common.save')}</button>
                <button type="button" className="btn-secondary" onClick={() => navigate(listPath)}>{t('common.cancel')}</button>
              </div>
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
};

export default VerificationServerEditorPage;
