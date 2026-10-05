import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { adminApi } from '../../api/services';
import { Spinner, toast } from '../../components/ui';
import { useTranslation } from '../../i18n';

const CustomEmailsPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.customTemplates()
      .then(({ data }) => setRows(data.data || []))
      .catch(() => toast.error(t('atp.failed_load_templates', null, 'Failed to load templates.')))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppLayout>
      <div className="admin-page">
        <header className="admin-header">
          <nav><button type="button" onClick={() => navigate('/dashboard')}>{t('atp.home', null, 'Home')}</button></nav>
          <h1><span className="material-symbols-rounded">mail</span>{t('atp.custom_emails_pages', null, 'Custom Emails & Pages')}</h1>
        </header>

        <section className="admin-content">
          <p className="set-intro">{t('atp.ce_intro', null, 'Below are default email templates & pages used by the application. You can customize those the way you desire. For example, you may want to add a logo to an email to reflect your brand')}</p>

          {loading ? <div className="admin-empty"><Spinner size="lg" /></div> : (
            <div className="ce-list">
              {rows.map((r) => (
                <div key={r.uid} className="ce-row">
                  <span className="ce-icon material-symbols-rounded">{r.type === 'page' ? 'description' : 'mail'}</span>
                  <div className="ce-main">
                    <button type="button" className="ce-name" onClick={() => navigate(`/admin/custom-emails/${r.uid}/edit`)}>{r.name}</button>
                    <p>{r.group_label}</p>
                  </div>
                  <div className="ce-cell"><strong>{r.type === 'page' ? t('atp.page', null, 'Page') : t('atp.email', null, 'Email')}</strong><span>{t('atp.display_type', null, 'Display type')}</span></div>
                  <div className="ce-cell"><strong>{r.custom_page_count}</strong><span>{t('atp.custom_page', null, 'Custom page')}</span></div>
                  <button type="button" className="btn-secondary" onClick={() => navigate(`/admin/custom-emails/${r.uid}/edit`)}>
                    <span className="material-symbols-rounded">edit</span> {t('common.edit', null, 'Edit')}
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

export default CustomEmailsPage;
