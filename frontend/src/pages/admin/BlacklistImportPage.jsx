import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { adminApi } from '../../api/services';
import { toast } from '../../components/ui';
import { useTranslation } from '../../i18n';

const BlacklistImportPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);

  const doImport = async () => {
    if (!file) { toast.error(t('ase.choose_txt_to_import', null, 'Choose a TXT file to import.')); return; }
    setBusy(true);
    try {
      const text = await file.text();
      const { data } = await adminApi.importBlacklist({ csv: text });
      toast.success(data.message || t('ase.imported', null, 'Imported.'));
      navigate('/admin/blacklist');
    } catch (err) {
      toast.error(err.response?.data?.message || t('ase.import_failed', null, 'Import failed.'));
    } finally { setBusy(false); }
  };

  return (
    <AppLayout>
      <div className="admin-page">
        <header className="admin-header">
          <nav>
            <button type="button" onClick={() => navigate('/dashboard')}>{t('ase.home', null, 'Home')}</button>
            <span>›</span>
            <button type="button" onClick={() => navigate('/admin/blacklist')}>{t('ase.blacklist', null, 'Blacklist')}</button>
          </nav>
          <h1><span className="material-symbols-rounded">upload</span>{t('common.import', null, 'Import')}</h1>
        </header>

        <section className="admin-content">
          <h2 className="set-edit-title">{t('ase.upload_email_blacklist', null, 'Upload your email blacklist')}</h2>
          <p className="set-intro" style={{ maxWidth: 740 }}>{t('ase.upload_blacklist_intro', null, "Upload known invalid email addresses to the application's master blacklist. Any email address in your customer' lists which matches a blacklisted one shall automatically be marked as `blacklisted`")}</p>

          <div className="set-note" style={{ maxWidth: 740, marginBottom: 18 }}>
            <span className="material-symbols-rounded">info</span>
            {t('ase.upload_blacklist_note_1', null, 'Choose an input file from your device to upload. Acceptable file type is TXT, one email address per line. Server max file upload size is')} <strong>{t('ase.upload_blacklist_note_size', null, '2M')}</strong>.
          </div>

          <input className="input" style={{ maxWidth: 740 }} type="file" accept=".txt,text/plain" onChange={(e) => setFile(e.target.files?.[0] || null)} />

          <div style={{ marginTop: 22 }}>
            <button type="button" className="btn-secondary" onClick={doImport} disabled={busy}>{busy ? t('ase.importing', null, 'Importing…') : t('common.import', null, 'Import')}</button>
          </div>
        </section>
      </div>
    </AppLayout>
  );
};

export default BlacklistImportPage;
