import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { adminApi } from '../../api/services';
import { Spinner, toast } from '../../components/ui';
import useClickOutside from '../../hooks/useClickOutside';
import { useTranslation } from '../../i18n';

const PluginCard = ({ p, onToggle, onDelete }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false), open);
  const active = p.status === 'active';
  return (
    <div className="plg-card">
      <div className="plg-card-icon"><span className="material-symbols-rounded">extension</span></div>
      <div className="plg-card-body">
        <h5 className="plg-card-title">{p.title}</h5>
        <div className="plg-card-status">
          <span className={`admin-status-badge admin-status-${active ? 'active' : 'inactive'}`}>{active ? t('atp.active', null, 'Active') : t('atp.inactive', null, 'Inactive')}</span>
        </div>
        <p className="plg-card-desc">{p.description || '—'}</p>
        <span className="plg-card-meta">{t('atp.name_label', null, 'Name:')} {p.name} &nbsp;|&nbsp; {t('atp.version_label', null, 'Version:')} {p.version}</span>
        <div className="plg-card-actions">
          {active
            ? <button type="button" className="btn-secondary" onClick={() => onToggle(p, 'disable')}>{t('atp.disable', null, 'Disable')}</button>
            : <button type="button" className="btn-primary" onClick={() => onToggle(p, 'enable')}>{t('atp.enable', null, 'Enable')}</button>}
          <div className="admin-dd" ref={ref}>
            <button type="button" className="btn-secondary admin-icon-btn" onClick={() => setOpen((o) => !o)}><span className="material-symbols-rounded">more_vert</span></button>
            {open && (
              <ul className="admin-dd-menu admin-dd-menu-end">
                <li><button type="button" onClick={() => { setOpen(false); onDelete(p); }}><span className="material-symbols-rounded">delete</span> {t('atp.uninstall', null, 'Uninstall')}</button></li>
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const PluginsPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [plugins, setPlugins] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => adminApi.plugins()
    .then(({ data }) => setPlugins(data.data || []))
    .catch(() => toast.error(t('atp.failed_load_plugins', null, 'Failed to load plugins.')))
    .finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const toggle = async (p, action) => {
    if (!window.confirm(t('atp.toggle_plugin_confirm', { action, title: p.title }, 'Are you sure you want to {action} "{title}"?'))) return;
    try { await adminApi.setPluginStatus(p.uid, action); load(); toast.success(t('atp.plugin_action_done', { action }, 'Plugin {action}d.')); }
    catch (err) { toast.error(err.response?.data?.message || t('atp.action_failed', null, 'Action failed.')); }
  };
  const remove = async (p) => {
    if (!window.confirm(t('atp.uninstall_plugin_confirm', { title: p.title }, 'Uninstall "{title}"? This will remove the plugin files.'))) return;
    try { await adminApi.deletePlugin(p.uid); load(); toast.success(t('atp.plugin_uninstalled', null, 'Plugin uninstalled.')); }
    catch (err) { toast.error(err.response?.data?.message || t('atp.uninstall_failed', null, 'Uninstall failed.')); }
  };

  const kw = keyword.trim().toLowerCase();
  const filtered = kw ? plugins.filter((p) => `${p.name} ${p.title} ${p.description} ${p.version}`.toLowerCase().includes(kw)) : plugins;

  return (
    <AppLayout>
      <div className="admin-page">
        <header className="admin-header">
          <nav><button type="button" onClick={() => navigate('/dashboard')}>{t('atp.home', null, 'Home')}</button></nav>
          <h1><span className="material-symbols-rounded">extension</span>{t('atp.plugins', null, 'Plugins')}</h1>
        </header>

        <section className="admin-content">
          <div className="plg-head">
            <div className="plg-search">
              <span className="material-symbols-rounded">search</span>
              <input className="input" placeholder={t('atp.search_installed_plugins', null, 'Search installed plugins...')} value={keyword} onChange={(e) => setKeyword(e.target.value)} />
            </div>
            <button type="button" className="btn-secondary" onClick={() => navigate('/admin/plugins/new')}>
              <span className="material-symbols-rounded">add</span> {t('atp.install_plugin', null, 'Install plugin')}
            </button>
          </div>

          <h2 className="set-edit-title">{t('atp.installed_plugins', null, 'Installed plugins')}</h2>
          <p className="set-intro">{t('atp.plugins_intro', null, 'Empower your application with tons of awesome plugins developed by the community. Integration made easier than ever!')}</p>

          {loading ? <div className="admin-empty"><Spinner size="lg" /></div> : filtered.length === 0 ? (
            <div className="plg-empty">
              <span className="material-symbols-rounded">extension</span>
              <h3>{kw ? t('atp.no_matching_plugins', null, 'No matching plugins') : t('atp.no_plugin', null, 'You have no plugin')}</h3>
              <p>{t('atp.extend_system_1', null, "Let's extend the system functionalities")}<br />{t('atp.extend_system_2', null, 'by installing a new plugins')}</p>
            </div>
          ) : (
            <div className="plg-list">
              {filtered.map((p) => <PluginCard key={p.uid} p={p} onToggle={toggle} onDelete={remove} />)}
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
};

export default PluginsPage;
