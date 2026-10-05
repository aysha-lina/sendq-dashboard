import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { MaterialIcon, SendingDomainsTab } from './SendingDomainsPage';
import { sendingDomainsApi } from '../../api/services';
import { useTranslation } from '../../i18n';

const NewSendingDomainPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [domainName, setDomainName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    const cleanDomain = domainName.trim();
    if (!cleanDomain) return;

    setSaving(true);
    setError('');
    try {
      await sendingDomainsApi.create({ name: cleanDomain });
      navigate('/sending/domains');
    } catch (err) {
      setError(err.response?.data?.message || t('snd.add_domain_failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <div className="sending-page">
        <header className="sending-page-title">
          <nav>
            <span>{t('common.home')}</span>
            <span>&gt;</span>
            <button type="button" onClick={() => navigate('/sending/domains')}>{t('snd.domains')}</button>
          </nav>
          <h1>{t('snd.sending_identity')}</h1>
        </header>

        <SendingDomainsTab />

        <main className="sending-create-form">
          <h2>
            <MaterialIcon>add</MaterialIcon>
            {t('snd.new_sending_domain')}
          </h2>
          <p>
            {t('snd.sending_domain_intro_pre')}{' '}
            <span>{t('snd.from')}</span> {t('snd.sending_domain_intro_post')}
          </p>

          <form onSubmit={handleSubmit}>
            <h3>{t('snd.sending_domain')}</h3>
            <label htmlFor="domainName">
              {t('snd.domain_name')} <em>*</em>
            </label>
            <input
              id="domainName"
              value={domainName}
              onChange={(event) => setDomainName(event.target.value)}
              placeholder={t('snd.domain_name_placeholder')}
              autoComplete="off"
            />
            {error && <p style={{ color: '#e0414b', marginTop: '8px' }}>{error}</p>}
            <div className="sending-form-actions">
              <button type="submit" className="btn-primary" disabled={!domainName.trim() || saving}>
                {saving ? t('subs.saving') : t('common.save')}
              </button>
              <button type="button" className="sending-link-button" onClick={() => navigate('/sending/domains')}>
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

export default NewSendingDomainPage;
