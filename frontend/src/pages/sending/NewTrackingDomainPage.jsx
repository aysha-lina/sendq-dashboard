import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { sendingApi } from '../../api/services';
import { useTranslation } from '../../i18n';

const NewTrackingDomainPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [scheme, setScheme] = useState('http');
  const [domain, setDomain] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    const name = domain.trim();
    if (!name) { setError(t('snd.domain_name_required')); return; }
    setSaving(true);
    setError('');
    try {
      await sendingApi.createTrackingDomain({ name, scheme, verification_method: 'host_redirect' });
      navigate('/sending/tracking-domains');
    } catch (err) {
      setError(err.response?.data?.message || t('snd.add_tracking_domain_failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <div className="sending-page">
        <header className="sending-page-title sending-compact-title">
          <nav>
            <span>{t('common.home')}</span>
            <span>&gt;</span>
            <button type="button" onClick={() => navigate('/sending/tracking-domains')}>{t('snd.tracking_domains')}</button>
          </nav>
          <h1>{t('snd.create_tracking_domain')}</h1>
        </header>

        <main className="sending-create-form">
          <p>
            {t('snd.tracking_domain_intro')}
          </p>

          <form onSubmit={handleSubmit}>
            <h3>{t('snd.domain_name')}</h3>
            <div className="td-domain-group">
              <select value={scheme} onChange={(e) => setScheme(e.target.value)}>
                <option value="http">HTTP</option>
                <option value="https">HTTPS</option>
              </select>
              <input
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="track.example.com"
                autoComplete="off"
              />
            </div>

            <div className="td-verify">
              <label className="td-verify-radio">
                <input type="radio" checked readOnly />
                <strong>{t('snd.host_redirect_verification')}</strong>
              </label>
              <p>
                {t('snd.host_redirect_verification_desc')}
              </p>
            </div>

            {error && <p style={{ color: '#e0414b', marginTop: '8px' }}>{error}</p>}

            <div className="sending-form-actions td-actions">
              <button type="submit" className="btn-primary" disabled={!domain.trim() || saving}>
                {saving ? t('subs.saving') : t('common.save')}
              </button>
              <button type="button" className="sending-link-button" onClick={() => navigate('/sending/tracking-domains')}>
                {t('common.cancel')}
              </button>
            </div>
          </form>
        </main>

        <footer className="sending-footer">{t('common.copyright')}</footer>
      </div>
    </AppLayout>
  );
};

export default NewTrackingDomainPage;
