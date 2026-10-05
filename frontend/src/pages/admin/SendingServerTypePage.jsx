import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { SENDING_SERVER_TYPES } from '../../constants/sendingServerTypes';
import { useTranslation } from '../../i18n';

const SendingServerTypePage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  return (
    <AppLayout>
      <div className="admin-page">
        <header className="admin-header">
          <nav>
            <button type="button" onClick={() => navigate('/dashboard')}>{t('ase.home', null, 'Home')}</button>
          </nav>
          <h1><span className="material-symbols-rounded">add</span>{t('ase.select_sending_server_type', null, 'Select sending server type')}</h1>
        </header>

        <section className="admin-content">
          <div className="ss-type-list">
            {SENDING_SERVER_TYPES.map((st) => (
              <div key={st.key} className="ss-type-row">
                <span className="ss-icon" style={{ background: st.color }}>{st.icon}</span>
                <div className="ss-type-main">
                  <button type="button" className="ss-type-name" onClick={() => navigate(`/admin/sending-servers/create?type=${st.key}`)}>{st.name}</button>
                  <p>{st.desc}</p>
                </div>
                <button type="button" className="btn-secondary" onClick={() => navigate(`/admin/sending-servers/create?type=${st.key}`)}>{t('ase.choose', null, 'Choose')}</button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppLayout>
  );
};

export default SendingServerTypePage;
