import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { adminApi } from '../../api/services';
import { Spinner, toast } from '../../components/ui';
import { PERMISSION_GROUPS, defaultPermissions } from '../../constants/adminPermissions';
import { useTranslation } from '../../i18n';

const AdminGroupEditorPage = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(id);

  const [name, setName] = useState('');
  const [perms, setPerms] = useState(defaultPermissions());
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) return;
    adminApi.adminGroupDetail(id)
      .then(({ data }) => {
        setName(data.name || '');
        // Merge saved values over defaults so newly-added fields still appear.
        const base = defaultPermissions();
        const saved = data.permissions || {};
        Object.keys(base).forEach((g) => {
          base[g] = { ...base[g], ...(saved[g] || {}) };
        });
        setPerms(base);
      })
      .catch(() => { toast.error(t('ade.grp.load_failed', null, 'Failed to load group.')); navigate('/admin/admin-groups'); })
      .finally(() => setLoading(false));
  }, [id, editing, navigate]);

  const setCell = (group, field, value) => {
    setPerms((p) => ({ ...p, [group]: { ...p[group], [field]: value } }));
  };

  const save = async () => {
    if (!name.trim()) { toast.error(t('ade.grp.name_required', null, 'Name is required.')); return; }
    setSaving(true);
    try {
      if (editing) await adminApi.updateAdminGroup(id, { name, permissions: perms });
      else await adminApi.createAdminGroup({ name, permissions: perms });
      toast.success(editing ? t('ade.grp.saved', null, 'Group saved.') : t('ade.grp.created', null, 'Group created.'));
      navigate('/admin/admin-groups');
    } catch (err) {
      toast.error(err.response?.data?.message || t('ade.save_failed', null, 'Save failed.'));
    } finally { setSaving(false); }
  };

  return (
    <AppLayout>
      <div className="admin-page">
        <header className="admin-header">
          <nav>
            <button type="button" onClick={() => navigate('/dashboard')}>{t('ade.breadcrumb_home', null, 'Home')}</button>
            <span>›</span>
            <button type="button" onClick={() => navigate('/admin/admin-groups')}>{t('ade.grp.breadcrumb_admin_groups', null, 'Admin groups')}</button>
          </nav>
          <h1><span className="material-symbols-rounded">add</span>{editing ? t('ade.grp.edit_title', null, 'Edit group') : t('ade.grp.create_title', null, 'Create group')}</h1>
        </header>

        <section className="admin-content">
          {loading ? (
            <div className="admin-empty"><Spinner size="lg" /></div>
          ) : (
            <div className="ag-editor">
              <label className="admin-detail-field admin-detail-field-full ag-name">
                <span>{t('common.name', null, 'Name')} *</span>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
              </label>

              <h2 className="sq-section-title ag-options-title">
                <span className="material-symbols-rounded">settings</span> {t('ade.grp.group_options', null, 'Group options')}
              </h2>
              <div className="ag-tab"><span className="material-symbols-rounded">person</span> {t('ade.grp.permissions', null, 'Permissions')}</div>

              <div className="ag-perm-list">
                {PERMISSION_GROUPS.map((g) => (
                  <div key={g.key} className="ag-perm-group">
                    <div className="ag-perm-name">
                      <span className="material-symbols-rounded ag-grip">drag_indicator</span>
                      {g.label}
                    </div>
                    <div className="ag-perm-fields">
                      {g.fields.map((f) => (
                        <label key={f.key} className="ag-perm-field">
                          <span>{f.label} <em>*</em></span>
                          <select className="input" value={perms[g.key]?.[f.key] ?? f.default}
                            onChange={(e) => setCell(g.key, f.key, e.target.value)}>
                            {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="ag-actions">
                <button type="button" className="btn-secondary" onClick={save} disabled={saving}>{saving ? t('ade.saving', null, 'Saving…') : t('common.save', null, 'Save')}</button>
                <button type="button" className="ag-cancel" onClick={() => navigate('/admin/admin-groups')}>{t('common.cancel', null, 'Cancel')}</button>
              </div>
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
};

export default AdminGroupEditorPage;
