import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { PageHeader, Spinner, toast } from '../../components/ui';
import { billingApi, accountApi } from '../../api/services';
import { useTranslation } from '../../i18n';

const formatMoney = (amount, currency) => {
  const value = Number(amount) || 0;
  const code = (currency?.code || 'USD').toUpperCase();
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: code }).format(value);
  } catch {
    return `${code} ${value.toFixed(2)}`;
  }
};

const formatDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
};

const UsageBar = ({ used, limit, label }) => {
  const { t } = useTranslation();
  const unlimited = limit === -1 || limit === null;
  const percent = unlimited ? 0 : Math.min(Math.round((used / Math.max(limit, 1)) * 100), 100);
  const isWarning = !unlimited && percent >= 80;
  const isDanger = !unlimited && percent >= 95;

  return (
    <div className="billing-usage-bar-wrap">
      <div className="billing-usage-bar-head">
        <span>{label}</span>
        <span className={`billing-usage-count ${isDanger ? 'danger' : isWarning ? 'warning' : ''}`}>
          {unlimited ? t('bil.unlimited') : `${used.toLocaleString()} / ${limit.toLocaleString()}`}
        </span>
      </div>
      {!unlimited && (
        <div className="billing-usage-track">
          <div
            className={`billing-usage-fill ${isDanger ? 'danger' : isWarning ? 'warning' : ''}`}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
      {unlimited && (
        <div className="billing-usage-track">
          <div className="billing-usage-fill unlimited" style={{ width: '100%' }} />
        </div>
      )}
    </div>
  );
};

const StatCard = ({ icon, label, value }) => (
  <div className="billing-stat-card">
    <span className="material-symbols-rounded billing-stat-icon">{icon}</span>
    <strong className="billing-stat-value">{value?.toLocaleString() ?? 0}</strong>
    <span className="billing-stat-label">{label}</span>
  </div>
);

const FeatureTag = ({ label }) => (
  <span className="billing-feature-tag">
    <span className="material-symbols-rounded">check_circle</span>
    {label}
  </span>
);

const featureLabelKeys = {
  campaigns: 'bil.feature_campaigns',
  subscribers: 'bil.feature_subscribers',
  analytics: 'bil.feature_analytics',
  billing: 'bil.feature_billing',
};
const featureLabel = (t, f) => (featureLabelKeys[f] ? t(featureLabelKeys[f]) : f);

const BillingPage = () => {
  const { t } = useTranslation();
  const [billing, setBilling] = useState(null);
  const [overview, setOverview] = useState(null);
  const [plans, setPlans] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [creditPlans, setCreditPlans] = useState([]);
  const [credits, setCredits] = useState(0);
  const [buyingCredit, setBuyingCredit] = useState(null);
  const [stripeReady, setStripeReady] = useState(false);
  const [paypalReady, setPaypalReady] = useState(false);
  const [paymobReady, setPaymobReady] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [banner, setBanner] = useState(null); // { type: 'success'|'error', text }
  const [actionPlanId, setActionPlanId] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const loadAll = () => Promise.all([
    billingApi.current(),
    accountApi.overview(),
    billingApi.planList().catch(() => ({ data: { plans: [] } })),
    billingApi.invoices().catch(() => ({ data: { invoices: [] } })),
    billingApi.creditPlans().catch(() => ({ data: { data: [] } })),
    billingApi.credits().catch(() => ({ data: { credits: 0 } })),
  ]).then(([billingRes, overviewRes, plansRes, invoicesRes, creditPlansRes, creditsRes]) => {
    setBilling(billingRes.data);
    setOverview(overviewRes.data);
    setPlans(plansRes.data.plans || []);
    setStripeReady(Boolean(plansRes.data.stripeConfigured));
    setPaypalReady(Boolean(plansRes.data.paypalConfigured));
    setPaymobReady(Boolean(plansRes.data.paymobConfigured));
    setOfflineReady(Boolean(plansRes.data.offlineEnabled));
    setInvoices(invoicesRes.data.invoices || []);
    setCreditPlans(creditPlansRes.data.data || []);
    setCredits(creditsRes.data.credits || 0);
  });

  useEffect(() => {
    loadAll()
      .catch(() => setError(t('bil.error_load')))
      .finally(() => setLoading(false));
  }, []);

  // Handle the PayPal approval redirect (?gateway=paypal&token=ORDERID).
  useEffect(() => {
    if (searchParams.get('gateway') !== 'paypal') return;
    const orderId = searchParams.get('token');
    searchParams.delete('gateway'); searchParams.delete('token'); searchParams.delete('PayerID');
    setSearchParams(searchParams, { replace: true });
    if (orderId) {
      billingApi.paypalConfirm(orderId)
        .then((res) => { setBanner({ type: 'success', text: res.data.message || t('bil.payment_confirmed') }); return loadAll(); })
        .catch((err) => setBanner({ type: 'error', text: err.response?.data?.message || t('bil.error_confirm_paypal') }));
    }
  }, [searchParams]);

  // Handle the Paymob return redirect (?gateway=paymob&success=…&hmac=…&…).
  useEffect(() => {
    if (searchParams.get('gateway') !== 'paymob') return;
    const params = {};
    searchParams.forEach((v, k) => { params[k] = v; });
    ['gateway'].forEach((k) => searchParams.delete(k));
    setSearchParams(searchParams, { replace: true });
    billingApi.paymobConfirm(params)
      .then((res) => { setBanner({ type: 'success', text: res.data.message || t('bil.payment_confirmed') }); return loadAll(); })
      .catch((err) => setBanner({ type: 'error', text: err.response?.data?.message || t('bil.error_confirm_paymob') }));
  }, [searchParams]);

  // Handle the Stripe Checkout redirect (?checkout=success&session_id=…).
  useEffect(() => {
    const status = searchParams.get('checkout');
    if (!status) return;
    if (status === 'cancel') {
      setBanner({ type: 'error', text: t('bil.checkout_cancelled') });
      searchParams.delete('checkout');
      setSearchParams(searchParams, { replace: true });
      return;
    }
    if (status === 'success') {
      const sessionId = searchParams.get('session_id');
      searchParams.delete('checkout');
      searchParams.delete('session_id');
      setSearchParams(searchParams, { replace: true });
      if (sessionId) {
        billingApi.confirm(sessionId)
          .then((res) => { setBanner({ type: 'success', text: res.data.message || t('bil.payment_confirmed') }); return loadAll(); })
          .catch((err) => setBanner({ type: 'error', text: err.response?.data?.message || t('bil.error_confirm') }));
      }
    }
  }, [searchParams]);

  const buyCredits = async (uid) => {
    setBuyingCredit(uid);
    setBanner(null);
    try {
      const { data } = await billingApi.buyCredits(uid);
      setCredits(data.credits ?? credits);
      setBanner({ type: 'success', text: data.message || t('bil.credits_added', null, 'Credits added.') });
      await loadAll();
    } catch (err) {
      setBanner({ type: 'error', text: err.response?.data?.message || t('bil.error_credits', null, 'Could not buy credits.') });
    } finally {
      setBuyingCredit(null);
    }
  };

  const choosePlan = async (planId) => {
    setActionPlanId(planId);
    setBanner(null);
    try {
      const { data } = await billingApi.checkout(planId);
      if (data.url) {
        window.location.href = data.url; // redirect to Stripe Checkout
      } else if (data.free) {
        setBanner({ type: 'success', text: data.message || t('bil.plan_activated') });
        await loadAll();
      }
    } catch (err) {
      setBanner({ type: 'error', text: err.response?.data?.message || t('bil.error_checkout') });
    } finally {
      setActionPlanId(null);
    }
  };

  const choosePlanPaypal = async (planId) => {
    setActionPlanId(planId);
    setBanner(null);
    try {
      const { data } = await billingApi.paypalCheckout(planId);
      if (data.url) {
        window.location.href = data.url;
      } else if (data.free) {
        setBanner({ type: 'success', text: data.message || t('bil.plan_activated') });
        await loadAll();
      }
    } catch (err) {
      setBanner({ type: 'error', text: err.response?.data?.message || t('bil.error_checkout_paypal') });
    } finally {
      setActionPlanId(null);
    }
  };

  // Paymob — redirect to the hosted iframe. On return, the redirect handler confirms.
  const choosePlanPaymob = async (planId) => {
    setActionPlanId(planId);
    setBanner(null);
    try {
      const { data } = await billingApi.paymobCheckout(planId);
      if (data.url) { window.location.href = data.url; }
      else if (data.free) { setBanner({ type: 'success', text: data.message || t('bil.plan_activated') }); await loadAll(); }
    } catch (err) {
      setBanner({ type: 'error', text: err.response?.data?.message || t('bil.error_checkout_paymob') });
    } finally {
      setActionPlanId(null);
    }
  };

  // Offline / manual — places a pending order for admin approval.
  const choosePlanOffline = async (planId) => {
    setActionPlanId(planId);
    setBanner(null);
    try {
      const { data } = await billingApi.offlineCheckout(planId);
      setBanner({ type: 'success', text: data.message || t('bil.order_placed') });
      await loadAll();
    } catch (err) {
      setBanner({ type: 'error', text: err.response?.data?.message || t('bil.error_place_order') });
    } finally {
      setActionPlanId(null);
    }
  };

  const cancelAutoRenew = async () => {
    if (!window.confirm(t('bil.confirm_cancel_autorenew'))) return;
    setBanner(null);
    try {
      const { data } = await billingApi.cancel();
      setBanner({ type: 'success', text: data.message });
      await loadAll();
    } catch (err) {
      setBanner({ type: 'error', text: err.response?.data?.message || t('bil.error_cancel') });
    }
  };

  const cancelImmediately = async () => {
    if (!window.confirm(t('bil.confirm_cancel_immediate'))) return;
    setBanner(null);
    try {
      const { data } = await billingApi.cancel({ immediate: true });
      setBanner({ type: 'success', text: data.message });
      await loadAll();
    } catch (err) {
      setBanner({ type: 'error', text: err.response?.data?.message || t('bil.error_cancel') });
    }
  };

  // Prorated mid-cycle plan change: preview the breakdown, confirm, then apply.
  const changePlan = async (planId) => {
    setActionPlanId(planId);
    setBanner(null);
    try {
      const { data: pv } = await billingApi.changePlan(planId, { preview: true });
      const lines = [
        t('bil.change_confirm_intro', { plan: pv.newPlan?.name }),
        t('bil.change_confirm_credit', { amount: pv.proration?.oldCredit ?? 0 }),
        pv.amountDue > 0
          ? t('bil.change_confirm_due', { amount: pv.amountDue })
          : t('bil.change_confirm_free'),
      ].join('\n');
      if (!window.confirm(lines)) { setActionPlanId(null); return; }
      const { data } = await billingApi.changePlan(planId);
      setBanner({ type: data.requiresPayment ? 'error' : 'success', text: data.message });
      await loadAll();
    } catch (err) {
      setBanner({ type: 'error', text: err.response?.data?.message || t('bil.error_change_plan') });
    } finally {
      setActionPlanId(null);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="billing-page">
          <PageHeader title={t('bil.title')} description={t('bil.subtitle')} />
          <div className="billing-loading"><Spinner size="lg" /></div>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="billing-page">
          <PageHeader title={t('bil.title')} description={t('bil.subtitle')} />
          <div className="billing-error">
            <span className="material-symbols-rounded">error_outline</span>
            <p>{error}</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  const plan = billing?.plan || { name: t('bil.free_plan_name'), dailyEmailLimit: 100, features: [] };
  const subscription = billing?.subscription || null;
  const sentToday = billing?.sentToday ?? 0;
  const usage = overview?.usage || { campaigns: 0, lists: 0, subscribers: 0 };

  const features = Array.isArray(plan.features)
    ? plan.features
    : typeof plan.features === 'string'
      ? plan.features.split(',').map((f) => f.trim()).filter(Boolean)
      : [];

  const endsAt = formatDate(subscription?.ends_at);
  const startsAt = formatDate(subscription?.starts_at);
  const isExpiringSoon = subscription?.ends_at
    && (new Date(subscription.ends_at) - new Date()) < 14 * 24 * 60 * 60 * 1000
    && new Date(subscription.ends_at) > new Date();

  return (
    <AppLayout>
      <div className="billing-page">
        <PageHeader title={t('bil.title')} description={t('bil.subtitle')} />

        {banner && (
          <div className={`billing-banner billing-banner-${banner.type}`}>
            <span className="material-symbols-rounded">{banner.type === 'success' ? 'check_circle' : 'error_outline'}</span>
            <p>{banner.text}</p>
            <button type="button" onClick={() => setBanner(null)} aria-label={t('bil.dismiss')}>✕</button>
          </div>
        )}

        {/* Current plan */}
        <section className="billing-section">
          <div className="billing-plan-card">
            <div className="billing-plan-head">
              <div className="billing-plan-name-wrap">
                <span className="material-symbols-rounded billing-plan-icon">workspace_premium</span>
                <div>
                  <h2 className="billing-plan-name">{plan.name}</h2>
                  <span className={`billing-plan-badge ${subscription ? 'active' : 'free'}`}>
                    {subscription ? t('bil.active_subscription') : t('bil.free_tier')}
                  </span>
                </div>
              </div>
              <div className="billing-plan-limit">
                <strong>{plan.dailyEmailLimit === -1 ? '∞' : plan.dailyEmailLimit?.toLocaleString()}</strong>
                <span>{t('bil.emails_per_day')}</span>
              </div>
            </div>

            {subscription?.is_recurring && (
              <div className="billing-plan-autorenew">
                <span className="material-symbols-rounded">autorenew</span>
                <span>{t('bil.auto_renews')}</span>
                <button type="button" className="btn-secondary" onClick={cancelAutoRenew}>{t('bil.cancel_auto_renew')}</button>
                <button type="button" className="btn-secondary billing-cancel-now" onClick={cancelImmediately}>{t('bil.cancel_immediate')}</button>
              </div>
            )}
            {subscription && !subscription.is_recurring && (
              <div className="billing-plan-autorenew billing-plan-autorenew-off">
                <button type="button" className="btn-secondary billing-cancel-now" onClick={cancelImmediately}>{t('bil.cancel_immediate')}</button>
              </div>
            )}
            {subscription && !subscription.is_recurring && endsAt && (
              <div className="billing-plan-autorenew billing-plan-autorenew-off">
                <span className="material-symbols-rounded">info</span>
                <span>{t('bil.auto_renew_off', { date: endsAt })}</span>
              </div>
            )}

            {(startsAt || endsAt) && (
              <div className="billing-plan-dates">
                {startsAt && (
                  <span>
                    <span className="material-symbols-rounded">calendar_today</span>
                    {t('bil.started', { date: startsAt })}
                  </span>
                )}
                {endsAt && (
                  <span className={isExpiringSoon ? 'expiring-soon' : ''}>
                    <span className="material-symbols-rounded">{isExpiringSoon ? 'warning' : 'event'}</span>
                    {isExpiringSoon ? t('bil.expires', { date: endsAt }) : t('bil.renews', { date: endsAt })}
                  </span>
                )}
              </div>
            )}

            {features.length > 0 && (
              <div className="billing-features">
                {features.map((f) => (
                  <FeatureTag key={f} label={featureLabel(t, f)} />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Daily usage */}
        <section className="billing-section">
          <h3 className="billing-section-title">
            <span className="material-symbols-rounded">send</span>
            {t('bil.todays_sending_usage')}
          </h3>
          <div className="billing-usage-card">
            <UsageBar
              used={sentToday}
              limit={plan.dailyEmailLimit}
              label={t('bil.emails_sent_today')}
            />
            {plan.dailyEmailLimit !== -1 && (
              <p className="billing-usage-hint">
                {t('bil.usage_resets_hint', { count: Math.max(plan.dailyEmailLimit - sentToday, 0).toLocaleString() })}
              </p>
            )}
          </div>
        </section>

        {/* Account stats */}
        <section className="billing-section">
          <h3 className="billing-section-title">
            <span className="material-symbols-rounded">bar_chart</span>
            {t('bil.account_usage')}
          </h3>
          <div className="billing-stats-grid">
            <StatCard icon="campaign" label={t('bil.campaigns')} value={usage.campaigns} />
            <StatCard icon="list_alt" label={t('bil.mail_lists')} value={usage.lists} />
            <StatCard icon="group" label={t('bil.subscribers')} value={usage.subscribers} />
          </div>
        </section>

        {/* Available plans */}
        {plans.length > 0 && (
          <section className="billing-section">
            <h3 className="billing-section-title">
              <span className="material-symbols-rounded">workspace_premium</span>
              {t('bil.available_plans')}
            </h3>
            {!stripeReady && !paypalReady && !paymobReady && (
              <p className="billing-usage-hint">
                {t('bil.no_gateway_hint')}
              </p>
            )}
            <div className="billing-plans-grid">
              {plans.map((p) => {
                const isCurrent = subscription?.plan_id === p.id;
                const price = Number(p.price) || 0;
                const isFree = price <= 0 || p.no_payment_required_when_free;
                const planFeatures = Array.isArray(p.features)
                  ? p.features
                  : typeof p.features === 'string'
                    ? p.features.split(',').map((f) => f.trim()).filter(Boolean)
                    : [];
                return (
                  <div key={p.id} className={`billing-plan-option ${isCurrent ? 'current' : ''}`}>
                    <div className="billing-plan-option-head">
                      <h4>{p.name}</h4>
                      <div className="billing-plan-option-price">
                        <strong>{isFree ? t('bil.free') : formatMoney(price, p.currency)}</strong>
                        {!isFree && p.frequency_unit && <span>/ {p.frequency_amount || 1} {p.frequency_unit}</span>}
                      </div>
                    </div>
                    {p.description && <p className="billing-plan-option-desc">{p.description}</p>}
                    <ul className="billing-plan-option-meta">
                      <li><span className="material-symbols-rounded">send</span>
                        {t('bil.emails_per_day_count', { count: p.daily_email_limit === -1 ? t('bil.unlimited') : Number(p.daily_email_limit).toLocaleString() })}</li>
                      {planFeatures.map((f) => (
                        <li key={f}><span className="material-symbols-rounded">check</span>{featureLabel(t, f)}</li>
                      ))}
                    </ul>
                    {isCurrent ? (
                      <button type="button" className="btn-secondary" disabled>{t('bil.current_plan')}</button>
                    ) : isFree ? (
                      <button type="button" className="btn-primary" disabled={actionPlanId === p.id} onClick={() => choosePlan(p.id)}>
                        {actionPlanId === p.id ? t('bil.switching') : t('bil.switch_to_plan')}
                      </button>
                    ) : (
                      <div className="billing-plan-pay-buttons" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {subscription && (
                          <button type="button" className="btn-primary billing-change-plan" disabled={actionPlanId === p.id} onClick={() => changePlan(p.id)}>
                            {actionPlanId === p.id ? t('bil.switching') : t('bil.change_to_plan')}
                          </button>
                        )}
                        {stripeReady && (
                          <button type="button" className="btn-primary" disabled={actionPlanId === p.id} onClick={() => choosePlan(p.id)}>
                            {actionPlanId === p.id ? t('bil.redirecting') : t('bil.pay_with_card')}
                          </button>
                        )}
                        {paypalReady && (
                          <button type="button" className="btn-secondary" disabled={actionPlanId === p.id} onClick={() => choosePlanPaypal(p.id)}>
                            {actionPlanId === p.id ? t('bil.redirecting') : t('bil.pay_with_paypal')}
                          </button>
                        )}
                        {paymobReady && (
                          <button type="button" className="btn-secondary" disabled={actionPlanId === p.id} onClick={() => choosePlanPaymob(p.id)}>
                            {actionPlanId === p.id ? t('bil.redirecting') : t('bil.pay_with_paymob')}
                          </button>
                        )}
                        {offlineReady && (
                          <button type="button" className="btn-secondary" disabled={actionPlanId === p.id} onClick={() => choosePlanOffline(p.id)}>
                            {actionPlanId === p.id ? t('bil.placing') : t('bil.pay_offline')}
                          </button>
                        )}
                        {!stripeReady && !paypalReady && !paymobReady && !offlineReady && (
                          <button type="button" className="btn-primary" disabled>{t('bil.choose_plan')}</button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Sending credits */}
        {creditPlans.length > 0 && (
          <section className="billing-section">
            <h3 className="billing-section-title">{t('bil.sending_credits', null, 'Sending credits')}</h3>
            <p className="mb-4 text-base text-[#6b7280]">
              {t('bil.credits_balance', { n: Number(credits).toLocaleString() }, `Current balance: ${Number(credits).toLocaleString()} credits`)}
            </p>
            <div className="billing-plan-grid">
              {creditPlans.map((cp) => (
                <div key={cp.uid} className="billing-plan-card">
                  <h4 className="billing-plan-name">{cp.name}</h4>
                  <div className="billing-plan-price">{Number(cp.credits).toLocaleString()} <span>credits</span></div>
                  <div className="mb-4 text-lg font-semibold">{cp.price > 0 ? `${cp.price}` : t('bil.free', null, 'Free')}</div>
                  <button
                    type="button"
                    className="btn-primary w-full"
                    disabled={buyingCredit === cp.uid}
                    onClick={() => buyCredits(cp.uid)}
                  >
                    {buyingCredit === cp.uid ? t('bil.processing', null, 'Processing…') : t('bil.buy_credits', null, 'Buy credits')}
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Invoices */}
        {invoices.length > 0 && (
          <section className="billing-section">
            <h3 className="billing-section-title">
              <span className="material-symbols-rounded">receipt_long</span>
              {t('bil.invoices')}
            </h3>
            <div className="billing-table-wrap">
              <table className="billing-table">
                <thead>
                  <tr><th>{t('bil.col_date')}</th><th>{t('bil.col_description')}</th><th>{t('bil.col_amount')}</th><th>{t('common.status')}</th><th aria-label="Download" /></tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td>{formatDate(inv.created_at) || '-'}</td>
                      <td>{inv.title}</td>
                      <td>{formatMoney(inv.fee, inv.currency)}</td>
                      <td><span className={`billing-invoice-status ${inv.status}`}>{t(`bil.invoice_status_${inv.status}`, undefined, inv.status)}</span></td>
                      <td>
                        <button
                          type="button"
                          className="billing-invoice-pdf"
                          title={t('bil.download_pdf', null, 'Download PDF')}
                          onClick={async () => {
                            try {
                              const res = await billingApi.invoicePdf(inv.uid);
                              const url = URL.createObjectURL(res.data);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `invoice-${inv.number || inv.uid.slice(0, 8)}.pdf`;
                              document.body.appendChild(a); a.click(); a.remove();
                              URL.revokeObjectURL(url);
                            } catch {
                              toast.error(t('bil.invoice_pdf_failed', null, 'Could not download the invoice.'));
                            }
                          }}
                        >
                          <span className="material-symbols-rounded">download</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </AppLayout>
  );
};

export default BillingPage;
