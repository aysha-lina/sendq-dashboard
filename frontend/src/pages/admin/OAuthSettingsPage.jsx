import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { adminApi } from '../../api/services';
import { Spinner, toast } from '../../components/ui';
import { useTranslation } from '../../i18n';
import { OAUTH_PROVIDERS } from './OAuthPage';

const OAuthSettingsPage = () => {
  const { provider } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const meta = OAUTH_PROVIDERS.find((p) => p.key === provider) || OAUTH_PROVIDERS[0];
  const k = (s) => `oauth.${meta.key}_${s}`;
  const origin = window.location.origin;
  const redirectUri = `${origin}/auth/${meta.key}/callback`;

  const [enabled, setEnabled] = useState(false);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminApi.settings()
      .then(({ data }) => {
        const map = {};
        (data.data || []).forEach((s) => { map[s.name] = s.value; });
        setEnabled(map[k('enabled')] === 'yes');
        setClientId(map[k('client_id')] || '');
        setClientSecret(map[k('client_secret')] || '');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [meta.key]);  

  const copy = (text) => { navigator.clipboard?.writeText(text); toast.success(t('cfg.copied', null, 'Copied.')); };

  const save = async () => {
    setSaving(true);
    try {
      await adminApi.updateSettings({
        [k('enabled')]: enabled ? 'yes' : 'no',
        [k('client_id')]: clientId,
        [k('client_secret')]: clientSecret,
      });
      toast.success(t('cfg.oauth_settings_saved', null, 'OAuth settings saved.'));
      navigate('/admin/oauth');
    } catch (err) {
      toast.error(err.response?.data?.message || t('cfg.save_failed', null, 'Save failed.'));
    } finally { setSaving(false); }
  };

  return (
    <AppLayout>
      <div className="admin-page">
        <header className="admin-header">
          <nav>
            <button type="button" onClick={() => navigate('/dashboard')}>{t('cfg.home', null, 'Home')}</button>
            <span>›</span>
            <button type="button" onClick={() => navigate('/admin/oauth')}>{t('cfg.oauth', null, 'OAuth')}</button>
          </nav>
          <h1><span className="material-symbols-rounded">shield</span>{t('cfg.provider_oauth', { name: meta.name }, '{name} OAuth')}</h1>
        </header>

        <section className="admin-content">
          {loading ? <div className="admin-empty"><Spinner size="lg" /></div> : (
            <div className="oauth-form-wrap">
              <label className="oauth-enable">
                <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
                <span>{t('cfg.oauth_enable_label', { name: meta.name }, 'Enable {name} OAuth 2.0 for customer login.')}</span>
              </label>

              {enabled && (
                <div className="oauth-creds">
                  <hr />
                  <p className="set-muted">{t('cfg.oauth_creds_help', { name: meta.name }, 'Create OAuth 2.0 credentials in your {name} developer console, then paste the Client ID and Client Secret below. Use the Origin and Redirect URIs shown here when configuring the credentials.')}</p>
                  <label className="admin-detail-field admin-detail-field-full set-field" style={{ maxWidth: 760 }}><span>{t('cfg.oauth_client_id', { name: meta.name }, '{name} Client ID')}</span>
                    <input className="input" value={clientId} onChange={(e) => setClientId(e.target.value)} /></label>
                  <label className="admin-detail-field admin-detail-field-full set-field" style={{ maxWidth: 760 }}><span>{t('cfg.oauth_client_secret', { name: meta.name }, '{name} Client Secret')}</span>
                    <input className="input" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} /></label>

                  <h5 className="oauth-uri-title">{t('cfg.oauth_origin_uri', null, 'Authorized JavaScript origin URI')}</h5>
                  <div className="oauth-uri-row"><code>{origin}</code><button type="button" className="btn-secondary" onClick={() => copy(origin)}><span className="material-symbols-rounded">content_copy</span> {t('cfg.copy', null, 'Copy')}</button></div>

                  <h5 className="oauth-uri-title">{t('cfg.oauth_redirect_uri', null, 'Authorized redirect URI')}</h5>
                  <div className="oauth-uri-row"><code>{redirectUri}</code><button type="button" className="btn-secondary" onClick={() => copy(redirectUri)}><span className="material-symbols-rounded">content_copy</span> {t('cfg.copy', null, 'Copy')}</button></div>
                </div>
              )}

              <div className="oauth-actions">
                <button type="button" className="btn-secondary" onClick={save} disabled={saving}>{saving ? t('cfg.saving', null, 'Saving…') : t('common.save', null, 'Save')}</button>
                <button type="button" className="btn-secondary" onClick={() => navigate('/admin/oauth')}>{t('common.cancel', null, 'Cancel')}</button>
              </div>
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
};

export default OAuthSettingsPage;
