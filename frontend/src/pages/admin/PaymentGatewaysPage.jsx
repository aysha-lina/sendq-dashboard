import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { adminApi } from '../../api/services';
import { Spinner, toast } from '../../components/ui';
import useClickOutside from '../../hooks/useClickOutside';
import { useTranslation } from '../../i18n';

const formatDate = (v) => { const d = new Date(v); return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString('sv').slice(0, 16); };

const GatewayIcon = ({ type }) => {
  if (type === 'paymob') return <span className="pg-icon" style={{ background: '#0b2a4a', color: '#fff', fontSize: 13, fontWeight: 700 }}>Paymob</span>;
  if (type === 'paypal') return <span className="pg-icon" style={{ background: '#fff' }}><span style={{ color: '#003087', fontWeight: 800, fontStyle: 'italic' }}>Pay</span><span style={{ color: '#009cde', fontWeight: 800, fontStyle: 'italic' }}>Pal</span></span>;
  return <span className="pg-icon" style={{ background: 'rgba(148,163,184,.15)' }}><span className="material-symbols-rounded">currency_exchange</span></span>;
};

const Row = ({ g, onEdit, onStatus, onDelete }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false), open);
  return (
    <div className="pgw-row">
      <GatewayIcon type={g.type} />
      <div className="pgw-cell"><strong className="pgw-muted">{g.name}</strong><span>{t('common.name', null, 'Name')}</span></div>
      <div className="pgw-cell pgw-desc"><span className="pgw-desctext">{g.description}</span><span>{t('ase.description', null, 'Description')}</span></div>
      <div className="pgw-cell"><strong>{formatDate(g.created_at)}</strong><span>{t('ase.created_at', null, 'Created at')}</span></div>
      <span className={`admin-status-badge admin-status-${g.status}`}>{g.status}</span>
      <div className="pgw-actions">
        <button type="button" className="btn-secondary" onClick={() => onEdit(g)}>
          <span className="material-symbols-rounded">edit</span> {t('common.edit', null, 'Edit')}
        </button>
        <div ref={ref} className="admin-dd">
          <button type="button" className="btn-secondary admin-icon-btn" onClick={() => setOpen((v) => !v)}><span className="admin-caret">⌄</span></button>
          {open && (
            <div className="admin-dd-menu admin-dd-menu-end">
              <button type="button" onClick={() => { setOpen(false); onStatus(g, g.status === 'active' ? 'disable' : 'enable'); }}><span className="material-symbols-rounded">{g.status === 'active' ? 'hide_source' : 'play_arrow'}</span> {g.status === 'active' ? t('ase.disable', null, 'Disable') : t('ase.enable', null, 'Enable')}</button>
              <button type="button" onClick={() => { setOpen(false); onDelete(g); }}><span className="material-symbols-rounded">delete_outline</span> {t('common.delete', null, 'Delete')}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const PgSettings = () => {
  const { t } = useTranslation();
  const [vals, setVals] = useState({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    adminApi.settings().then(({ data }) => {
      const m = {}; (data.data || []).forEach((s) => { m[s.name] = s.value; }); setVals(m);
    }).catch(() => {});
  }, []);
  const v = (k, d = '') => (vals[k] !== undefined && vals[k] !== null ? vals[k] : d);
  const set = (k, val) => setVals((p) => ({ ...p, [k]: val }));
  const Toggle = ({ k }) => {
    const on = v(k) === '1';
    return <button type="button" className={`admin-switch ${on ? 'is-on' : ''}`} onClick={() => set(k, on ? '0' : '1')}><span /></button>;
  };
  const save = async () => {
    setSaving(true);
    try { await adminApi.updateSettings(vals); toast.success(t('ase.settings_saved', null, 'Settings saved.')); }
    catch (err) { toast.error(err.response?.data?.message || t('ase.save_failed', null, 'Save failed.')); } finally { setSaving(false); }
  };
  return (
    <div className="pgs">
      <div className="pgs-row">
        <div><strong>{t('ase.allowed_due_subscription', null, 'Allowed due subscription')}</strong><p>{t('ase.allowed_due_subscription_desc', null, 'Do not automatically suspend the subscription if the payment is already due. Users can still access all the functionality.')}</p></div>
        <Toggle k="pg_allowed_due_subscription" />
      </div>
      <div className="pgs-row">
        <div><strong>{t('ase.skip_card_trial', null, 'Do not require user to enter a credit card for trial period')}</strong><p>{t('ase.skip_card_trial_desc', null, 'When customers subscribe to a plan that has a trial period, by default they need to enter their card information (only payment supports auto-charge) so they will be auto-charged for the next period. Turn this option on for skipping the card information step when subscribing to a plan with a trial period. They will need to enter their card later when reaching the end of the trial period.')}</p></div>
        <Toggle k="pg_skip_card_trial" />
      </div>
      <h3 className="pgs-head">{t('ase.renewal_invoices_billing_date', null, 'Renewal invoices billing date:')}</h3>
      <p className="set-muted" style={{ maxWidth: 900 }}>{t('ase.renewal_billing_desc', null, "If your customers' selected payment gateway supports auto billing and if the customers have previously stored a payment method, a credit or debit card for example, then you can specify a timeframe for the application to automatically charge your customers' card.")}</p>
      <p className="pgs-inline">{t('ase.automatically_charge_renewal', null, 'Automatically charge a renewal invoice')} <input className="input" type="number" min="0" style={{ width: 90 }} value={v('pg_renewal_days_before', '1')} onChange={(e) => set('pg_renewal_days_before', e.target.value)} /> {t('ase.days_before_expiry', null, 'days before expiry date')}</p>
      <div className="pgs-actions"><button type="button" className="btn-secondary" onClick={save} disabled={saving}>{saving ? t('ase.saving', null, 'Saving…') : t('common.save', null, 'Save')}</button></div>
    </div>
  );
};

const PaymentGatewaysPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [tab, setTab] = useState('gateways');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('name');
  const [dir, setDir] = useState('asc');
  const [keyword, setKeyword] = useState('');

  const load = () => adminApi.paymentGatewaysList()
    .then(({ data }) => setRows(data.data || []))
    .catch(() => toast.error(t('ase.failed_to_load', null, 'Failed to load.')))
    .finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let v = rows;
    const kw = keyword.trim().toLowerCase();
    if (kw) v = v.filter((g) => `${g.name} ${g.description || ''}`.toLowerCase().includes(kw));
    v = [...v].sort((a, b) => { const cmp = String(sort === 'name' ? a.name : a.created_at).localeCompare(String(sort === 'name' ? b.name : b.created_at)); return dir === 'desc' ? -cmp : cmp; });
    return v;
  }, [rows, keyword, sort, dir]);

  const onStatus = async (g, action) => { try { await adminApi.setPaymentGatewayStatus(g.uid, action); load(); } catch (err) { toast.error(err.response?.data?.message || t('ase.update_failed', null, 'Update failed.')); } };
  const onDelete = async (g) => { if (!window.confirm(t('ase.delete_confirm', { name: g.name }, 'Delete "{name}"?'))) return; try { await adminApi.deletePaymentGateway(g.uid); load(); toast.success(t('ase.deleted', null, 'Deleted.')); } catch (err) { toast.error(err.response?.data?.message || t('ase.delete_failed', null, 'Delete failed.')); } };

  return (
    <AppLayout>
      <div className="admin-page">
        <header className="admin-header">
          <nav><button type="button" onClick={() => navigate('/dashboard')}>{t('ase.home', null, 'Home')}</button></nav>
          <h1><span className="material-symbols-rounded">credit_card</span>{t('ase.payment_gateways', null, 'Payment gateways')}</h1>
        </header>

        <section className="admin-content">
          <div className="admin-tabbar">
            <button type="button" className={`admin-tab ${tab === 'gateways' ? 'is-active' : ''}`} onClick={() => setTab('gateways')}><span className="material-symbols-rounded">payments</span> {t('ase.payment_gateways', null, 'Payment gateways')}</button>
            <button type="button" className={`admin-tab ${tab === 'settings' ? 'is-active' : ''}`} onClick={() => setTab('settings')}><span className="material-symbols-rounded">tune</span> {t('ase.settings', null, 'Settings')}</button>
          </div>

          {tab === 'settings' ? (
            <PgSettings />
          ) : (
            <>
              <div className="pgw-head">
                <p>{t('ase.payment_gateways_intro', null, 'Payment gateways are used to process payments for your subscription plans. You can choose to use one or more payment gateways to accept payments from your customers.')}</p>
                <button type="button" className="btn-secondary" onClick={() => navigate('/admin/payment-gateways/new')}><span className="material-symbols-rounded">add</span> {t('ase.add_new_payment_gateway', null, 'Add new payment gateway')}</button>
              </div>

              <div className="admin-filter-bar">
                <span className="admin-filter-label">{t('ase.sort_by', null, 'Sort by')}</span>
                <select className="input" value={sort} onChange={(e) => setSort(e.target.value)}><option value="name">{t('common.name', null, 'Name')}</option><option value="created_at">{t('ase.created_at', null, 'Created at')}</option></select>
                <button type="button" className="btn-secondary admin-icon-btn" onClick={() => setDir((d) => (d === 'desc' ? 'asc' : 'desc'))}><span className="material-symbols-rounded">sort</span></button>
                <div className="admin-filter-search"><input className="input" placeholder={t('ase.type_to_search', null, 'Type to search')} value={keyword} onChange={(e) => setKeyword(e.target.value)} /><span className="material-symbols-rounded">search</span></div>
              </div>

              {loading ? <div className="admin-empty"><Spinner size="lg" /></div> : (
                <>
                  <div className="pgw-list">{filtered.map((g) => <Row key={g.uid} g={g} onEdit={(gw) => navigate(`/admin/payment-gateways/${gw.uid}/edit`)} onStatus={onStatus} onDelete={onDelete} />)}</div>
                  <div className="admin-cur-footer"><span>{t('ase.items_per_page', { count: 15 }, '{count} items per page')}</span><span className="admin-cur-footer-sep">|</span><span>{t('ase.pagination_range', { from: filtered.length ? 1 : 0, to: filtered.length, total: filtered.length }, 'From {from} to {to}. Total {total} records')}</span></div>
                </>
              )}
            </>
          )}
        </section>
      </div>
    </AppLayout>
  );
};

export default PaymentGatewaysPage;
