import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { listsApi } from '../../api/services';
import { useTranslation } from '../../i18n/index.jsx';
import ListDetailTabs from './ListDetailTabs';
import WebhookModal from './WebhookModal';

const iconMap = {
  Settings: 'settings',
  'Manage list fields': 'fact_check',
};

const MaterialIcon = ({ name, className = '' }) => (
  <span className={`material-symbols-rounded ${className}`}>{name}</span>
);

const InitialState = ({ text, icon = 'splitscreen' }) => (
  <section className="sq-panel flex min-h-[326px] flex-col items-center justify-center text-center text-[#bfc0ca]">
    <MaterialIcon name={icon} className="mb-8 text-[84px] text-[#777889]" />
    <p className="text-xl font-normal">{text}</p>
  </section>
);

const SettingsForm = ({ list, onSaved }) => {
  const { t } = useTranslation();
  const [form, setForm] = useState(list);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => setForm(list), [list]);

  const updateBool = (key) => setForm((current) => ({ ...current, [key]: !current[key] }));

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const { data } = await listsApi.updateSettings(list.uid, form);
      onSaved(data);
      setMessage(t('frm.settings_saved'));
    } catch (error) {
      setMessage(error.response?.data?.message || t('frm.settings_save_failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="list-settings-form" onSubmit={save}>
      <div className="list-settings-grid">
        <label>
          <span>{t('frm.list_name')}</span>
          <input value={form.name || ''} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
        </label>
        <label>
          <span>{t('frm.from_email')}</span>
          <input type="email" value={form.from_email || ''} onChange={(event) => setForm({ ...form, from_email: event.target.value })} />
        </label>
        <label>
          <span>{t('frm.from_name')}</span>
          <input value={form.from_name || ''} onChange={(event) => setForm({ ...form, from_name: event.target.value })} />
        </label>
        <label>
          <span>{t('frm.default_subject')}</span>
          <input value={form.default_subject || ''} onChange={(event) => setForm({ ...form, default_subject: event.target.value })} />
        </label>
      </div>
      <label className="list-settings-wide">
        <span>{t('frm.reminder_message')}</span>
        <textarea value={form.remind_message || ''} onChange={(event) => setForm({ ...form, remind_message: event.target.value })} />
      </label>
      <div className="list-settings-switches">
        {[
          ['subscribe_confirmation', t('frm.require_confirmation')],
          ['send_welcome_email', t('frm.send_welcome_email')],
          ['unsubscribe_notification', t('frm.unsubscribe_notification')],
        ].map(([key, label]) => (
          <button key={key} type="button" className={form[key] ? 'active' : ''} onClick={() => updateBool(key)}>
            <MaterialIcon name={form[key] ? 'toggle_on' : 'toggle_off'} />
            {label}
          </button>
        ))}
      </div>
      <div className="list-settings-actions">
        <button className="btn-primary" type="submit" disabled={saving}>{saving ? t('subs.saving') : t('common.save')}</button>
        {message && <span>{message}</span>}
      </div>
    </form>
  );
};

const FieldsPanel = ({ list, fields, defaultFields, onChanged }) => {
  const { t } = useTranslation();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ label: '', type: 'text', required: false });

  const saveField = async (event) => {
    event.preventDefault();
    if (!list?.uid || !form.label) return;
    await listsApi.createField(list.uid, form);
    setForm({ label: '', type: 'text', required: false });
    setShowAdd(false);
    onChanged();
  };

  const deleteField = async (field) => {
    if (!list?.uid || !field.uid || !window.confirm(t('frm.delete_field_confirm', { label: field.label }))) return;
    await listsApi.deleteField(list.uid, field.uid);
    onChanged();
  };

  return (
    <div className="list-fields-layout">
      <section>
        <h3>{t('frm.default_fields')}</h3>
        <div className="list-fields-table">
          {defaultFields.map((field) => (
            <div key={field.key}>
              <span>{field.label}</span>
              <small>{field.type}</small>
              <b>{field.required ? t('frm.required') : t('frm.optional')}</b>
            </div>
          ))}
        </div>
      </section>
      <section>
        <div className="list-fields-head">
          <h3>{t('frm.custom_fields')}</h3>
          <button className="btn-primary" type="button" onClick={() => setShowAdd((current) => !current)}>
            <MaterialIcon name="add" />
            {t('frm.add_field')}
          </button>
        </div>
        {showAdd && (
          <form className="list-fields-add" onSubmit={saveField}>
            <input value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} placeholder={t('frm.field_label')} />
            <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
              <option value="text">{t('frm.field_type_text')}</option>
              <option value="number">{t('frm.field_type_number')}</option>
              <option value="date">{t('frm.field_type_date')}</option>
              <option value="textarea">{t('frm.field_type_textarea')}</option>
            </select>
            <label>
              <input type="checkbox" checked={form.required} onChange={(event) => setForm({ ...form, required: event.target.checked })} />
              {t('frm.required')}
            </label>
            <button className="btn-primary" type="submit">{t('common.save')}</button>
          </form>
        )}
        {fields.length === 0 ? (
          <InitialState icon="fact_check" text={t('frm.no_custom_fields')} />
        ) : (
          <div className="list-fields-table">
            {fields.map((field) => (
              <div key={field.uid}>
                <span>{field.label}</span>
                <small>{field.type}</small>
                <b>{field.required ? t('frm.required') : t('frm.optional')}</b>
                <button type="button" onClick={() => deleteField(field)}>{t('common.delete')}</button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

const titleKeyMap = {
  Settings: 'frm.tab_settings',
  'Manage list fields': 'frm.tab_manage_fields',
};

const ListEmptyTabPage = ({ activeTitle, emptyText }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const displayTitle = titleKeyMap[activeTitle] ? t(titleKeyMap[activeTitle]) : activeTitle;
  const resolvedEmptyText = emptyText || t('frm.no_content_yet');
  const [showWebhook, setShowWebhook] = useState(false);
  const [list, setList] = useState(null);
  const [fields, setFields] = useState([]);
  const [defaultFields, setDefaultFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const icon = iconMap[activeTitle] || 'splitscreen';

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await listsApi.list({ page: 1, per_page: 1 });
        const firstList = data.data?.[0] || null;
        if (!mounted) return;
        setList(firstList);
        if (firstList?.uid && activeTitle === 'Manage list fields') {
          const fieldResponse = await listsApi.fields(firstList.uid);
          if (!mounted) return;
          setFields(fieldResponse.data.fields || []);
          setDefaultFields(fieldResponse.data.default_fields || []);
        }
      } catch {
        if (mounted) setList(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [activeTitle]);

  const reloadFields = async () => {
    if (!list?.uid) return;
    const fieldResponse = await listsApi.fields(list.uid);
    setFields(fieldResponse.data.fields || []);
    setDefaultFields(fieldResponse.data.default_fields || []);
  };

  const renderBody = () => {
    if (loading) return <InitialState icon="sync" text={t('frm.loading_list_details')} />;
    if (!list) return <InitialState icon={icon} text={t('frm.no_lists_yet')} />;
    if (activeTitle === 'Settings') return <SettingsForm list={list} onSaved={setList} />;
    if (activeTitle === 'Manage list fields') {
      return <FieldsPanel list={list} fields={fields} defaultFields={defaultFields} onChanged={reloadFields} />;
    }
    return <InitialState icon={icon} text={resolvedEmptyText} />;
  };

  return (
    <AppLayout>
      <div className="sq-page flex min-h-screen flex-col px-8 py-8 lg:px-14">
        <main className="flex-1">
          <div className="mb-8">
            <p className="text-lg font-normal">{t('common.home')} &gt; {t('nav.lists')}</p>
            <div className="mt-10 flex justify-end gap-3">
              <button className="btn-primary h-11 text-lg font-normal" onClick={() => setShowWebhook(true)}>{t('subs.webhook')}</button>
              <button className="btn-secondary h-11 text-lg font-normal" onClick={() => navigate('/lists/all')}>{t('subs.change_list')} &gt;&gt;</button>
            </div>
          </div>

          <h1 className="mb-8 text-[40px] font-normal text-[rgba(197,192,142,0.22)]">{displayTitle}</h1>

          <p className="mb-10 text-xl font-normal">
            <span className="mr-2 rounded-full bg-[#00bcd4] px-3 py-2 text-white">-</span>
            {t('common.subscribers')}
          </p>

          <ListDetailTabs activeLabel={activeTitle} />

          <div className="mb-10 flex items-center gap-3">
            <MaterialIcon name={icon} className="text-[42px]" />
            <h2 className="text-[38px] font-normal text-white">{displayTitle}</h2>
          </div>

          {renderBody()}
        </main>

        <footer className="pt-10 text-lg font-normal text-[#b8b8c2]">
          {t('common.copyright')}
        </footer>
      </div>
      {showWebhook && <WebhookModal onClose={() => setShowWebhook(false)} listUid={list?.uid} />}
    </AppLayout>
  );
};

export default ListEmptyTabPage;
