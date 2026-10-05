import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { adminApi } from '../../api/services';
import { Spinner, toast } from '../../components/ui';
import { useTranslation } from '../../i18n';

// Timezones with "(GMT+04:00) Asia/Muscat"-style labels.
const TIMEZONES = (() => {
  let zones = ['UTC'];
  try { zones = Intl.supportedValuesOf('timeZone'); } catch { /* fallback */ }
  return zones.map((tz) => {
    let off = 'GMT';
    try {
      const parts = new Intl.DateTimeFormat('en', { timeZone: tz, timeZoneName: 'longOffset' }).formatToParts();
      off = parts.find((p) => p.type === 'timeZoneName')?.value || 'GMT';
    } catch { /* keep GMT */ }
    return { value: tz, label: `(${off}) ${tz}` };
  });
})();

const AdminEditorPage = () => {
  const { t } = useTranslation();
  const { uid } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(uid);
  const fileRef = useRef(null);

  const [groups, setGroups] = useState([]);
  const [photo, setPhoto] = useState(null);
  const [form, setForm] = useState({
    email: '', admin_group_id: '', password: '', confirm: '',
    first_name: '', last_name: '', timezone: 'UTC', language: 'English', create_customer: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const reqs = [adminApi.adminGroups({ per_page: 100 })];
    if (editing) reqs.push(adminApi.adminDetail(uid));
    Promise.all(reqs)
      .then(([{ data: g }, detail]) => {
        setGroups(g.data || []);
        if (editing && detail) {
          const a = detail.data;
          setForm((f) => ({
            ...f,
            email: a.email || '', admin_group_id: a.admin_group_id ? String(a.admin_group_id) : '',
            first_name: a.first_name || '', last_name: a.last_name || '', timezone: a.timezone || 'UTC',
          }));
          if (a.image) setPhoto(a.image);
        }
      })
      .catch(() => { toast.error(t('ade.admin.load_failed', null, 'Failed to load.')); navigate('/admin/admins'); })
      .finally(() => setLoading(false));
  }, [uid, editing, navigate]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const onPhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result);
    reader.readAsDataURL(file);
  };

  const save = async () => {
    if (!form.email.trim()) { toast.error(t('ade.admin.email_required', null, 'Email is required.')); return; }
    if (!editing && !form.password) { toast.error(t('ade.admin.password_required', null, 'Password is required.')); return; }
    if (form.password && form.password !== form.confirm) { toast.error(t('ade.admin.passwords_no_match', null, 'Passwords do not match.')); return; }
    if (!form.admin_group_id) { toast.error(t('ade.admin.group_required', null, 'Group is required.')); return; }
    if (!form.first_name.trim() || !form.last_name.trim()) { toast.error(t('ade.admin.names_required', null, 'First and last name are required.')); return; }
    setSaving(true);
    try {
      const payload = {
        email: form.email, admin_group_id: form.admin_group_id,
        first_name: form.first_name, last_name: form.last_name,
        timezone: form.timezone,
      };
      if (form.password) payload.password = form.password;
      if (editing) {
        await adminApi.updateAdmin(uid, payload);
      } else {
        await adminApi.createAdmin({ ...payload, create_customer: form.create_customer });
      }
      toast.success(editing ? t('ade.admin.saved', null, 'Admin saved.') : t('ade.admin.created', null, 'Admin created.'));
      navigate('/admin/admins');
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
            <button type="button" onClick={() => navigate('/admin/admins')}>{t('ade.admin.breadcrumb_admins', null, 'Admins')}</button>
          </nav>
          <h1><span className="material-symbols-rounded">add</span>{editing ? t('ade.admin.edit_title', null, 'Edit admin') : t('ade.admin.create_title', null, 'Create admin')}</h1>
        </header>

        <section className="admin-content">
          {loading ? (
            <div className="admin-empty"><Spinner size="lg" /></div>
          ) : (
            <>
              <div className="admin-create-grid">
                {/* Profile Photo */}
                <div className="admin-create-col">
                  <h2 className="sq-section-title">{t('ade.admin.profile_photo', null, 'Profile Photo')}</h2>
                  <div className="admin-photo">
                    {photo ? <img src={photo} alt="" /> : <span className="material-symbols-rounded">account_circle</span>}
                    <button type="button" className="admin-photo-link" onClick={() => fileRef.current?.click()}>{t('ade.admin.upload_photo', null, 'Upload photo')}</button>
                    <p>{t('ade.admin.photo_hint', null, 'Photo should be at least 300px x 300px')}</p>
                    <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPhoto} />
                    <div className="admin-photo-btns">
                      <button type="button" className="btn-danger" onClick={() => fileRef.current?.click()}>
                        <span className="material-symbols-rounded">upload</span> {t('ade.admin.upload', null, 'Upload')}
                      </button>
                      <button type="button" className="btn-secondary" onClick={() => setPhoto(null)}>
                        <span className="material-symbols-rounded">delete</span> {t('ade.admin.remove', null, 'Remove')}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Account */}
                <div className="admin-create-col">
                  <h2 className="sq-section-title">{t('ade.admin.account', null, 'Account')}</h2>
                  <label className="admin-detail-field admin-detail-field-full"><span>{t('ade.admin.email', null, 'Email')} *</span>
                    <input className="input" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} /></label>
                  <label className="admin-detail-field admin-detail-field-full"><span>{t('ade.admin.group', null, 'Group')}</span>
                    <select className="input" value={form.admin_group_id} onChange={(e) => set('admin_group_id', e.target.value)}>
                      <option value="">{t('ade.admin.choose', null, 'Choose')}</option>
                      {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select></label>
                  <label className="admin-detail-field admin-detail-field-full"><span>{editing ? t('ade.admin.new_password', null, 'New password') : `${t('ade.admin.new_password', null, 'New password')} *`}</span>
                    <input className="input" type="password" value={form.password} onChange={(e) => set('password', e.target.value)} /></label>
                  <label className="admin-detail-field admin-detail-field-full"><span>{t('ade.admin.confirm_new_password', null, 'Confirm new password')}</span>
                    <input className="input" type="password" value={form.confirm} onChange={(e) => set('confirm', e.target.value)} /></label>
                </div>

                {/* Basic information */}
                <div className="admin-create-col">
                  <h2 className="sq-section-title">{t('ade.admin.basic_info', null, 'Basic information')}</h2>
                  <div className="admin-detail-grid">
                    <label className="admin-detail-field"><span>{t('ade.admin.first_name', null, 'First name')} *</span>
                      <input className="input" value={form.first_name} onChange={(e) => set('first_name', e.target.value)} /></label>
                    <label className="admin-detail-field"><span>{t('ade.admin.last_name', null, 'Last name')} *</span>
                      <input className="input" value={form.last_name} onChange={(e) => set('last_name', e.target.value)} /></label>
                  </div>
                  <label className="admin-detail-field admin-detail-field-full"><span>{t('ade.admin.timezone', null, 'Timezone')} *</span>
                    <select className="input" value={form.timezone} onChange={(e) => set('timezone', e.target.value)}>
                      {TIMEZONES.map((tz) => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
                    </select></label>
                  <label className="admin-detail-field admin-detail-field-full"><span>{t('ade.admin.language', null, 'Language')} *</span>
                    <select className="input" value={form.language} onChange={(e) => set('language', e.target.value)}>
                      <option value="English">English</option>
                    </select></label>
                  {!editing && (
                    <div className="admin-toggle-row">
                      <div>
                        <strong>{t('ade.admin.create_customer', null, 'Create customer account')}</strong>
                        <p>{t('ade.admin.create_customer_hint', null, 'Also create a customer account associated with the admin user')}</p>
                      </div>
                      <button type="button" className={`admin-switch ${form.create_customer ? 'is-on' : ''}`}
                        onClick={() => set('create_customer', !form.create_customer)} aria-pressed={form.create_customer}>
                        <span />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="admin-create-actions">
                <button type="button" className="btn-secondary" onClick={save} disabled={saving}>{saving ? t('ade.saving', null, 'Saving…') : t('common.save', null, 'Save')}</button>
              </div>
            </>
          )}
        </section>
      </div>
    </AppLayout>
  );
};

export default AdminEditorPage;
