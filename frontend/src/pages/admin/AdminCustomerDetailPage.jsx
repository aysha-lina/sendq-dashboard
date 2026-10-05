import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { adminApi, authApi } from '../../api/services';
import { Spinner, toast } from '../../components/ui';
import useAuthStore from '../../store/authStore';
import useClickOutside from '../../hooks/useClickOutside';
import { useTranslation } from '../../i18n';

const MaterialIcon = ({ children }) => <span className="material-symbols-rounded">{children}</span>;

const TAB_DEFS = [
  { key: 'profile', labelKey: 'ade.cust.tab_profile', labelEn: 'Profile', icon: 'home' },
  { key: 'contact', labelKey: 'ade.cust.tab_contact', labelEn: 'Contact information', icon: 'maps_home_work' },
  { key: 'users', labelKey: 'ade.cust.tab_users', labelEn: 'Users', icon: 'group' },
  { key: 'subscriptions', labelKey: 'ade.cust.tab_subscriptions', labelEn: 'Subscriptions', icon: 'assignment_turned_in' },
];

const LANGUAGES = ['English', 'Deutsch', 'Español', 'Italiano', 'Português', 'Türkçe', '日本語', 'العربية'];

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

const COUNTRY_CODES = 'AF AL DZ AS AD AO AI AG AR AM AW AU AT AZ BS BH BD BB BY BE BZ BJ BM BT BO BA BW BR BN BG BF BI KH CM CA CV KY CF TD CL CN CO KM CG CD CR CI HR CU CY CZ DK DJ DM DO EC EG SV GQ ER EE ET FJ FI FR GA GM GE DE GH GR GD GT GN GW GY HT HN HK HU IS IN ID IR IQ IE IL IT JM JP JO KZ KE KI KW KG LA LV LB LS LR LY LI LT LU MO MG MW MY MV ML MT MH MR MU MX FM MD MC MN ME MA MZ MM NA NP NL NZ NI NE NG NO OM PK PW PA PG PY PE PH PL PT QA RO RU RW SA SN RS SG SK SI SO ZA KR SS ES LK SD SR SE CH SY TW TJ TZ TH TG TO TT TN TR TM UG UA AE GB US UY UZ VU VE VN YE ZM ZW'.split(' ');
const COUNTRIES = (() => {
  let names;
  try { names = new Intl.DisplayNames(['en'], { type: 'region' }); } catch { names = null; }
  return COUNTRY_CODES.map((c) => ({ code: c, name: names ? (names.of(c) || c) : c })).sort((a, b) => a.name.localeCompare(b.name));
})();

const formatDate = (v) => {
  if (!v) return '-';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString();
};

const Field = ({ label, value, onChange, type = 'text', required, full }) => (
  <label className={`admin-detail-field ${full ? 'admin-detail-field-full' : ''}`}>
    <span>{label}{required ? ' *' : ''}</span>
    <input className="input" type={type} value={value || ''} onChange={(e) => onChange(e.target.value)} />
  </label>
);

const UserRow = ({ user, onLoginAs, onOneClick, onStatus, onDelete }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false), open);
  const activated = (user.status || 'active') === 'active';
  return (
    <div className="admin-detail-user-row">
      <div className="admin-detail-user-main">
        <span className="admin-detail-user-avatar"><MaterialIcon>account_circle</MaterialIcon></span>
        <div>
          <p className="admin-detail-user-name">{`${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email}</p>
          <p className="admin-detail-user-email">{user.email}</p>
        </div>
      </div>
      <div className="admin-detail-user-meta"><strong>{formatDate(user.created_at)}</strong><span>{t('ade.cust.created_at', null, 'Created at')}</span></div>
      <div className="admin-detail-user-meta"><strong>{t('ade.cust.full_access', null, 'Full Access')}</strong><span>{t('ade.cust.role', null, 'Role')}</span></div>
      <span className={`admin-status-badge admin-status-${activated ? 'active' : 'inactive'}`}>{activated ? t('ade.cust.activated', null, 'activated') : t('ade.cust.disabled', null, 'disabled')}</span>
      <div className="admin-detail-user-actions">
        <button type="button" className="admin-loginas-icon" title={t('ade.cust.login_as', null, 'Login as')} onClick={() => onLoginAs(user)}><MaterialIcon>login</MaterialIcon></button>
        <button type="button" className="btn-secondary admin-icon-btn" title={t('common.edit', null, 'Edit')}><MaterialIcon>edit</MaterialIcon></button>
        <div ref={ref} className="admin-dd">
          <button type="button" className="btn-secondary admin-icon-btn" onClick={() => setOpen((v) => !v)} aria-label={t('ade.cust.more', null, 'More')}><span className="admin-caret">⌄</span></button>
          {open && (
            <div className="admin-dd-menu admin-dd-menu-end">
              <button type="button" onClick={() => { setOpen(false); onOneClick(user); }}><MaterialIcon>link</MaterialIcon> {t('ade.cust.generate_one_click', null, 'Generate one-click login URL')}</button>
              <button type="button" onClick={() => { setOpen(false); onStatus(user, 'enable'); }}><MaterialIcon>play_arrow</MaterialIcon> {t('ade.cust.enable', null, 'Enable')}</button>
              <button type="button" onClick={() => { setOpen(false); onStatus(user, 'disable'); }}><MaterialIcon>hide_source</MaterialIcon> {t('ade.cust.disable', null, 'Disable')}</button>
              <button type="button" onClick={() => { setOpen(false); onDelete(user); }}><MaterialIcon>delete_outline</MaterialIcon> {t('common.delete', null, 'Delete')}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const AdminCustomerDetailPage = () => {
  const { t } = useTranslation();
  const { uid } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = TAB_DEFS.some((td) => td.key === searchParams.get('tab')) ? searchParams.get('tab') : 'profile';
  const TABS = TAB_DEFS.map((td) => ({ ...td, label: t(td.labelKey, null, td.labelEn) }));

  const [data, setData] = useState(null);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [plans, setPlans] = useState([]);
  const [assign, setAssign] = useState({ open: false, plan_id: '', ends_at: '', saving: false });

  const load = () => {
    setLoading(true);
    setLoadError('');
    adminApi.customerDetail(uid)
      .then(({ data: d }) => {
        setData(d);
        const c = d.customer || {};
        setForm({
          name: c.first_name || '',
          timezone: c.timezone || 'UTC',
          language: c.language || 'English',
          contact_first_name: c.contact_first_name || '',
          contact_last_name: c.contact_last_name || '',
          company: c.company || '',
          phone: c.phone || '',
          work_email: c.work_email || d.users?.[0]?.email || '',
          zip: c.zip || '', state: c.state || '', city: c.city || '',
          address: c.address || '', address_2: c.address_2 || '',
          country: c.country || '', website: c.website || '',
          tax_number: c.tax_number || '', billing_address: c.billing_address || '',
        });
      })
      .catch((err) => setLoadError(err.response?.data?.message || t('ade.cust.load_error', null, 'Could not load this customer.')))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [uid]);  
  // Plans for the "Assign plan" picker.
  useEffect(() => { adminApi.plans().then(({ data: d }) => setPlans(d?.data || d || [])).catch(() => {}); }, []);

  const assignPlan = async () => {
    if (!assign.plan_id) { toast.error(t('ade.cust.assign_pick_plan', null, 'Pick a plan to assign.')); return; }
    setAssign((a) => ({ ...a, saving: true }));
    try {
      await adminApi.assignPlan({ customer_id: data.customer.id, plan_id: Number(assign.plan_id), ends_at: assign.ends_at || null });
      toast.success(t('ade.cust.plan_assigned', null, 'Plan assigned.'));
      setAssign({ open: false, plan_id: '', ends_at: '', saving: false });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || t('ade.save_failed', null, 'Save failed.'));
      setAssign((a) => ({ ...a, saving: false }));
    }
  };

  const setTab = (key) => setSearchParams({ tab: key });
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const saveProfile = async () => {
    setSaving(true);
    try {
      await adminApi.updateCustomerProfile(uid, { first_name: form.name, timezone: form.timezone, language: form.language });
      toast.success(t('ade.cust.profile_saved', null, 'Profile saved.'));
      load();
    } catch (err) { toast.error(err.response?.data?.message || t('ade.save_failed', null, 'Save failed.')); } finally { setSaving(false); }
  };
  const saveContact = async () => {
    setSaving(true);
    try {
      const { name, timezone, language, ...contact } = form;  
      await adminApi.updateCustomerProfile(uid, contact);
      toast.success(t('ade.cust.contact_saved', null, 'Contact information saved.'));
      load();
    } catch (err) { toast.error(err.response?.data?.message || t('ade.save_failed', null, 'Save failed.')); } finally { setSaving(false); }
  };

  const loginAs = async (user) => {
    try {
      const { data: res } = await adminApi.loginAsUser(user.uid);
      // Stash the admin session and switch to the customer (ImpersonationBar lets you return).
      useAuthStore.getState().impersonate(res.token, res.user || null);
      const me = await authApi.me();
      localStorage.setItem('sendq_user', JSON.stringify(me.data.user || me.data));
      useAuthStore.setState({ user: me.data.user || me.data });
      toast.success(t('ade.cust.logged_in_as', { email: user.email }, `Logged in as ${user.email}.`));
      navigate('/dashboard');
    } catch (err) { toast.error(err.response?.data?.message || t('ade.cust.login_as_failed', null, 'Could not log in as this user.')); }
  };
  const oneClick = async (user) => {
    try { const { data: res } = await adminApi.oneClickLogin(user.uid); await navigator.clipboard?.writeText(res.url); toast.success(t('ade.cust.one_click_copied', null, 'One-click login URL copied to clipboard.')); }
    catch (err) { toast.error(err.response?.data?.message || t('ade.cust.url_failed', null, 'Could not generate the URL.')); }
  };
  const userStatus = async (user, action) => {
    try { await adminApi.setUserStatus(user.uid, action); toast.success(t('ade.cust.user_status_updated', { action }, `User ${action}d.`)); load(); }
    catch (err) { toast.error(err.response?.data?.message || t('ade.cust.user_update_failed', null, 'Could not update the user.')); }
  };
  const deleteUser = async (user) => {
    if (!window.confirm(t('ade.cust.delete_user_confirm', { email: user.email }, `Delete user "${user.email}"?`))) return;
    try { await adminApi.deleteUser(user.uid); toast.success(t('ade.cust.user_deleted', null, 'User deleted.')); load(); }
    catch (err) { toast.error(err.response?.data?.message || t('ade.cust.user_delete_failed', null, 'Could not delete the user.')); }
  };

  const customerTitle = (form.name || t('ade.cust.customer', null, 'Customer')).toUpperCase();

  return (
    <AppLayout>
      <div className="admin-page">
        <header className="admin-header">
          <nav>
            <button type="button" onClick={() => navigate('/dashboard')}>{t('ade.breadcrumb_home', null, 'Home')}</button>
            <span>›</span>
            <button type="button" onClick={() => navigate('/admin/customers')}>{t('ade.cust.breadcrumb_customers', null, 'Customers')}</button>
            <span>›</span>
            <span>{TABS.find((td) => td.key === tab)?.label}</span>
          </nav>
          {!loading && <h1><span className="material-symbols-rounded">apartment</span>{customerTitle}</h1>}
        </header>

        <section className="admin-content">
          {loading ? (
            <div className="admin-empty"><Spinner size="lg" /></div>
          ) : loadError ? (
            <div className="admin-empty">
              <span className="material-symbols-rounded">error</span>
              <p>{loadError}</p>
              <button type="button" className="btn-secondary" onClick={load} style={{ marginTop: 12 }}>{t('ade.retry', null, 'Retry')}</button>
            </div>
          ) : !data ? (
            <div className="admin-empty"><p>{t('ade.cust.no_data', null, 'No data.')}</p></div>
          ) : (
            <>
              <ul className="campaign-detail-tabs admin-detail-tabs">
                {TABS.map((td) => (
                  <li key={td.key} className={tab === td.key ? 'active' : ''}>
                    <button type="button" onClick={() => setTab(td.key)}><MaterialIcon>{td.icon}</MaterialIcon> {td.label}</button>
                  </li>
                ))}
              </ul>

              {tab === 'profile' && (
                <div className="admin-detail-form admin-detail-narrow">
                  <h2 className="sq-section-title">{t('ade.cust.information', null, 'Information')}</h2>
                  <label className="admin-detail-field admin-detail-field-full">
                    <span>{t('ade.cust.customer_name', null, 'Customer name')}</span>
                    <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} />
                  </label>
                  <label className="admin-detail-field admin-detail-field-full">
                    <span>{t('ade.cust.timezone', null, 'Timezone')}</span>
                    <select className="input" value={form.timezone} onChange={(e) => set('timezone', e.target.value)}>
                      {!TIMEZONES.some((t) => t.value === form.timezone) && <option value={form.timezone}>{form.timezone}</option>}
                      {TIMEZONES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </label>
                  <label className="admin-detail-field admin-detail-field-full">
                    <span>{t('ade.cust.language', null, 'Language')}</span>
                    <select className="input" value={form.language} onChange={(e) => set('language', e.target.value)}>
                      {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </label>
                  <div className="admin-detail-actions"><button type="button" className="btn-primary" onClick={saveProfile} disabled={saving}>{saving ? t('ade.saving', null, 'Saving…') : t('common.save', null, 'Save')}</button></div>
                </div>
              )}

              {tab === 'contact' && (
                <div className="admin-detail-form">
                  <h2 className="sq-section-title">{t('ade.cust.primary_contact', null, 'Primary account contact')}</h2>
                  <div className="admin-detail-grid">
                    <Field label={t('ade.cust.first_name', null, 'First name')} required value={form.contact_first_name} onChange={(v) => set('contact_first_name', v)} />
                    <Field label={t('ade.cust.last_name', null, 'Last name')} required value={form.contact_last_name} onChange={(v) => set('contact_last_name', v)} />
                    <Field label={t('ade.cust.company_org', null, 'Company / Organization')} required full value={form.company} onChange={(v) => set('company', v)} />
                    <Field label={t('ade.cust.office_phone', null, 'Office phone')} value={form.phone} onChange={(v) => set('phone', v)} />
                    <Field label={t('ade.cust.work_email', null, 'Email address (at work)')} required type="email" value={form.work_email} onChange={(v) => set('work_email', v)} />
                    <Field label={t('ade.cust.zip', null, 'Zip / Postal code')} required value={form.zip} onChange={(v) => set('zip', v)} />
                    <Field label={t('ade.cust.state', null, 'State / Province / Region')} required value={form.state} onChange={(v) => set('state', v)} />
                    <Field label={t('ade.cust.city', null, 'City')} required value={form.city} onChange={(v) => set('city', v)} />
                    <Field label={t('ade.cust.address_1', null, 'Address 1')} required value={form.address} onChange={(v) => set('address', v)} />
                    <Field label={t('ade.cust.address_2', null, 'Address 2')} value={form.address_2} onChange={(v) => set('address_2', v)} />
                    <label className="admin-detail-field">
                      <span>{t('ade.cust.country', null, 'Country')} *</span>
                      <select className="input" value={form.country} onChange={(e) => set('country', e.target.value)}>
                        <option value="">{t('ade.cust.choose', null, 'Choose')}</option>
                        {COUNTRIES.map((c) => <option key={c.code} value={c.name}>{c.name}</option>)}
                      </select>
                    </label>
                    <Field label={t('ade.cust.website_url', null, 'Website URL')} full value={form.website} onChange={(v) => set('website', v)} />
                  </div>

                  <h2 className="sq-section-title" style={{ marginTop: 12 }}>{t('ade.cust.billing_info', null, 'Billing information')}</h2>
                  <div className="admin-detail-grid">
                    <Field label={t('ade.cust.tax_number', null, 'Tax number')} value={form.tax_number} onChange={(v) => set('tax_number', v)} />
                    <Field label={t('ade.cust.billing_address', null, 'Billing address')} value={form.billing_address} onChange={(v) => set('billing_address', v)} />
                  </div>
                  <div className="admin-detail-actions"><button type="button" className="btn-primary" onClick={saveContact} disabled={saving}>{saving ? t('ade.saving', null, 'Saving…') : t('common.save', null, 'Save')}</button></div>
                </div>
              )}

              {tab === 'users' && (
                <div className="admin-detail-users">
                  <div className="admin-detail-users-head">
                    <button type="button" className="btn-secondary" onClick={() => toast.info?.(t('ade.cust.already_has_user', null, 'This account already has its user.'))}>
                      <MaterialIcon>add</MaterialIcon> {t('ade.cust.add_new_user', null, 'Add new User')}
                    </button>
                  </div>
                  {(data.users || []).length === 0 ? (
                    <div className="admin-empty"><MaterialIcon>group</MaterialIcon><p>{t('ade.cust.no_users', null, 'There are no users yet')}</p></div>
                  ) : (
                    data.users.map((u) => (
                      <UserRow key={u.uid} user={u} onLoginAs={loginAs} onOneClick={oneClick} onStatus={userStatus} onDelete={deleteUser} />
                    ))
                  )}
                </div>
              )}

              {tab === 'subscriptions' && (
                <div className="admin-detail-subs">
                  <div className="admin-subs-toolbar">
                    <button type="button" className="btn-primary" onClick={() => setAssign((a) => ({ ...a, open: !a.open }))}>
                      <MaterialIcon>add</MaterialIcon> {t('ade.cust.assign_plan', null, 'Assign plan')}
                    </button>
                  </div>
                  {assign.open && (
                    <div className="admin-assign-plan">
                      <label className="admin-detail-field">
                        <span>{t('ade.cust.plan', null, 'Plan')} *</span>
                        <select className="input" value={assign.plan_id} onChange={(e) => setAssign((a) => ({ ...a, plan_id: e.target.value }))}>
                          <option value="">{t('ade.cust.select_plan', null, 'Select a plan…')}</option>
                          {plans.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}{p.price != null ? ` — ${p.price}` : ''}</option>
                          ))}
                        </select>
                      </label>
                      <label className="admin-detail-field">
                        <span>{t('ade.cust.ends_optional', null, 'Ends at (optional)')}</span>
                        <input className="input" type="date" value={assign.ends_at} onChange={(e) => setAssign((a) => ({ ...a, ends_at: e.target.value }))} />
                      </label>
                      <div className="admin-assign-plan-actions">
                        <button type="button" className="btn-secondary" onClick={() => setAssign({ open: false, plan_id: '', ends_at: '', saving: false })} disabled={assign.saving}>{t('common.cancel', null, 'Cancel')}</button>
                        <button type="button" className="btn-primary" onClick={assignPlan} disabled={assign.saving}>
                          {assign.saving ? <Spinner size="sm" /> : t('ade.cust.assign', null, 'Assign')}
                        </button>
                      </div>
                      <p className="admin-assign-plan-note">{t('ade.cust.assign_note', null, 'Assigning a plan activates it now and expires any current active subscription.')}</p>
                    </div>
                  )}
                  {(data.subscriptions || []).length === 0 ? (
                    <div className="admin-subs-empty">
                      <MaterialIcon>assignment_turned_in</MaterialIcon>
                      <p>{t('ade.cust.no_subscriptions', null, 'There are no subscriptions')}</p>
                    </div>
                  ) : (
                    <table className="admin-table">
                      <thead><tr><th>{t('ade.cust.plan', null, 'Plan')}</th><th>{t('common.status', null, 'Status')}</th><th>{t('ade.cust.starts', null, 'Starts')}</th><th>{t('ade.cust.ends', null, 'Ends')}</th></tr></thead>
                      <tbody>
                        {data.subscriptions.map((s) => (
                          <tr key={s.id}>
                            <td>{s.plan?.name || '-'}</td>
                            <td><span className={`admin-status-badge admin-status-${s.status}`}>{s.status}</span></td>
                            <td>{formatDate(s.starts_at)}</td>
                            <td>{formatDate(s.ends_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </AppLayout>
  );
};

export default AdminCustomerDetailPage;
