import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { adminApi } from '../../api/services';
import { toast } from '../../components/ui';
import { useTranslation } from '../../i18n';

export const GATEWAY_DEFS = [
  { type: 'offline', name: 'Offline', desc: 'Receive payments outside of the application' },
  { type: 'stripe', name: 'Stripe', desc: 'Receive payments from Credit / Debit card to your Stripe account' },
  { type: 'paypal', name: 'Paypal', desc: 'PayPal is the fast/safe way to send money, make an online payment, receive money or set up a merchant account' },
  { type: 'paymob', name: 'Paymob', desc: 'Accept payments via Paymob - cards, mobile wallets, and local payment methods across the Middle East and Africa' },
];

export const GatewayIcon = ({ type }) => {
  if (type === 'paymob') return <span className="pg-icon pg-icon-lg" style={{ background: '#0b2a4a', color: '#fff', fontSize: 14, fontWeight: 700 }}>Paymob</span>;
  if (type === 'paypal') return <span className="pg-icon pg-icon-lg" style={{ background: '#fff' }}><span style={{ color: '#003087', fontWeight: 800, fontStyle: 'italic' }}>Pay</span><span style={{ color: '#009cde', fontWeight: 800, fontStyle: 'italic' }}>Pal</span></span>;
  if (type === 'stripe') return <span className="pg-icon pg-icon-lg" style={{ background: '#fff', color: '#635bff', fontWeight: 800, fontStyle: 'italic', fontSize: 18 }}>stripe</span>;
  return <span className="pg-icon pg-icon-lg" style={{ background: 'rgba(148,163,184,.15)' }}><span className="material-symbols-rounded">currency_exchange</span></span>;
};

const PaymentGatewayTypePage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [busy, setBusy] = useState('');

  const select = async (g) => {
    setBusy(g.type);
    try {
      await adminApi.createPaymentGateway({ name: g.name, type: g.type, description: g.desc });
      toast.success(t('ase.gateway_added', { name: g.name }, '{name} added.'));
      navigate('/admin/payment-gateways');
    } catch (err) {
      toast.error(err.response?.data?.message || t('ase.could_not_add_gateway', null, 'Could not add gateway.'));
      setBusy('');
    }
  };

  return (
    <AppLayout>
      <div className="admin-page">
        <header className="admin-header">
          <nav><button type="button" onClick={() => navigate('/dashboard')}>{t('ase.home', null, 'Home')}</button></nav>
          <h1><span className="material-symbols-rounded">payments</span>{t('ase.payment_gateways', null, 'Payment gateways')}</h1>
        </header>

        <section className="admin-content">
          <h2 className="set-edit-title">{t('ase.all_available_payment_gateways', null, 'All available payment gateways')}</h2>
          <p className="set-intro">{t('ase.gateway_type_intro_1', null, 'Connect with your preferred payment gateways to receive payments by your users')}<br />{t('ase.gateway_type_intro_2', null, 'Your users can pay by cash, Debit/Credit cards, PayPal, etc.')}</p>

          <div className="ss-type-list">
            {GATEWAY_DEFS.map((g) => (
              <div key={g.type} className="ss-type-row">
                <GatewayIcon type={g.type} />
                <div className="ss-type-main">
                  <button type="button" className="ss-type-name" onClick={() => select(g)}>{g.name}</button>
                  <p>{t(`ase.gateway_desc_${g.type}`, null, g.desc)}</p>
                </div>
                <button type="button" className="btn-danger" onClick={() => select(g)} disabled={busy === g.type}>{busy === g.type ? t('ase.adding', null, 'Adding…') : t('ase.select', null, 'Select')}</button>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 18 }}>
            <button type="button" className="btn-secondary" onClick={() => navigate('/admin/payment-gateways')}>{t('ase.go_back', null, 'Go back')}</button>
          </div>
        </section>
      </div>
    </AppLayout>
  );
};

export default PaymentGatewayTypePage;
