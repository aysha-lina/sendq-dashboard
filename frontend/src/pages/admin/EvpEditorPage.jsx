import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { adminApi } from '../../api/services';
import { Spinner, toast } from '../../components/ui';
import { useTranslation } from '../../i18n';

const BILLING_CYCLES = [
  { label: 'Monthly', labelKey: 'ade.cycle_monthly', amount: '1', unit: 'month' },
  { label: 'Quarterly', labelKey: 'ade.cycle_quarterly', amount: '3', unit: 'month' },
  { label: 'Yearly', labelKey: 'ade.cycle_yearly', amount: '1', unit: 'year' },
  { label: 'Weekly', labelKey: 'ade.cycle_weekly', amount: '1', unit: 'week' },
  { label: 'Daily', labelKey: 'ade.cycle_daily', amount: '1', unit: 'day' },
];
const cycleFrom = (a, u) => (BILLING_CYCLES.find((c) => c.amount === String(a) && c.unit === u) || BILLING_CYCLES[0]).label;

const EvpEditorPage = () => {
  const { t } = useTranslation();
  const { uid } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editing = Boolean(uid);

  const [currencies, setCurrencies] = useState([]);
  const [type, setType] = useState(searchParams.get('type') === 'one_time' ? 'one_time' : 'recurring');
  const [form, setForm] = useState({
    name: '', description: '', email_verification_credits: '', price: '', currency_id: '',
    cycle: 'Monthly', trial: false, trial_amount: 1, trial_unit: 'day',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const reqs = [adminApi.currencies({ per_page: 100 })];
    if (editing) reqs.push(adminApi.emailVerificationPlanDetail(uid));
    Promise.all(reqs)
      .then(([{ data: cur }, detail]) => {
        const list = cur.data || [];
        setCurrencies(list);
        if (editing && detail) {
          const p = detail.data;
          setType(p.type || 'recurring');
          setForm({
            name: p.name || '', description: p.description || '',
            email_verification_credits: p.email_verification_credits ?? '', price: p.price ?? '',
            currency_id: p.currency_id ? String(p.currency_id) : '',
            cycle: cycleFrom(p.frequency_amount, p.frequency_unit),
            trial: Boolean(p.trial_amount), trial_amount: p.trial_amount || 1, trial_unit: p.trial_unit || 'day',
          });
        } else {
          const omr = list.find((c) => (c.code || '').toUpperCase() === 'OMR');
          setForm((f) => ({ ...f, currency_id: String((omr || list[0])?.id || '') }));
        }
      })
      .catch(() => navigate('/admin/email-verification-plans'))
      .finally(() => setLoading(false));
  }, [uid, editing, navigate]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) { toast.error(t('ade.evp.name_required', null, 'Plan name is required.')); return; }
    const cyc = BILLING_CYCLES.find((c) => c.label === form.cycle) || BILLING_CYCLES[0];
    const payload = {
      name: form.name, description: form.description,
      email_verification_credits: form.email_verification_credits, price: form.price,
      currency_id: form.currency_id || null, type,
      frequency_amount: type === 'recurring' ? cyc.amount : null,
      frequency_unit: type === 'recurring' ? cyc.unit : null,
      trial_amount: form.trial ? form.trial_amount : null,
      trial_unit: form.trial ? form.trial_unit : null,
    };
    setSaving(true);
    try {
      if (editing) await adminApi.updateEmailVerificationPlan(uid, payload);
      else await adminApi.createEmailVerificationPlan(payload);
      toast.success(editing ? t('ade.evp.saved', null, 'Plan saved.') : t('ade.evp.created', null, 'Plan created.'));
      navigate('/admin/email-verification-plans');
    } catch (err) {
      toast.error(err.response?.data?.message || t('ade.save_failed', null, 'Save failed.'));
    } finally { setSaving(false); }
  };

  const crumbType = type === 'one_time' ? t('ade.evp.one_time_pay', null, 'One-time Pay') : t('ade.evp.recurring', null, 'Recurring');

  return (
    <AppLayout>
      <div className="admin-page">
        <header className="admin-header">
          <nav>
            <button type="button" onClick={() => navigate('/dashboard')}>{t('ade.breadcrumb_home', null, 'Home')}</button>
            <span>›</span>
            <button type="button" onClick={() => navigate('/admin/email-verification-plans')}>{t('ade.evp.breadcrumb', null, 'Email verification plans')}</button>
            <span>›</span>
            <span>{crumbType}</span>
          </nav>
          <h1><span className="material-symbols-rounded">mark_email_read</span>{editing ? (form.name || t('ade.evp.edit_plan', null, 'Edit plan')) : t('ade.evp.add_plan', null, 'Add new Plan')}</h1>
        </header>

        <section className="admin-content">
          {loading ? (
            <div className="admin-empty"><Spinner size="lg" /></div>
          ) : (
            <div className="admin-detail-form admin-detail-narrow">
              <h2 className="sq-section-title">{t('ade.evp.general', null, 'General')}</h2>
              <label className="admin-detail-field admin-detail-field-full"><span>{t('common.name', null, 'Name')}</span>
                <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} /></label>
              <label className="admin-detail-field admin-detail-field-full"><span>{t('ade.evp.description', null, 'Description')}</span>
                <input className="input" value={form.description} onChange={(e) => set('description', e.target.value)} /></label>
              <label className="admin-detail-field admin-detail-field-full"><span>{t('ade.evp.credits', null, 'Email verification credits')}</span>
                <input className="input" type="number" value={form.email_verification_credits} onChange={(e) => set('email_verification_credits', e.target.value)} /></label>

              <h2 className="sq-section-title" style={{ marginTop: 18 }}>{t('ade.evp.billing', null, 'Billing')}</h2>
              <div className="admin-detail-grid">
                <label className="admin-detail-field"><span>{t('ade.evp.price', null, 'Price')}</span>
                  <input className="input" type="number" value={form.price} onChange={(e) => set('price', e.target.value)} /></label>
                <label className="admin-detail-field"><span>{t('ade.evp.currency', null, 'Currency')}</span>
                  <select className="input" value={form.currency_id} onChange={(e) => set('currency_id', e.target.value)}>
                    {currencies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select></label>
              </div>
              {type === 'recurring' && (
                <label className="admin-detail-field admin-detail-field-full"><span>{t('ade.evp.billing_cycle', null, 'Billing cycle')}</span>
                  <select className="input" value={form.cycle} onChange={(e) => set('cycle', e.target.value)}>
                    {BILLING_CYCLES.map((c) => <option key={c.label} value={c.label}>{t(c.labelKey, null, c.label)}</option>)}
                  </select></label>
              )}
              <label className="plan-dialog-check">
                <input type="checkbox" checked={form.trial} onChange={(e) => set('trial', e.target.checked)} /> {t('ade.evp.enable_trial', null, 'Enable trial period')}
              </label>
              {form.trial && (
                <div className="plan-dialog-trial">
                  <span>{t('ade.evp.trial_period', null, 'Trial period (amount / time unit)')}</span>
                  <div className="plan-dialog-trial-row">
                    <input className="input" type="number" min="1" value={form.trial_amount} onChange={(e) => set('trial_amount', e.target.value)} />
                    <select className="input" value={form.trial_unit} onChange={(e) => set('trial_unit', e.target.value)}>
                      <option value="day">{t('ade.evp.unit_day', null, 'day')}</option><option value="week">{t('ade.evp.unit_week', null, 'week')}</option><option value="month">{t('ade.evp.unit_month', null, 'month')}</option><option value="year">{t('ade.evp.unit_year', null, 'year')}</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="admin-detail-actions">
                <button type="button" className="btn-danger" onClick={save} disabled={saving}>{saving ? t('ade.saving', null, 'Saving…') : t('common.save', null, 'Save')}</button>
                <button type="button" className="btn-secondary" onClick={() => navigate('/admin/email-verification-plans')} disabled={saving}>{t('common.cancel', null, 'Cancel')}</button>
              </div>
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
};

export default EvpEditorPage;
