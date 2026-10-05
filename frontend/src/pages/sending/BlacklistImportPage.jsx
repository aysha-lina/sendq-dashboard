import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { sendingApi } from '../../api/services';
import { toast } from '../../components/ui';
import { useTranslation } from '../../i18n';

const BlacklistImportPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);

  const doImport = async () => {
    if (!file) { toast.error(t('snd.choose_txt_file')); return; }
    setBusy(true);
    try {
      const text = await file.text();
      const { data } = await sendingApi.importBlacklist({ emails: text });
      toast.success(data.message || t('snd.imported'));
      navigate('/sending/blacklist');
    } catch (err) {
      toast.error(err.response?.data?.message || t('snd.import_failed'));
    } finally { setBusy(false); }
  };

  return (
    <AppLayout>
      <div className="admin-page">
        <header className="admin-header">
          <nav>
            <button type="button" onClick={() => navigate('/dashboard')}>{t('common.home')}</button>
            <span>›</span>
            <button type="button" onClick={() => navigate('/sending/blacklist')}>{t('snd.blacklist')}</button>
          </nav>
          <h1><span className="material-symbols-rounded">upload</span>{t('common.import')}</h1>
        </header>

        <section className="admin-content">
          <h2 className="set-edit-title">{t('snd.upload_email_blacklist')}</h2>
          <p className="set-intro" style={{ maxWidth: 740 }}>
            {t('snd.upload_blacklist_desc')}
          </p>

          <div className="set-note" style={{ maxWidth: 740, marginBottom: 18 }}>
            <span className="material-symbols-rounded">info</span>
            {t('snd.upload_blacklist_note_pre')} <strong>{t('snd.upload_max_size')}</strong>{t('snd.upload_blacklist_note_post')}
          </div>

          <input className="input" style={{ maxWidth: 740 }} type="file" accept=".txt,text/plain" onChange={(e) => setFile(e.target.files?.[0] || null)} />

          <div style={{ marginTop: 22 }}>
            <button type="button" className="btn-secondary" onClick={doImport} disabled={busy}>{busy ? t('snd.importing') : t('common.import')}</button>
          </div>
        </section>
      </div>
    </AppLayout>
  );
};

export default BlacklistImportPage;
