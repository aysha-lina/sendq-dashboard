import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { listsApi } from '../../api/services';
import { Spinner, toast } from '../../components/ui';
import { useTranslation } from '../../i18n';
import ListDetailTabs from './ListDetailTabs';
import WebhookModal from './WebhookModal';

const MaterialIcon = ({ name, className = '' }) => (
  <span className={`material-symbols-rounded ${className}`}>{name}</span>
);

// Maps each field type to its i18n key for the displayed type label.
const TYPE_LABEL_KEYS = {
  text: 'ld.type_text', number: 'ld.type_number', dropdown: 'ld.type_dropdown', multiselect: 'ld.type_multiselect',
  checkbox: 'ld.type_checkbox', radio: 'ld.type_radio', date: 'ld.type_date', datetime: 'ld.type_datetime', textarea: 'ld.type_textarea', phone: 'ld.type_phone',
};
const NEW_FIELD_BUTTONS = [
  ['text', 'drag_handle', 'ld.type_text'], ['number', 'pin', 'ld.type_number'], ['dropdown', 'playlist_add_check', 'ld.type_dropdown'],
  ['multiselect', 'checklist_rtl', 'ld.type_multiselect'], ['checkbox', 'check_box', 'ld.type_checkbox'], ['radio', 'check_circle', 'ld.type_radio'],
  ['date', 'event', 'ld.type_date'], ['datetime', 'alarm', 'ld.type_datetime'], ['textarea', 'article', 'ld.type_textarea'], ['phone', 'phone', 'ld.type_phone'],
];
const OPTION_TYPES = ['dropdown', 'multiselect', 'checkbox', 'radio'];

const makeTag = (label) => String(label || '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
let tempSeq = 0;

// options column stores { visible, choices } so we can persist `visible` without a schema change.
const parseOptions = (raw) => {
  if (!raw) return { visible: true, choices: [] };
  if (Array.isArray(raw)) return { visible: true, choices: raw };
  return { visible: raw.visible !== false, choices: Array.isArray(raw.choices) ? raw.choices : [] };
};

const Toggle = ({ on, disabled, onClick }) => (
  <button type="button" disabled={disabled} className={`admin-switch ${on ? 'is-on' : ''} ${disabled ? 'mlf-lock' : ''}`} onClick={onClick} aria-pressed={on}><span /></button>
);

const ManageListFieldsPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [list, setList] = useState(null);
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showWebhook, setShowWebhook] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data: lists } = await listsApi.list({ page: 1, per_page: 1 });
      const first = lists.data?.[0] || null;
      setList(first);
      if (first?.uid) {
        const { data } = await listsApi.fields(first.uid);
        const STD = { EMAIL: 0, FIRST_NAME: 1, LAST_NAME: 2 };
        const mapped = (data.fields || []).map((f) => {
          const o = parseOptions(f.options);
          return { ...f, visible: o.visible, choices: o.choices };
        });
        mapped.sort((a, b) => (STD[a.tag] ?? 100 + (a.sort_order || 0)) - (STD[b.tag] ?? 100 + (b.sort_order || 0)));
        setFields(mapped);
      }
    } catch { setList(null); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const setField = (idx, patch) => setFields((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  const setChoice = (idx, ci, patch) => setFields((prev) => prev.map((f, i) => (i === idx ? { ...f, choices: f.choices.map((c, j) => (j === ci ? { ...c, ...patch } : c)) } : f)));
  const addChoice = (idx) => setField(idx, { choices: [...fields[idx].choices, { label: '', value: '' }] });
  const removeChoice = (idx, ci) => setField(idx, { choices: fields[idx].choices.filter((_, j) => j !== ci) });

  const addField = (type) => setFields((prev) => [...prev, {
    uid: `tmp-${++tempSeq}`, _new: true, label: '', tag: '', type,
    required: false, visible: true, default_value: '', choices: OPTION_TYPES.includes(type) ? [{ label: '', value: '' }] : [],
  }]);

  const deleteField = async (idx) => {
    const f = fields[idx];
    if (f._new) { setFields((prev) => prev.filter((_, i) => i !== idx)); return; }
    if (!window.confirm(t('ld.delete_field_confirm', { label: f.label }))) return;
    try { await listsApi.deleteField(list.uid, f.uid); setFields((prev) => prev.filter((_, i) => i !== idx)); toast.success(t('ld.field_deleted')); }
    catch (err) { toast.error(err.response?.data?.message || t('ld.delete_failed')); }
  };

  const save = async () => {
    if (!list?.uid) return;
    setSaving(true);
    try {
      for (let i = 0; i < fields.length; i++) {
        const f = fields[i];
        const tag = f.tag?.trim() || makeTag(f.label);
        if (!f.label?.trim() || !tag) continue;
        const payload = {
          label: f.label, tag, type: f.type, required: f.required, default_value: f.default_value, sort_order: i,
          options: { visible: f.visible, choices: OPTION_TYPES.includes(f.type) ? f.choices.filter((c) => c.label || c.value) : [] },
        };
        if (f._new) await listsApi.createField(list.uid, payload);
        else await listsApi.updateField(list.uid, f.uid, payload);
      }
      toast.success(t('ld.changes_saved'));
      await load();
    } catch (err) { toast.error(err.response?.data?.message || t('ld.save_failed')); } finally { setSaving(false); }
  };

  const customRow = (f, idx) => {
    const locked = f.tag === 'EMAIL'; // email field can't be deleted or have its required/visible/tag changed
    return (
    <div key={f.uid}>
      <div className="mlf-row">
        <span className="mlf-drag">{!locked && <MaterialIcon name="drag_indicator" />}</span>
        <div className="mlf-label">
          <input className="input" value={f.label} placeholder={t('ld.field_label')} onChange={(e) => setField(idx, { label: e.target.value, tag: f._new && (!f.tag || f.tag === makeTag(f.label)) ? makeTag(e.target.value) : f.tag })} />
          <span className="mlf-type">{TYPE_LABEL_KEYS[f.type] ? t(TYPE_LABEL_KEYS[f.type]) : f.type}</span>
        </div>
        <div className="mlf-toggle"><Toggle on={locked ? true : f.required} disabled={locked} onClick={() => setField(idx, { required: !f.required })} /></div>
        <div className="mlf-toggle"><Toggle on={f.visible} disabled={locked} onClick={() => setField(idx, { visible: !f.visible })} /></div>
        <div className="mlf-tag"><span>{'{SUBSCRIBER_'}</span><input className="input" value={f.tag} readOnly={locked} onChange={(e) => setField(idx, { tag: makeTag(e.target.value) })} /><span>{'}'}</span></div>
        <div className="mlf-default">
          {f.type === 'textarea'
            ? <textarea className="input" rows={1} value={f.default_value || ''} onChange={(e) => setField(idx, { default_value: e.target.value })} />
            : <input className="input" type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : f.type === 'datetime' ? 'datetime-local' : 'text'} value={f.default_value || ''} onChange={(e) => setField(idx, { default_value: e.target.value })} />}
        </div>
        <div className="mlf-del">{!locked && <button type="button" className="btn-secondary admin-icon-btn" onClick={() => deleteField(idx)}><MaterialIcon name="delete_outline" /></button>}</div>
      </div>
      {OPTION_TYPES.includes(f.type) && (
        <div className="mlf-options">
          {f.choices.map((c, ci) => (
            <div key={ci} className="mlf-opt">
              <input className="input" placeholder={t('ld.option_label')} value={c.label} onChange={(e) => setChoice(idx, ci, { label: e.target.value })} />
              <input className="input" placeholder={t('ld.option_value')} value={c.value} onChange={(e) => setChoice(idx, ci, { value: e.target.value })} />
              <button type="button" className="btn-secondary admin-icon-btn" onClick={() => removeChoice(idx, ci)}><MaterialIcon name="close" /></button>
            </div>
          ))}
          <button type="button" className="btn-secondary mlf-addmore" onClick={() => addChoice(idx)}>{t('ld.add_more')}</button>
        </div>
      )}
    </div>
    );
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

          <p className="mb-10 text-xl font-normal">
            <span className="mr-2 rounded-full bg-[#00bcd4] px-3 py-2 text-white">{list?.subscriber_count ?? list?.subscribers_count ?? '-'}</span>
            {t('common.subscribers')}
          </p>

          <ListDetailTabs activeLabel="Manage list fields" />

          <div className="mb-6 flex items-center gap-3">
            <MaterialIcon name="fact_check" className="text-[34px]" />
            <h2 className="text-[30px] font-normal">{t('ld.manage_list_fields')}</h2>
          </div>
          <p className="mb-6 text-base opacity-80">{t('ld.manage_fields_desc')}</p>

          {loading ? <div className="flex h-64 items-center justify-center"><Spinner size="lg" /></div> : !list ? (
            <p className="opacity-70">{t('ld.no_lists_yet')}</p>
          ) : (
            <>
              <div className="mlf-table">
                <div className="mlf-row mlf-head">
                  <span className="mlf-drag" />
                  <div className="mlf-label">{t('ld.label_and_type')}</div>
                  <div className="mlf-toggle">{t('ld.required_q')}</div>
                  <div className="mlf-toggle">{t('ld.visible_q')}</div>
                  <div className="mlf-tag">{t('ld.tag')}</div>
                  <div className="mlf-default">{t('ld.default_value')}</div>
                  <div className="mlf-del" />
                </div>
                {fields.map(customRow)}
              </div>

              <h3 className="mb-3 mt-8 text-xl font-semibold">{t('ld.new_field')}</h3>
              <div className="mlf-newfield">
                {NEW_FIELD_BUTTONS.map(([type, icon, labelKey]) => (
                  <button key={type} type="button" className="btn-secondary mlf-newbtn" onClick={() => addField(type)}>
                    <MaterialIcon name={icon} /> {t(labelKey)}
                  </button>
                ))}
              </div>

              <div className="mt-8">
                <button type="button" className="btn-secondary" onClick={save} disabled={saving}>
                  <MaterialIcon name="check" /> {saving ? t('subs.saving') : t('ld.save_change')}
                </button>
              </div>
            </>
          )}
        </main>

        <footer className="pt-10 text-lg font-normal text-[#b8b8c2]">
          {t('common.copyright')}
        </footer>
      </div>
      {showWebhook && <WebhookModal onClose={() => setShowWebhook(false)} listUid={list?.uid} />}
    </AppLayout>
  );
};

export default ManageListFieldsPage;
