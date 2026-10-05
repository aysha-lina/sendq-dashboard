import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listsApi } from '../../api/services';
import AppLayout from '../../components/layout/AppLayout';
import { FormField, Modal, Spinner } from '../../components/ui';
import useClickOutside from '../../hooks/useClickOutside';
import { useTranslation } from '../../i18n/index.jsx';

const INITIAL_FORM = {
  name: '',
  from_email: '',
  from_name: '',
  default_subject: '',
  subscribe_confirmation: true,
  send_welcome_email: false,
  unsubscribe_notification: false,
};

const MaterialIcon = ({ name, className = '' }) => (
  <span className={`material-symbols-rounded ${className}`}>{name}</span>
);

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toISOString().slice(0, 16).replace('T', ' ');
};

const metricValue = (list, keys) => {
  const found = keys.map((key) => list?.[key]).find((value) => value !== undefined && value !== null && value !== '');
  return found === undefined ? null : found;
};

const Metric = ({ value, label }) => {
  const number = Number(value);
  const hasNumber = Number.isFinite(number);
  const percent = hasNumber ? `${number.toFixed(2)}%` : '-';

  return (
    <div className="min-w-[150px]">
      <p className="text-xl font-normal text-white">{percent}</p>
      <div className="my-1 h-1.5 w-28 rounded-full bg-[#555564]">
        <div className="h-full rounded-full bg-[#ef3c45]" style={{ width: hasNumber ? `${Math.min(100, Math.max(0, number))}%` : '0%' }} />
      </div>
      <p className="text-lg font-normal text-[#a9a8b3]">{label}</p>
    </div>
  );
};

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const RowMenu = ({ list, onDelete, onCopy, onExport, onImport }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  useClickOutside(menuRef, () => setOpen(false), open);

  const actions = [
    { label: t('common.subscribers', null, 'Subscribers'), icon: 'people', run: () => navigate('/lists/contacts') },
    { label: t('nav.segments', null, 'Segments'), icon: 'library_add_check', run: () => navigate('/lists/segments') },
    { label: t('lists.act_embedded_form', null, 'Embedded form'), icon: 'dns', run: () => navigate('/lists/forms') },
    { label: t('lists.act_custom', null, 'Custom forms and emails'), icon: 'web', run: () => navigate('/lists/forms/create') },
    { label: t('lists.act_fields', null, 'Manage list fields'), icon: 'view_day', run: () => navigate('/lists/fields') },
    { label: t('lists.act_verify', null, 'Email verification'), icon: 'gpp_good', run: () => navigate('/lists/email-verification') },
    { label: t('lists.act_edit', null, 'Edit list'), icon: 'edit', run: () => navigate('/lists/settings') },
    { label: t('common.import', null, 'Import'), icon: 'drive_folder_upload', run: () => onImport(list) },
    { label: t('common.export', null, 'Export'), icon: 'downloading', run: () => onExport(list) },
    { label: t('common.copy', null, 'Copy'), icon: 'copy_all', run: () => onCopy(list) },
    { label: t('common.delete', null, 'Delete'), icon: 'delete', run: () => onDelete(list) },
  ];

  return (
    <div ref={menuRef} className="relative">
      <button
        className="btn-secondary h-11 w-12 px-0"
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label="List actions"
      >
        ⌄
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-20 w-[270px] rounded-md border border-[#3f3f55] bg-[#19192f] py-1 shadow-xl">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={() => {
                setOpen(false);
                action.run();
              }}
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-[17px] text-white hover:bg-[#28283e]"
            >
              <MaterialIcon name={action.icon} className="text-[21px]" />
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const ListsPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [lists, setLists] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [sortOrder, setSortOrder] = useState('created_at');
  const [sortDirection, setSortDirection] = useState('desc');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [importTarget, setImportTarget] = useState(null);
  const fileInputRef = useRef(null);

  const fetchLists = async () => {
    setLoading(true);
    try {
      const { data } = await listsApi.list({ page: 1, per_page: 50, keyword, sort_order: sortOrder, sort_direction: sortDirection });
      setLists(data.data || []);
    } catch (err) {
      console.error(err);
      setLists([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLists();
  }, [keyword, sortOrder, sortDirection]);

  const sortedLists = useMemo(() => [...lists], [lists]);

  const allSel = sortedLists.length > 0 && sortedLists.every((l) => selected.has(l.uid));
  const toggleAll = () => setSelected(allSel ? new Set() : new Set(sortedLists.map((l) => l.uid)));
  const toggleRow = (uid) => setSelected((p) => { const n = new Set(p); if (n.has(uid)) n.delete(uid); else n.add(uid); return n; });
  const handleBulkDelete = async () => {
    const uids = [...selected];
    if (!uids.length) return;
    if (!window.confirm(t('lists.confirm_bulk_delete', { n: uids.length }, `Delete ${uids.length} selected list(s)?`))) return;
    await Promise.allSettled(uids.map((uid) => listsApi.delete(uid)));
    setSelected(new Set());
    fetchLists();
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    setSaving(true);
    setFormErrors({});
    try {
      await listsApi.create(form);
      setShowCreate(false);
      setForm(INITIAL_FORM);
      fetchLists();
    } catch (err) {
      if (err.response?.data?.errors) {
        const errors = {};
        err.response.data.errors.forEach((item) => { errors[item.path] = item.msg; });
        setFormErrors(errors);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (list) => {
    if (!window.confirm(t('lists.confirm_delete', { name: list.name || 'this list' }, `Delete ${list.name || 'this list'}?`))) return;
    try {
      await listsApi.delete(list.uid);
      fetchLists();
    } catch (error) {
      console.error(error);
    }
  };

  const handleCopy = async (list) => {
    try {
      // Server-side copy duplicates the list settings AND its custom fields.
      await listsApi.copy(list.uid, `${list.name} (copy)`);
      fetchLists();
    } catch (error) {
      console.error(error);
    }
  };

  const handleExport = async (list) => {
    try {
      const response = await listsApi.exportSubscribers(list.uid);
      downloadBlob(response.data, `${list.uid}-subscribers.csv`);
    } catch (error) {
      console.error(error);
    }
  };

  const handleImport = (list) => {
    setImportTarget(list);
    fileInputRef.current?.click();
  };

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !importTarget?.uid) return;
    try {
      await listsApi.importSubscribers(importTarget.uid, { csv: await file.text() });
      setImportTarget(null);
      navigate('/lists/contacts');
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <AppLayout>
      <div className="sq-page px-8 py-8 lg:px-14">
        <input ref={fileInputRef} className="sr-only" type="file" accept=".csv,.txt" onChange={handleImportFile} />
        <p className="mb-7 text-lg font-normal">{t('common.home', null, 'Home')}</p>
        <h1 className="sq-section-title mb-24 flex items-center gap-5 text-[40px]">
          <MaterialIcon name="format_list_bulleted" className="text-[40px]" /> {t('lists.my_lists', null, 'My lists')}
        </h1>

        {selected.size > 0 && (
          <div className="mb-4 flex items-center gap-4 rounded-lg bg-[#1f1f33] px-5 py-3">
            <span className="text-lg text-white">{selected.size} {t('common.selected', null, 'selected')}</span>
            <button type="button" className="btn-danger h-10" onClick={handleBulkDelete}>
              <MaterialIcon name="delete_outline" className="text-[20px]" /> {t('common.delete_selected', null, 'Delete selected')}
            </button>
          </div>
        )}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input type="checkbox" className="h-6 w-6 rounded border border-[#666679] bg-transparent" checked={allSel} onChange={toggleAll} />
          <span className="text-lg font-normal text-[#b9b9c4]">{t('common.sort_by', null, 'Sort by')}</span>
          <select className="input h-11 max-w-[136px] text-lg" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)}>
            <option value="created_at">{t('common.created_at', null, 'Created at')}</option>
            <option value="name">{t('common.name', null, 'Name')}</option>
          </select>
          <button
            className="btn-secondary h-11 w-11 px-0"
            type="button"
            onClick={() => setSortDirection((current) => (current === 'desc' ? 'asc' : 'desc'))}
            title="Change sort direction"
          >
            <MaterialIcon name="sort" className="text-[22px]" />
          </button>
          <div className="relative">
            <input
              className="input h-11 w-[250px] pr-10 text-lg"
              placeholder={t('common.type_to_search', null, 'Type to search')}
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
            />
            <MaterialIcon name="search" className="absolute right-3 top-2.5 text-[22px] text-[#b9b9c4]" />
          </div>
          <button className="btn-primary ml-auto h-11 text-lg font-normal" type="button" onClick={() => setShowCreate(true)}>
            <MaterialIcon name="add" className="text-[22px]" /> {t('lists.create', null, 'Create list')}
          </button>
        </div>

        <div className="border-t border-[#303044]">
          {loading ? (
            <div className="flex h-64 items-center justify-center"><Spinner size="lg" /></div>
          ) : sortedLists.length === 0 ? (
            <div className="flex h-[326px] flex-col items-center justify-center rounded-xl bg-[#29293f] text-xl font-normal text-[#b8b7c2]">
              <MaterialIcon name="auto_awesome" className="mb-5 text-[64px] text-[#747587]" />
              <span>{keyword ? t('common.no_result', null, 'No search result') : t('lists.no_lists', null, 'There are no lists yet')}</span>
            </div>
          ) : sortedLists.map((list) => {
            const subscribers = metricValue(list, ['subscriber_count', 'subscribers_count', 'subscribers']);
            const openRate = metricValue(list, ['open_rate', 'uniq_open_rate', 'uniqOpenRate']);
            const clickRate = metricValue(list, ['click_rate', 'clicked_rate', 'clickedRate']);

            return (
              <div key={list.uid} className="grid grid-cols-[28px_minmax(260px,1fr)_150px_150px_150px_260px] items-start gap-8 border-b border-[#303044] py-8">
                <input type="checkbox" className="mt-1 h-6 w-6 rounded border border-[#666679] bg-transparent" checked={selected.has(list.uid)} onChange={() => toggleRow(list.uid)} />
                <div>
                  <button
                    type="button"
                    onClick={() => navigate(`/lists/${list.uid}/statistics`)}
                    className="text-left text-xl font-normal text-[#00aeca]"
                  >
                    {list.name || '-'}
                  </button>
                  <p className="text-lg font-normal text-[#b9b9c4]">{t('common.created_at', null, 'Created at')}: {formatDate(list.created_at)}</p>
                </div>
                <div>
                  <p className="text-xl font-normal text-[#00aeca]">{subscribers ?? '-'}</p>
                  <p className="text-lg font-normal text-[#a9a8b3]">{t('common.subscribers', null, 'Subscribers')}</p>
                </div>
                <Metric value={openRate} label={t('common.open_rate', null, 'Open rate')} />
                <Metric value={clickRate} label={t('common.click_rate', null, 'Click rate')} />
                <div className="flex justify-end gap-1">
                  <button className="btn-primary h-11 w-12 px-0" type="button" title={t('lists.create_subscriber', null, 'Create subscriber')} onClick={() => navigate('/lists/contacts?action=add-subscriber')}>
                    <MaterialIcon name="person_add" className="text-[22px]" />
                  </button>
                  <button className="btn-danger h-11 text-lg font-normal" type="button" onClick={() => navigate(`/lists/${list.uid}/statistics`)}>
                    <MaterialIcon name="multiline_chart" className="text-[22px]" /> {t('common.statistics', null, 'Statistics')}
                  </button>
                  <RowMenu list={list} onDelete={handleDelete} onCopy={handleCopy} onExport={handleExport} onImport={handleImport} />
                </div>
              </div>
            );
          })}
        </div>

        <Modal open={showCreate} onClose={() => setShowCreate(false)} title={t('lists.new_modal_title', null, 'New Mail List')}>
          <form onSubmit={handleCreate}>
            <FormField label={t('lists.list_name', null, 'List Name')} error={formErrors.name} required>
              <input className="input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label={t('lists.from_email', null, 'From Email')} error={formErrors.from_email} required>
                <input type="email" className="input" value={form.from_email} onChange={(event) => setForm({ ...form, from_email: event.target.value })} />
              </FormField>
              <FormField label={t('lists.from_name', null, 'From Name')} error={formErrors.from_name} required>
                <input className="input" value={form.from_name} onChange={(event) => setForm({ ...form, from_name: event.target.value })} />
              </FormField>
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" className="btn-secondary" onClick={() => setShowCreate(false)}>{t('common.cancel', null, 'Cancel')}</button>
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? t('lists.creating', null, 'Creating...') : t('lists.create', null, 'Create list')}</button>
            </div>
          </form>
        </Modal>
      </div>
    </AppLayout>
  );
};

export default ListsPage;
