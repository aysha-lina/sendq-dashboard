import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { adminApi } from '../../api/services';
import { Spinner, toast } from '../../components/ui';
import { useTranslation } from '../../i18n';


const TAB_DEFS = [
  { key: 'general', labelKey: 'ade.plan.tab_general', labelEn: 'General' },
  { key: 'settings', labelKey: 'ade.plan.tab_settings', labelEn: 'Settings' },
  { key: 'sending', labelKey: 'ade.plan.tab_sending', labelEn: 'Sending server' },
  { key: 'verification', labelKey: 'ade.plan.tab_verification', labelEn: 'Email verification' },
];

const BILLING_CYCLES = [
  { label: 'Monthly', labelKey: 'ade.cycle_monthly', amount: '1', unit: 'month' },
  { label: 'Quarterly', labelKey: 'ade.cycle_quarterly', amount: '3', unit: 'month' },
  { label: 'Yearly', labelKey: 'ade.cycle_yearly', amount: '1', unit: 'year' },
  { label: 'Weekly', labelKey: 'ade.cycle_weekly', amount: '1', unit: 'week' },
  { label: 'Daily', labelKey: 'ade.cycle_daily', amount: '1', unit: 'day' },
];
const cycleFromPlan = (p) => (BILLING_CYCLES.find((c) => c.amount === String(p.frequency_amount) && c.unit === p.frequency_unit) || BILLING_CYCLES[0]).label;

const PlanEditorPage = () => {
  const { t } = useTranslation();
  const { uid } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = TAB_DEFS.some((td) => td.key === searchParams.get('tab')) ? searchParams.get('tab') : 'general';
  const TABS = TAB_DEFS.map((td) => ({ ...td, label: t(td.labelKey, null, td.labelEn) }));

  const [currencies, setCurrencies] = useState([]);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([adminApi.planDetail(uid), adminApi.currencies({ per_page: 100 })])
      .then(([{ data: p }, { data: cur }]) => {
        setCurrencies(cur.data || []);
        setForm({
          name: p.name || '', description: p.description || '', price: p.price ?? 0,
          currency_id: p.currency_id ? String(p.currency_id) : '', cycle: cycleFromPlan(p),
          sending_credits: p.sending_credits === 'unlimited' ? '' : (p.sending_credits ?? ''),
          unlimited_credits: p.sending_credits === 'unlimited' || p.sending_credits == null,
          subscriber_limit: p.subscriber_limit ?? 0, delivery: p.delivery || 'smtp',
          daily_email_limit: p.daily_email_limit ?? 0, status: p.status || 'active',
          currency: p.currency, frequency_amount: p.frequency_amount, frequency_unit: p.frequency_unit,
        });
      })
      .catch(() => navigate('/admin/plans'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [uid]);  

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setTab = (k) => setSearchParams({ tab: k });

  const save = async () => {
    const cyc = BILLING_CYCLES.find((c) => c.label === form.cycle) || BILLING_CYCLES[0];
    setSaving(true);
    try {
      await adminApi.updatePlan(uid, {
        name: form.name, description: form.description, price: form.price,
        currency_id: form.currency_id || null, frequency_amount: cyc.amount, frequency_unit: cyc.unit,
        sending_credits: form.unlimited_credits ? 'unlimited' : (Number(form.sending_credits) || 0),
        subscriber_limit: Number(form.subscriber_limit) || 0, delivery: form.delivery,
        daily_email_limit: Number(form.daily_email_limit) || 0, status: form.status,
      });
      toast.success(t('ade.plan.saved', null, 'Plan saved.'));
      load();
    } catch (err) { toast.error(err.response?.data?.message || t('ade.save_failed', null, 'Save failed.')); } finally { setSaving(false); }
  };

  const cur = form && (form.currency || currencies.find((c) => String(c.id) === form.currency_id)?.code || 'OMR');
  const cyc = form && (BILLING_CYCLES.find((c) => c.label === form.cycle) || BILLING_CYCLES[0]);

  return (
    <AppLayout>
      <div className="admin-page">
        <header className="admin-header">
          <nav>
            <button type="button" onClick={() => navigate('/dashboard')}>{t('ade.breadcrumb_home', null, 'Home')}</button>
            <span>›</span>
            <button type="button" onClick={() => navigate('/admin/plans')}>{t('ade.plan.breadcrumb_manage', null, 'Manage Plans')}</button>
            <span>›</span>
            <span>{form?.name || t('ade.plan.plan', null, 'Plan')}</span>
          </nav>
          {!loading && <h1>{form?.name || t('ade.plan.plan', null, 'Plan')}</h1>}
        </header>

        <section className="admin-content">
          {loading || !form ? (
            <div className="admin-empty"><Spinner size="lg" /></div>
          ) : (
            <>
              <ul className="campaign-detail-tabs admin-detail-tabs">
                {TABS.map((td) => (
                  <li key={td.key} className={tab === td.key ? 'active' : ''}>
                    <button type="button" onClick={() => setTab(td.key)}>{td.label}</button>
                  </li>
                ))}
              </ul>

              {tab === 'general' && (
                <>
                  <h2 className="sq-section-title">{t('ade.plan.overview', null, 'Overview')}</h2>
                  <div className="plan-overview-grid">
                    <div className="plan-overview-card"><strong>{form.name}</strong><span>{t('ade.plan.plan', null, 'Plan')}</span></div>
                    <div className="plan-overview-card"><strong className="plan-overview-accent">{cur} {form.price}</strong><span>{t('ade.plan.per_period', { amount: cyc.amount, unit: cyc.unit }, `per ${cyc.amount} ${cyc.unit}(s)`)}</span></div>
                    <div className="plan-overview-card"><strong className="plan-overview-accent">{form.unlimited_credits ? t('ade.plan.unlimited', null, 'Unlimited') : Number(form.sending_credits || 0).toLocaleString()}</strong><span>{t('ade.plan.sending_credits', null, 'Sending credits')}</span></div>
                    <div className="plan-overview-card"><strong className="plan-overview-accent">{form.delivery === 'customer' ? t('ade.plan.custom', null, 'Custom') : t('ade.plan.smtp', null, 'SMTP')}</strong><span>{t('ade.plan.delivery', null, 'Delivery')}</span></div>
                  </div>

                  <h2 className="sq-section-title plan-details-title">{t('ade.plan.plan_details', null, 'Plan Details')}</h2>
                  <div className="admin-detail-form admin-detail-narrow">
                    <label className="admin-detail-field admin-detail-field-full"><span>{t('common.name', null, 'Name')}</span>
                      <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} /></label>
                    <label className="admin-detail-field admin-detail-field-full"><span>{t('ade.plan.description', null, 'Description')}</span>
                      <input className="input" value={form.description} onChange={(e) => set('description', e.target.value)} /></label>
                    <label className="admin-detail-field admin-detail-field-full"><span>{t('ade.plan.price', null, 'Price')}</span>
                      <input className="input" type="number" value={form.price} onChange={(e) => set('price', e.target.value)} /></label>
                    <label className="admin-detail-field admin-detail-field-full"><span>{t('ade.plan.currency', null, 'Currency')}</span>
                      <select className="input" value={form.currency_id} onChange={(e) => set('currency_id', e.target.value)}>
                        {currencies.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                      </select></label>
                    <label className="admin-detail-field admin-detail-field-full"><span>{t('ade.plan.billing_cycle', null, 'Billing cycle')}</span>
                      <select className="input" value={form.cycle} onChange={(e) => set('cycle', e.target.value)}>
                        {BILLING_CYCLES.map((c) => <option key={c.label} value={c.label}>{t(c.labelKey, null, c.label)}</option>)}
                      </select></label>
                  </div>
                  <div className="admin-detail-actions"><button type="button" className="btn-primary" onClick={save} disabled={saving}>{saving ? t('ade.saving', null, 'Saving…') : t('common.save', null, 'Save')}</button></div>
                </>
              )}

              {tab === 'settings' && (
                <div className="admin-detail-form admin-detail-narrow">
                  <h2 className="sq-section-title">{t('ade.plan.settings', null, 'Settings')}</h2>
                  <label className="plan-dialog-check">
                    <input type="checkbox" checked={form.unlimited_credits} onChange={(e) => set('unlimited_credits', e.target.checked)} /> {t('ade.plan.unlimited_sending_credits', null, 'Unlimited sending credits')}
                  </label>
                  {!form.unlimited_credits && (
                    <label className="admin-detail-field admin-detail-field-full"><span>{t('ade.plan.sending_credits', null, 'Sending credits')}</span>
                      <input className="input" type="number" value={form.sending_credits} onChange={(e) => set('sending_credits', e.target.value)} /></label>
                  )}
                  <label className="admin-detail-field admin-detail-field-full"><span>{t('ade.plan.subscriber_limit', null, 'Subscriber limit')}</span>
                    <input className="input" type="number" value={form.subscriber_limit} onChange={(e) => set('subscriber_limit', e.target.value)} /></label>
                  <label className="admin-detail-field admin-detail-field-full"><span>{t('ade.plan.daily_email_limit', null, 'Daily email limit')}</span>
                    <input className="input" type="number" value={form.daily_email_limit} onChange={(e) => set('daily_email_limit', e.target.value)} /></label>
                  <label className="admin-detail-field admin-detail-field-full"><span>{t('common.status', null, 'Status')}</span>
                    <select className="input" value={form.status} onChange={(e) => set('status', e.target.value)}>
                      <option value="active">{t('ade.plan.active', null, 'Active')}</option><option value="inactive">{t('ade.plan.inactive', null, 'Inactive')}</option>
                    </select></label>
                  <div className="admin-detail-actions"><button type="button" className="btn-primary" onClick={save} disabled={saving}>{saving ? t('ade.saving', null, 'Saving…') : t('common.save', null, 'Save')}</button></div>
                </div>
              )}

              {tab === 'sending' && (
                <div className="admin-detail-form admin-detail-narrow">
                  <h2 className="sq-section-title">{t('ade.plan.sending_server', null, 'Sending server')}</h2>
                  <label className="admin-detail-field admin-detail-field-full"><span>{t('ade.plan.delivery_method', null, 'Delivery method')}</span>
                    <select className="input" value={form.delivery} onChange={(e) => set('delivery', e.target.value)}>
                      <option value="smtp">{t('ade.plan.delivery_smtp', null, 'Use SMTP for email delivery')}</option>
                      <option value="customer">{t('ade.plan.delivery_customer', null, "Use customer's delivery servers")}</option>
                    </select></label>
                  <div className="admin-detail-actions"><button type="button" className="btn-primary" onClick={save} disabled={saving}>{saving ? t('ade.saving', null, 'Saving…') : t('common.save', null, 'Save')}</button></div>
                </div>
              )}

              {tab === 'verification' && (
                <div className="admin-detail-form admin-detail-narrow">
                  <h2 className="sq-section-title">{t('ade.plan.email_verification', null, 'Email verification')}</h2>
                  <p className="admin-recent-intro">{t('ade.plan.evp_alloc_hint', null, 'Email-verification credit allocation for this plan.')}</p>
                  <div className="admin-detail-actions"><button type="button" className="btn-primary" onClick={save} disabled={saving}>{saving ? t('ade.saving', null, 'Saving…') : t('common.save', null, 'Save')}</button></div>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </AppLayout>
  );
};

export default PlanEditorPage;
