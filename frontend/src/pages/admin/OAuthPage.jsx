import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { adminApi } from '../../api/services';
import { Spinner } from '../../components/ui';
import { useTranslation } from '../../i18n';

export const OAUTH_PROVIDERS = [
  { key: 'google', name: 'Google', icon: 'G', color: '#fff', textColor: '#4285f4', border: true, desc: "Use Google's OAuth 2.0 authentication system for customer to login and register." },
  { key: 'facebook', name: 'Facebook', icon: 'f', color: '#1877f2', textColor: '#fff', desc: "Use Facebook's OAuth 2.0 authentication system for customer to login and register." },
];

const OAuthPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.settings()
      .then(({ data }) => {
        const map = {};
        (data.data || []).forEach((s) => { map[s.name] = s.value; });
        setValues(map);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const enabled = (key) => values[`oauth.${key}_enabled`] === 'yes';

  return (
    <AppLayout>
      <div className="admin-page">
        <header className="admin-header">
          <nav><button type="button" onClick={() => navigate('/dashboard')}>{t('cfg.home', null, 'Home')}</button></nav>
          <h1><span className="material-symbols-rounded">shield</span>{t('cfg.oauth', null, 'OAuth')}</h1>
        </header>

        <section className="admin-content">
          <p className="set-intro">{t('cfg.oauth_intro', null, 'In addition to typical, form based authentication, the system also provides a simple, convenient way to authenticate with OAuth providers. It currently supports authentication with Facebook, Twitter, LinkedIn, Google.')}</p>

          {loading ? <div className="admin-empty"><Spinner size="lg" /></div> : (
            <div className="oauth-list">
              {OAUTH_PROVIDERS.map((p) => (
                <div key={p.key} className="oauth-row">
                  <span className="oauth-icon" style={{ background: p.color, color: p.textColor, border: p.border ? '1px solid rgba(148,163,184,.3)' : 'none' }}>{p.icon}</span>
                  <div className="oauth-main">
                    <div className="oauth-name-row">
                      <strong>{p.name}</strong>
                      <span className={`admin-status-badge admin-status-${enabled(p.key) ? 'active' : 'inactive'}`}>{enabled(p.key) ? t('cfg.enabled', null, 'ENABLED') : t('cfg.disabled', null, 'DISABLED')}</span>
                    </div>
                    <p>{t(`cfg.oauth_desc_${p.key}`, null, p.desc)}</p>
                  </div>
                  <button type="button" className="btn-secondary" onClick={() => navigate(`/admin/oauth/${p.key}`)}>
                    <span className="material-symbols-rounded">settings</span> {t('cfg.settings', null, 'Settings')}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
};

export default OAuthPage;
