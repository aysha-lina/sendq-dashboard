import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../i18n/index.jsx';

// Shown when an authenticated user opens an admin page they have no ability for (S7).
export default function AdminAccessDenied() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <div className="admin-access-denied">
      <span className="material-symbols-rounded">lock</span>
      <h1>{t('acl.denied_title')}</h1>
      <p>{t('acl.denied_body')}</p>
      <button type="button" className="btn-primary" onClick={() => navigate('/dashboard')}>
        {t('acl.back_to_dashboard')}
      </button>
    </div>
  );
}
