import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { listsApi } from '../../api/services';
import { useTranslation } from '../../i18n';

// Public double opt-in confirmation landing page.
const PublicConfirmPage = () => {
  const { t } = useTranslation();
  const { token } = useParams();
  const [state, setState] = useState('loading'); // loading | done | error
  const [message, setMessage] = useState('');

  useEffect(() => {
    listsApi.confirmSubscriber(token)
      .then(({ data }) => { setMessage(data.message || t('pub.subscription_confirmed_msg')); setState('done'); })
      .catch((err) => { setMessage(err.response?.data?.message || t('pub.confirm_invalid')); setState('error'); });
  }, [token]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f6f9', padding: 20 }}>
      <div style={{ maxWidth: 440, width: '100%', background: '#fff', color: '#1a1a1a', borderRadius: 12, padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>{state === 'done' ? '✅' : state === 'error' ? '⚠️' : '⏳'}</div>
        <h1 style={{ fontSize: 22, margin: '0 0 8px' }}>
          {state === 'done' ? t('pub.subscription_confirmed') : state === 'error' ? t('pub.confirmation_failed') : t('pub.confirming')}
        </h1>
        <p style={{ color: '#64748b' }}>{message}</p>
        <p style={{ color: '#94a3b8', marginTop: 16, fontSize: 12 }}>{t('pub.powered_by')}</p>
      </div>
    </div>
  );
};

export default PublicConfirmPage;
