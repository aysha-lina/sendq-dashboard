import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { adminApi } from '../../api/services';
import { Spinner, toast } from '../../components/ui';
import { GatewayIcon } from './PaymentGatewayTypePage';
import { useTranslation } from '../../i18n';

// Per-gateway "Service configuration" field schemas (matches the PHP edit screens).
const SCHEMAS = {
  paymob: [
    {
      key: 'region', label: 'Region', type: 'select',
      help: 'Select the Paymob region matching your merchant account.',
      options: [
        { value: 'oman.paymob.com', label: 'Oman (oman.paymob.com)' },
        { value: 'accept.paymob.com', label: 'Egypt (accept.paymob.com)' },
        { value: 'uae.paymob.com', label: 'UAE (uae.paymob.com)' },
        { value: 'ksa.paymob.com', label: 'Saudi Arabia (ksa.paymob.com)' },
        { value: 'pakistan.paymob.com', label: 'Pakistan (pakistan.paymob.com)' },
      ],
    },
    { key: 'integration_ids', label: 'Integration ID(s)', help: 'Enter your Paymob integration ID(s). For multiple integrations, separate with commas (e.g. 12345,67890)' },
    { key: 'public_key', label: 'Public Key' },
    { key: 'secret_key', label: 'Secret Key (API Key)' },
    { key: 'hmac_secret', label: 'HMAC Secret', help: 'Used to verify callback signatures. Found in your Paymob dashboard under Settings.' },
  ],
  paypal: [
    { key: 'environment', label: 'Environment', type: 'select', options: [{ value: 'production', label: 'Production' }, { value: 'sandbox', label: 'Sandbox' }] },
    { key: 'client_id', label: 'Client ID' },
    { key: 'secret', label: 'Secret' },
  ],
  stripe: [
    { key: 'secret_key', label: 'Secret Key' },
    { key: 'publishable_key', label: 'Publishable Key' },
    { key: 'webhook_secret', label: 'Webhook Secret' },
  ],
  offline: [],
};

const PaymentGatewayEditorPage = () => {
  const { t } = useTranslation();
  const { uid } = useParams();
  const navigate = useNavigate();
  const listPath = '/admin/payment-gateways';

  const [gw, setGw] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', gateway_data: {} });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminApi.paymentGatewayDetail(uid)
      .then(({ data }) => {
        setGw(data);
        setForm({ name: data.name || '', description: data.description || '', gateway_data: data.gateway_data || {} });
      })
      .catch(() => { toast.error(t('ase.failed_to_load_gateway', null, 'Failed to load gateway.')); navigate(listPath); })
      .finally(() => setLoading(false));
  }, [uid, navigate]);

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setData = (k, v) => setForm((f) => ({ ...f, gateway_data: { ...f.gateway_data, [k]: v } }));

  const save = async () => {
    if (!form.name.trim()) { toast.error(t('ase.name_is_required', null, 'Name is required.')); return; }
    setSaving(true);
    try {
      await adminApi.updatePaymentGateway(uid, { name: form.name, description: form.description, gateway_data: form.gateway_data });
      toast.success(t('ase.saved', null, 'Saved.'));
      navigate(listPath);
    } catch (err) {
      toast.error(err.response?.data?.message || t('ase.save_failed', null, 'Save failed.'));
    } finally { setSaving(false); }
  };

  if (loading) return <AppLayout><div className="admin-page"><div className="admin-empty"><Spinner size="lg" /></div></div></AppLayout>;

  const schema = SCHEMAS[gw?.type] || [];

  return (
    <AppLayout>
      <div className="admin-page">
        <header className="admin-header">
          <nav>
            <button type="button" onClick={() => navigate('/dashboard')}>{t('ase.home', null, 'Home')}</button>
            <span>›</span>
            <button type="button" onClick={() => navigate(listPath)}>{t('ase.payment_gateways', null, 'Payment gateways')}</button>
          </nav>
          <h1><span className="material-symbols-rounded">credit_card</span>{gw?.name}</h1>
        </header>

        <section className="admin-content">
          <div className="pge-head">
            <GatewayIcon type={gw?.type} />
            <div>
              <strong>{gw?.name}</strong>
              <p>{gw?.description}</p>
            </div>
          </div>

          <h2 className="set-edit-title pge-section">{t('ase.general', null, 'General')}</h2>
          <div className="pge-grid">
            <label className="admin-detail-field admin-detail-field-full"><span>{t('common.name', null, 'Name')}</span>
              <input className="input" value={form.name} onChange={(e) => setField('name', e.target.value)} /></label>
            <label className="admin-detail-field admin-detail-field-full"><span>{t('ase.description', null, 'Description')}</span>
              <input className="input" value={form.description} onChange={(e) => setField('description', e.target.value)} /></label>
          </div>

          {schema.length > 0 && (
            <>
              <h2 className="set-edit-title pge-section">{t('ase.service_configuration', null, 'Service configuration')}</h2>
              <div className="pge-grid">
                {schema.map((f) => (
                  <label key={f.key} className="admin-detail-field admin-detail-field-full">
                    <span>{t(`ase.pg_${gw.type}_${f.key}_label`, null, f.label)}</span>
                    {f.type === 'select' ? (
                      <select className="input" value={form.gateway_data[f.key] || ''} onChange={(e) => setData(f.key, e.target.value)}>
                        <option value="">{t('ase.choose', null, 'Choose')}</option>
                        {f.options.map((o) => <option key={o.value} value={o.value}>{t(`ase.pg_${gw.type}_${f.key}_opt_${o.value}`, null, o.label)}</option>)}
                      </select>
                    ) : (
                      <input className="input" value={form.gateway_data[f.key] || ''} onChange={(e) => setData(f.key, e.target.value)} autoComplete="off" />
                    )}
                    {f.help && <small className="pge-help">{t(`ase.pg_${gw.type}_${f.key}_help`, null, f.help)}</small>}
                  </label>
                ))}
              </div>
            </>
          )}

          <div className="pge-actions">
            <button type="button" className="btn-danger" onClick={save} disabled={saving}>{saving ? t('ase.saving', null, 'Saving…') : t('common.save', null, 'Save')}</button>
            <button type="button" className="btn-secondary" onClick={() => navigate(listPath)}>{t('common.cancel', null, 'Cancel')}</button>
          </div>
        </section>
      </div>
    </AppLayout>
  );
};

export default PaymentGatewayEditorPage;
