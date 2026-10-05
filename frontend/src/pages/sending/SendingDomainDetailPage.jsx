import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { MaterialIcon, SendingDomainsTab } from './SendingDomainsPage';
import { sendingDomainsApi } from '../../api/services';
import { useTranslation } from '../../i18n';

const DnsStatus = ({ verified }) => {
  const { t } = useTranslation();
  return (
    <span className={verified ? 'sending-status sending-status-active' : 'sending-status'}>
      {verified ? t('snd.verified') : t('snd.pending')}
    </span>
  );
};

const SendingDomainDetailPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { id } = useParams();
  const [domain, setDomain] = useState(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    sendingDomainsApi.get(id)
      .then(({ data }) => setDomain(data))
      .catch(() => setDomain(null))
      .finally(() => setLoading(false));
  }, [id]);

  const verifyNow = async () => {
    if (!domain) return;
    setVerifying(true);
    setNotice('');
    try {
      const { data } = await sendingDomainsApi.verify(domain.id);
      setDomain(data);
      if (data.identityVerified && data.spfVerified) {
        setNotice(t('snd.domain_verified_success'));
      } else {
        setNotice(t('snd.verification_incomplete'));
      }
    } catch {
      setNotice(t('snd.verification_failed'));
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="sending-page">
          <header className="sending-page-title">
            <nav><span>{t('common.home')}</span><span>&gt;</span><button type="button" onClick={() => navigate('/sending/domains')}>{t('snd.domains')}</button></nav>
            <h1>{t('snd.sending_identity')}</h1>
          </header>
          <div className="sending-empty-list"><p>{t('common.loading')}</p></div>
        </div>
      </AppLayout>
    );
  }

  if (!domain) {
    return (
      <AppLayout>
        <div className="sending-page">
          <header className="sending-page-title">
            <nav><span>{t('common.home')}</span><span>&gt;</span><button type="button" onClick={() => navigate('/sending/domains')}>{t('snd.domains')}</button></nav>
            <h1>{t('snd.sending_identity')}</h1>
          </header>
          <div className="sending-empty-list">
            <MaterialIcon>public</MaterialIcon>
            <p>{t('snd.domain_not_available')}</p>
            <button type="button" className="btn-primary" onClick={() => navigate('/sending/domains')}>{t('snd.back_to_domains')}</button>
          </div>
        </div>
      </AppLayout>
    );
  }

  const records = [
    { type: 'TXT', host: domain.mxHost, value: domain.mxValue, verified: domain.identityVerified, label: t('snd.domain_verification') },
    { type: 'TXT', host: domain.spfHost, value: domain.spfValue, verified: domain.spfVerified, label: t('snd.spf_verification') },
    { type: 'TXT', host: domain.dkimHost, value: domain.dkimValue, zone: domain.dkimValueZone, verified: domain.dkimVerified, label: t('snd.dkim_verification', null, 'DKIM') },
    { type: 'TXT', host: domain.dmarcHost, value: domain.dmarcValue, verified: domain.dmarcVerified, label: t('snd.dmarc_verification', null, 'DMARC') },
  ];

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

        <main className="sending-domain-detail">
          <h2>
            <MaterialIcon>public</MaterialIcon>
            <span>{domain.name}</span>
          </h2>
          <p>
            {t('snd.sending_domain_intro_pre')}{' '}
            <span>{t('snd.from')}</span> {t('snd.sending_domain_intro_post')}
          </p>

          <p style={{ marginBottom: '16px', color: '#b8b8c2' }}>
            {t('snd.add_dns_records_pre')} <strong>{t('snd.verify_now')}</strong>{t('snd.add_dns_records_post')}
          </p>

          <div className="sending-records-panel">
            <div className="sending-records-head">
              <span>{t('snd.type_col')}</span>
              <span>{t('snd.hostname_col')}</span>
              <span>{t('snd.value_col')}</span>
              <span>{t('snd.status_col')}</span>
            </div>
            {records.map((record) => (
              <div key={record.label} className="sending-record-row">
                <span><b>{record.type}</b></span>
                <span style={{ wordBreak: 'break-all' }}>{record.host}</span>
                <span style={{ wordBreak: 'break-all' }}>
                  {record.value}
                  {record.zone && record.value.length > 255 && (
                    <span style={{ display: 'block', marginTop: 6, fontSize: 12, color: '#8b8b97' }}>
                      {t('snd.dkim_zone_hint', null, 'Raw zone-file format (quoted strings):')}<br />{record.zone}
                    </span>
                  )}
                </span>
                <span><DnsStatus verified={record.verified} /></span>
              </div>
            ))}
          </div>

          {notice && <div className="sending-notice">{notice}</div>}

          <button
            type="button"
            className="btn-danger sending-verify-button"
            onClick={verifyNow}
            disabled={verifying}
          >
            {verifying ? t('snd.verifying') : t('snd.verify_now')}
          </button>
        </main>

        <footer className="sending-footer">{t('common.copyright')}</footer>
      </div>
    </AppLayout>
  );
};

export default SendingDomainDetailPage;
