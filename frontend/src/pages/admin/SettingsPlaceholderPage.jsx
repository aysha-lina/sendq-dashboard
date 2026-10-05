import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { useTranslation } from '../../i18n';

const SettingsPlaceholderPage = ({ title, icon = 'settings' }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  return (
    <AppLayout>
      <div className="admin-page">
        <header className="admin-header">
          <nav><button type="button" onClick={() => navigate('/dashboard')}>{t('cfg.home', null, 'Home')}</button></nav>
          <h1><span className="material-symbols-rounded">{icon}</span>{title}</h1>
        </header>
        <section className="admin-content">
          <div className="hdl-empty">
            <span className="material-symbols-rounded">{icon}</span>
            <p>{title}</p>
            <p className="set-muted" style={{ maxWidth: 480, textAlign: 'center' }}>{t('cfg.placeholder_note', null, 'This section is part of Settings. Share the page design and it will be built to match.')}</p>
          </div>
        </section>
      </div>
    </AppLayout>
  );
};

export default SettingsPlaceholderPage;
