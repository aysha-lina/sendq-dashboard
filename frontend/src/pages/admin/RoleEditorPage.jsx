import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { adminApi } from '../../api/services';
import { Spinner, toast } from '../../components/ui';
import { useTranslation } from '../../i18n';


// Permission groups mirror backend RBAC prefixes; each has Full Access + Read Only.
const GROUPS = [
  { prefix: 'campaign', label: 'Campaign', labelKey: 'ade.role.grp_campaign', noun: 'campaigns', nounKey: 'ade.role.noun_campaigns', verb: 'create, view, edit, run and delete', verbKey: 'ade.role.verb_cvred' },
  { prefix: 'list', label: 'Mail List', labelKey: 'ade.role.grp_list', noun: 'email lists', nounKey: 'ade.role.noun_lists', verb: 'create, view, edit and delete', verbKey: 'ade.role.verb_cved' },
  { prefix: 'automation', label: 'Automation', labelKey: 'ade.role.grp_automation', noun: 'automations', nounKey: 'ade.role.noun_automations', verb: 'create, view, edit, run and delete', verbKey: 'ade.role.verb_cvred' },
  { prefix: 'template', label: 'Template', labelKey: 'ade.role.grp_template', noun: 'templates', nounKey: 'ade.role.noun_templates', verb: 'create, view, edit, run and delete', verbKey: 'ade.role.verb_cvred' },
  { prefix: 'form', label: 'Forms & Pages', labelKey: 'ade.role.grp_form', noun: 'forms and pages', nounKey: 'ade.role.noun_forms', verb: 'create, view, edit and delete', verbKey: 'ade.role.verb_cved' },
  { prefix: 'sending_server', label: 'Sending Server', labelKey: 'ade.role.grp_sending_server', noun: 'sending servers', nounKey: 'ade.role.noun_sending_servers', verb: 'create, view, edit, run and delete', verbKey: 'ade.role.verb_cvred' },
  { prefix: 'sending_domain', label: 'Sending Domain', labelKey: 'ade.role.grp_sending_domain', noun: 'sending domains', nounKey: 'ade.role.noun_sending_domains', verb: 'create, view, edit, run and delete', verbKey: 'ade.role.verb_cvred' },
  { prefix: 'account', label: 'Other resources', labelKey: 'ade.role.grp_account', noun: 'all other resources (e.g., blacklist, website, etc.)', nounKey: 'ade.role.noun_account', verb: 'create, view, edit and delete', verbKey: 'ade.role.verb_cved' },
];

const Toggle = ({ on, onChange }) => (
  <button type="button" className={`role-toggle ${on ? 'is-on' : ''}`} onClick={() => onChange(!on)} aria-pressed={on}>
    <span className="role-toggle-knob" />
  </button>
);

const RoleEditorPage = () => {
  const { t } = useTranslation();
  const { uid } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(uid);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('active');
  const [perms, setPerms] = useState({}); // prefix -> 'full' | 'read' | null
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) return;
    adminApi.roleDetail(uid)
      .then(({ data }) => {
        setName(data.name || '');
        setDescription(data.description || '');
        setStatus(data.status || 'active');
        const map = {};
        (data.permissions || []).forEach((p) => {
          const [prefix, kind] = p.split('.');
          if (kind === 'full_access') map[prefix] = 'full';
          else if (kind === 'read_only') map[prefix] = 'read';
        });
        setPerms(map);
      })
      .catch(() => toast.error(t('ade.role.load_failed', null, 'Could not load the role.')))
      .finally(() => setLoading(false));
  }, [uid, editing]);

  const setGroup = (prefix, value) => setPerms((p) => ({ ...p, [prefix]: p[prefix] === value ? null : value }));

  const save = async () => {
    if (!name.trim()) { toast.error(t('ade.role.name_required', null, 'Role name is required.')); return; }
    const permissions = [];
    GROUPS.forEach((g) => {
      if (perms[g.prefix] === 'full') permissions.push(`${g.prefix}.full_access`);
      else if (perms[g.prefix] === 'read') permissions.push(`${g.prefix}.read_only`);
    });
    setSaving(true);
    try {
      if (editing) await adminApi.updateRole(uid, { name, description, status, permissions });
      else await adminApi.createRole({ name, description, status, permissions });
      toast.success(editing ? t('ade.role.saved', null, 'Role saved.') : t('ade.role.created', null, 'Role created.'));
      navigate('/admin/roles');
    } catch (err) {
      toast.error(err.response?.data?.message || t('ade.save_failed', null, 'Save failed.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <div className="admin-page">
        <header className="admin-header">
          <nav>
            <button type="button" onClick={() => navigate('/dashboard')}>{t('ade.breadcrumb_home', null, 'Home')}</button>
            <span>›</span>
            <button type="button" onClick={() => navigate('/admin/roles')}>{t('ade.role.breadcrumb_roles', null, 'Roles')}</button>
            <span>›</span>
            <span>{editing ? t('common.edit', null, 'Edit') : t('ade.role.add_role', null, 'Add role')}</span>
          </nav>
          <h1><span className="material-symbols-rounded">verified_user</span>{editing ? (name || t('ade.role.edit_role', null, 'Edit role')) : t('ade.role.add_role', null, 'Add role')}</h1>
        </header>

        <section className="admin-content">
          {loading ? (
            <div className="admin-empty"><Spinner size="lg" /></div>
          ) : (
            <div className="role-editor">
              <div className="role-editor-fields">
                <label className="admin-detail-field admin-detail-field-full">
                  <span>{t('common.name', null, 'Name')} *</span>
                  <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
                </label>
                <label className="admin-detail-field admin-detail-field-full">
                  <span>{t('ade.role.description', null, 'Description')}</span>
                  <textarea className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
                </label>
                <label className="admin-detail-field admin-detail-field-full">
                  <span>{t('common.status', null, 'Status')}</span>
                  <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="active">{t('ade.role.active', null, 'Active')}</option>
                    <option value="inactive">{t('ade.role.inactive', null, 'Inactive')}</option>
                  </select>
                </label>
              </div>

              <h2 className="sq-section-title role-editor-perms-title">{t('ade.role.permissions', null, 'Permissions')}</h2>
              {GROUPS.map((g) => {
                const noun = t(g.nounKey, null, g.noun);
                const verb = t(g.verbKey, null, g.verb);
                return (
                <div key={g.prefix} className="role-perm-group">
                  <h5 className="role-perm-group-title">{t(g.labelKey, null, g.label)}</h5>
                  <div className="role-perm-option">
                    <Toggle on={perms[g.prefix] === 'full'} onChange={() => setGroup(g.prefix, 'full')} />
                    <div>
                      <p className="role-perm-name">{t('ade.role.full_access', null, 'Full Access')}</p>
                      <p className="role-perm-desc">{t('ade.role.full_access_desc', { verb, noun }, `Full access to ${verb} ${noun}.`)}</p>
                    </div>
                  </div>
                  <div className="role-perm-option">
                    <Toggle on={perms[g.prefix] === 'read'} onChange={() => setGroup(g.prefix, 'read')} />
                    <div>
                      <p className="role-perm-name">{t('ade.role.read_only', null, 'Read Only')}</p>
                      <p className="role-perm-desc">{t('ade.role.read_only_desc', { noun }, `View only access to ${noun}.`)}</p>
                    </div>
                  </div>
                </div>
                );
              })}

              <div className="role-editor-actions">
                <button type="button" className="btn-danger" onClick={save} disabled={saving}>{saving ? t('ade.saving', null, 'Saving…') : t('common.save', null, 'Save')}</button>
                <button type="button" className="btn-secondary" onClick={() => navigate('/admin/roles')} disabled={saving}>{t('common.cancel', null, 'Cancel')}</button>
              </div>
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
};

export default RoleEditorPage;
