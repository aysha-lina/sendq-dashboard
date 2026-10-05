import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { adminApi } from '../../api/services';
import { toast } from '../../components/ui';
import { useTranslation } from '../../i18n';

const InstallPluginPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);

  const send = async (overwrite) => {
    const fd = new FormData();
    fd.append('file', file);
    if (overwrite) fd.append('overwrite', 'true');
    const { data } = await adminApi.installPlugin(fd);
    toast.success(data.message || t('atp.plugin_installed', null, 'Plugin installed.'));
    navigate('/admin/plugins');
  };

  const upload = async () => {
    if (!file) { toast.error(t('atp.choose_plugin_package', null, 'Choose a plugin package to upload.')); return; }
    if (!file.name.toLowerCase().endsWith('.zip')) { toast.error(t('atp.must_be_zip', null, 'Input must be a valid .zip file')); return; }
    setBusy(true);
    try {
      await send(false);
    } catch (err) {
      const status = err.response?.status;
      const message = err.response?.data?.message || t('atp.plugin_install_failed', null, 'Plugin installation failed.');
      // 409 = plugin already exists → confirm overwrite (mirrors PHP behaviour).
      if (status === 409 && window.confirm(message)) {
        try { await send(true); } catch (e2) { toast.error(e2.response?.data?.message || t('atp.plugin_install_failed', null, 'Plugin installation failed.')); }
      } else if (status !== 409) {
        toast.error(message);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppLayout>
      <div className="admin-page">
        <header className="admin-header">
          <nav>
            <button type="button" onClick={() => navigate('/dashboard')}>{t('atp.home', null, 'Home')}</button>
            <span>›</span>
            <button type="button" onClick={() => navigate('/admin/plugins')}>{t('atp.plugins', null, 'Plugins')}</button>
          </nav>
          <h1><span className="material-symbols-rounded">file_upload</span>{t('atp.install_plugin', null, 'Install plugin')}</h1>
        </header>

        <section className="admin-content">
          <p className="set-intro" style={{ maxWidth: 760 }}>{t('atp.install_plugin_intro', null, 'Select a plugin package from your PC to upload. Normally it is a ZIP archive containing the source files as well as meta information (composer.json) for the plugin.')}</p>

          <label className="form-label fw-semibold" style={{ display: 'block', marginBottom: 8 }}>{t('atp.upload_file', null, 'Upload file')} <span style={{ color: '#ef4444' }}>*</span></label>
          <input
            ref={fileRef}
            type="file"
            accept=".zip,application/zip,application/x-zip-compressed"
            className="input"
            style={{ maxWidth: 760 }}
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />

          <div className="plg-actions">
            <button type="button" className="btn-secondary" onClick={upload} disabled={busy}>{busy ? t('atp.uploading', null, 'Uploading…') : t('atp.upload', null, 'Upload')}</button>
            <button type="button" className="btn-primary" onClick={() => navigate('/admin/plugins')}>{t('common.cancel', null, 'Cancel')}</button>
          </div>
        </section>
      </div>
    </AppLayout>
  );
};

export default InstallPluginPage;
