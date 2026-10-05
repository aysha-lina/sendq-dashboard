import { useEffect, useRef, useState } from 'react';
import useClickOutside from '../../hooks/useClickOutside';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { FormField, Modal, Spinner, toast } from '../../components/ui';
import { listsApi, subscribersApi } from '../../api/services';
import { useTranslation } from '../../i18n/index.jsx';
import ListDetailTabs from '../lists/ListDetailTabs';
import WebhookModal from '../lists/WebhookModal';

const MaterialIcon = ({ name, className = '' }) => (
  <span className={`material-symbols-rounded ${className}`}>{name}</span>
);

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toISOString().slice(0, 16).replace('T', ' ');
};

const STATUS_PILL_COLORS = {
  subscribed: 'bg-[#b8e779] text-[#10200d]',
  unsubscribed: 'bg-[#f0b8b8] text-[#3a0d0d]',
  unconfirmed: 'bg-[#f0dcb8] text-[#3a2c0d]',
  'spam-reported': 'bg-[#e0b8f0] text-[#2c0d3a]',
  blacklisted: 'bg-[#cfcfcf] text-[#222]',
};
const StatusPill = ({ status }) => (
  <span className={`inline-flex max-w-full rounded-md px-3 py-1 text-xs font-semibold uppercase ${STATUS_PILL_COLORS[status] || STATUS_PILL_COLORS.subscribed}`}>
    {status || 'subscribed'}
  </span>
);

const VERIFY_COLORS = {
  deliverable: 'bg-[#1f8f4d]', undeliverable: 'bg-[#b3403f]', risky: 'bg-[#8a6d1f]', unknown: 'bg-[#6b7280]',
};
const VerificationBadge = ({ result }) => {
  if (!result) return null;
  return (
    <span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold uppercase text-white ${VERIFY_COLORS[result] || 'bg-[#6b7280]'}`}>
      {result}
    </span>
  );
};

const SubscriberRow = ({ subscriber, columns = [], onEdit, onDelete, onSetStatus, onCopyMove, onSendConfirmation, selected, onToggle }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  useClickOutside(menuRef, () => setOpen(false), open);
  const tags = (subscriber.tags || '').split(',').map((t) => t.trim()).filter(Boolean);

  return (
    <div className="grid min-h-[100px] grid-cols-[28px_56px_minmax(240px,1fr)_minmax(190px,260px)_minmax(190px,260px)_104px] items-center gap-5 border-b border-[#28283d] py-5">
      <input
        type="checkbox"
        className="h-6 w-6 rounded border border-[#666679] bg-transparent"
        checked={selected}
        onChange={() => onToggle(subscriber.uid)}
      />
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#d7d7d7]">
        <MaterialIcon name="person" className="text-[34px] text-[#9d9da4]" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xl font-normal text-[#00aeca]">{subscriber.email || '-'}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          <StatusPill status={subscriber.status} />
          <VerificationBadge result={subscriber.verification_status} />
          {tags.map((tag) => (
            <span key={tag} className="rounded-md bg-[#33334d] px-2 py-0.5 text-xs text-[#c9c9d6]">{tag}</span>
          ))}
        </div>
        {columns.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5">
            {columns.map((c) => (
              <span key={c.tag} className="text-sm text-[#9a9aa6]">
                <span className="text-[#74748a]">{c.label}:</span> {subscriber.custom_fields?.[c.tag] || '—'}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-xl font-normal text-white">{formatDate(subscriber.created_at)}</p>
        <p className="text-lg font-normal text-[#8e8d99]">{t('common.created_at', null, 'Created at')}</p>
      </div>
      <div className="min-w-0">
        <p className="truncate text-xl font-normal text-white">{formatDate(subscriber.updated_at)}</p>
        <p className="text-lg font-normal text-[#8e8d99]">{t('common.updated_at', null, 'Updated at')}</p>
      </div>
      <div ref={menuRef} className="relative flex justify-end gap-1">
        <button className="btn-primary h-11 w-12 px-0" type="button" title={t('common.edit', null, 'Edit')} onClick={() => onEdit(subscriber)}>
          <MaterialIcon name="edit" className="text-[22px]" />
        </button>
        <button className="btn-secondary h-11 w-12 px-0" type="button" title={t('subs.more', null, 'More')} onClick={() => setOpen((current) => !current)}>
          ⌄
        </button>
        {open && (
          <div className="absolute right-0 top-12 z-20 w-[230px] rounded-md border border-[#3f3f55] bg-[#19192f] py-1 shadow-xl">
            <button className="flex w-full items-center gap-3 px-4 py-3 text-left text-[17px] text-white hover:bg-[#28283e]" type="button" onClick={() => { setOpen(false); onSetStatus(subscriber, 'subscribed'); }}>
              <MaterialIcon name="mail" className="text-[21px]" /> {t('subs.act_subscribe', null, 'Subscribe')}
            </button>
            <button className="flex w-full items-center gap-3 px-4 py-3 text-left text-[17px] text-white hover:bg-[#28283e]" type="button" onClick={() => { setOpen(false); onSetStatus(subscriber, 'unsubscribed'); }}>
              <MaterialIcon name="logout" className="text-[21px]" /> {t('subs.act_unsubscribe', null, 'Unsubscribe')}
            </button>
            <button className="flex w-full items-center gap-3 px-4 py-3 text-left text-[17px] text-white hover:bg-[#28283e]" type="button" onClick={() => { setOpen(false); onCopyMove(subscriber, 'copy'); }}>
              <MaterialIcon name="content_copy" className="text-[21px]" /> {t('subs.act_copy_to', null, 'Copy to')}
            </button>
            <button className="flex w-full items-center gap-3 px-4 py-3 text-left text-[17px] text-white hover:bg-[#28283e]" type="button" onClick={() => { setOpen(false); onCopyMove(subscriber, 'move'); }}>
              <MaterialIcon name="moving" className="text-[21px]" /> {t('subs.act_move_to', null, 'Move to')}
            </button>
            <button className="flex w-full items-center gap-3 px-4 py-3 text-left text-[17px] text-white hover:bg-[#28283e]" type="button" onClick={() => { setOpen(false); onSendConfirmation(subscriber); }}>
              <MaterialIcon name="mark_email_read" className="text-[21px]" /> {t('subs.act_send_confirmation', null, 'Send Confirmation Email')}
            </button>
            <button className="flex w-full items-center gap-3 px-4 py-3 text-left text-[17px] text-white hover:bg-[#28283e]" type="button" onClick={() => { setOpen(false); onDelete(subscriber); }}>
              <MaterialIcon name="delete_outline" className="text-[21px]" /> {t('common.delete', null, 'Delete')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const NewSubscriberModal = ({ open, subscriber, listUid, onClose, onSaved, onError }) => {
  const { t } = useTranslation();
  const [form, setForm] = useState({ email: '', first_name: '', last_name: '', status: 'subscribed', tags: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      email: subscriber?.email || '',
      first_name: subscriber?.first_name || '',
      last_name: subscriber?.last_name || '',
      status: subscriber?.status || 'subscribed',
      tags: subscriber?.tags || '',
    });
  }, [subscriber, open]);

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (subscriber?.uid) {
        await subscribersApi.update(subscriber.uid, form);
      } else {
        await subscribersApi.create({ ...form, list_uid: listUid });
      }
      onSaved();
      onClose();
    } catch (error) {
      console.error(error);
      onError(error.response?.data?.message || t('subs.save_fail', null, 'Unable to save subscriber.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={subscriber?.uid ? t('subs.edit_subscriber', null, 'Edit subscriber') : t('subs.new_subscriber', null, 'New subscriber')}>
      <form onSubmit={save}>
        <FormField label={t('subs.email_address', null, 'Email address')} required>
          <input type="email" className="input" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label={t('auth.first_name', null, 'First name')}>
            <input className="input" value={form.first_name} onChange={(event) => setForm({ ...form, first_name: event.target.value })} />
          </FormField>
          <FormField label={t('auth.last_name', null, 'Last name')}>
            <input className="input" value={form.last_name} onChange={(event) => setForm({ ...form, last_name: event.target.value })} />
          </FormField>
        </div>
        <FormField label={t('common.status', null, 'Status')}>
          <select className="input" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
            <option value="subscribed">{t('subs.st_subscribed', null, 'Subscribed')}</option>
            <option value="unsubscribed">{t('subs.st_unsubscribed', null, 'Unsubscribed')}</option>
            <option value="unconfirmed">{t('subs.st_unconfirmed', null, 'Unconfirmed')}</option>
            <option value="spam-reported">{t('subs.st_spam', null, 'Spam reported')}</option>
            <option value="blacklisted">{t('subs.st_blacklisted', null, 'Blacklisted')}</option>
          </select>
        </FormField>
        <FormField label={t('subs.tags_label', null, 'Tags (comma-separated)')}>
          <input className="input" value={form.tags} placeholder="vip, newsletter" onChange={(event) => setForm({ ...form, tags: event.target.value })} />
        </FormField>
        <div className="flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('common.cancel', null, 'Cancel')}</button>
          <button type="submit" className="btn-primary" disabled={saving || !form.email}>{saving ? t('subs.saving', null, 'Saving...') : t('common.save', null, 'Save')}</button>
        </div>
      </form>
    </Modal>
  );
};

const TIMELINE_ICONS = {
  subscribed: 'person_add', sent: 'mail', open: 'drafts', click: 'ads_click',
  bounce: 'error', unsubscribe: 'unsubscribe', feedback: 'report',
};

const TimelineDrawer = ({ subscriber, onClose }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    subscribersApi.timeline(subscriber.uid)
      .then(({ data: res }) => setData(res))
      .catch(() => setData({ events: [] }))
      .finally(() => setLoading(false));
  }, [subscriber.uid]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <div className="h-full w-[460px] max-w-full overflow-y-auto bg-[#16162a] p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h3 className="text-2xl text-white">Activity timeline</h3>
            <p className="text-base text-[#9a9aa8]">{subscriber.email}</p>
          </div>
          <button type="button" className="text-2xl text-[#9a9aa8]" onClick={onClose}>✕</button>
        </div>
        {loading ? (
          <div className="flex h-40 items-center justify-center"><Spinner /></div>
        ) : !data?.events?.length ? (
          <p className="text-lg text-[#9a9aa8]">No activity recorded yet.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {data.events.map((ev, i) => (
              <li key={i} className="flex gap-3">
                <span className="material-symbols-rounded text-[22px] text-[#00aeca]">{TIMELINE_ICONS[ev.type] || 'circle'}</span>
                <div>
                  <p className="text-lg text-white">{ev.label}</p>
                  <p className="text-sm text-[#8e8d99]">{new Date(ev.at).toLocaleString()}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

// Copy / Move dialog — pick a target list + how to handle existing emails.
const CopyMoveDialog = ({ mode, count, lists, currentListUid, onSubmit, onClose }) => {
  const { t } = useTranslation();
  const [target, setTarget] = useState('');
  const [updateExisting, setUpdateExisting] = useState(true);
  const [busy, setBusy] = useState(false);
  const title = mode === 'copy' ? t('subs.copy_title', null, 'Copy subscriber(s)') : t('subs.move_title', null, 'Move subscriber(s)');
  const intro = mode === 'copy'
    ? t('subs.copy_intro', { count }, `You're about to copy ${count} subscriber(s)`)
    : t('subs.move_intro', { count }, `You're about to move ${count} subscriber(s)`);
  const options = lists.filter((l) => l.uid !== currentListUid);

  const submit = async () => {
    if (!target) { toast.error(t('subs.select_target_err', null, 'Please select a target list.')); return; }
    setBusy(true);
    try { await onSubmit({ target, updateExisting }); } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="relative w-[680px] max-w-full rounded-xl bg-[#1b1b30] p-8 text-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="absolute right-5 top-5 text-2xl text-[#9a9aae] hover:text-white" onClick={onClose}>×</button>
        <h2 className="mb-5 text-3xl font-semibold text-[#c9c9d6]">{title}</h2>
        <p className="mb-6 text-lg" dangerouslySetInnerHTML={{ __html: intro.replace(String(count), `<strong>${count}</strong>`) }} />

        <label className="mb-2 block text-lg font-semibold">{t('subs.select_target', null, 'Select the target list')}</label>
        <select className="input mb-6 h-12 w-full text-lg" value={target} onChange={(e) => setTarget(e.target.value)}>
          <option value="">{t('subs.choose', null, 'Choose')}</option>
          {options.map((l) => <option key={l.uid} value={l.uid}>{l.name}</option>)}
        </select>

        <p className="mb-3 text-lg font-semibold">{t('subs.exists_action', null, 'Choose the action when email exists in the target list')}</p>
        <label className="mb-2 flex items-center gap-3 text-lg">
          <input type="radio" name="cm-update" checked={updateExisting} onChange={() => setUpdateExisting(true)} className="h-5 w-5 accent-[#d32f2f]" />
          {t('subs.update_info', null, 'Update subscriber information')}
        </label>
        <label className="mb-7 flex items-center gap-3 text-lg">
          <input type="radio" name="cm-update" checked={!updateExisting} onChange={() => setUpdateExisting(false)} className="h-5 w-5 accent-[#d32f2f]" />
          {t('subs.no_update_info', null, "Don't update subscriber information")}
        </label>

        <div className="flex items-center gap-5">
          <button type="button" className="btn-danger h-11 px-7 text-lg" onClick={submit} disabled={busy}>{busy ? t('subs.working', null, 'Working…') : t('subs.submit', null, 'Submit')}</button>
          <button type="button" className="text-lg text-[#9a9aae] hover:text-white" onClick={onClose}>{t('common.cancel', null, 'Cancel')}</button>
        </div>
      </div>
    </div>
  );
};

// "Are you sure?" confirm dialog (used for Send Confirmation Email + Delete).
const ConfirmDialog = ({ message, onConfirm, onClose }) => {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const confirm = async () => { setBusy(true); try { await onConfirm(); } finally { setBusy(false); } };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="relative w-[620px] max-w-full rounded-xl bg-[#1b1b30] p-8 text-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="absolute right-5 top-5 text-2xl text-[#9a9aae] hover:text-white" onClick={onClose}>×</button>
        <h2 className="mb-6 flex items-center gap-2 text-3xl font-semibold text-[#c9c9d6]">
          <MaterialIcon name="help" className="text-[28px]" /> {t('subs.are_you_sure', null, 'Are you sure?')}
        </h2>
        <p className="mb-8 text-lg">{message}</p>
        <div className="flex items-center justify-center gap-6">
          <button type="button" className="text-lg font-bold underline" onClick={onClose}>{t('common.cancel', null, 'Cancel')}</button>
          <button type="button" className="btn-secondary h-11 px-8 text-lg" onClick={confirm} disabled={busy}>{busy ? t('subs.working', null, 'Working…') : t('common.confirm', null, 'Confirm')}</button>
        </div>
      </div>
    </div>
  );
};

const SubscribersPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [subscribers, setSubscribers] = useState([]);
  const [total, setTotal] = useState(null);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('');
  const [verification, setVerification] = useState('');
  const [sort, setSort] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');
  const [loading, setLoading] = useState(true);
  const [showWebhook, setShowWebhook] = useState(false);
  const [showSubscriberModal, setShowSubscriberModal] = useState(searchParams.get('action') === 'add-subscriber');
  const [editingSubscriber, setEditingSubscriber] = useState(null);
  const [lists, setLists] = useState([]);
  const [list, setList] = useState(null);
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [timelineSub, setTimelineSub] = useState(null);
  const [copyMove, setCopyMove] = useState(null); // { mode, subscriber }
  const [confirmAction, setConfirmAction] = useState(null); // { message, run }
  const [fields, setFields] = useState([]); // custom list fields (column options)
  const [visibleCols, setVisibleCols] = useState([]); // selected custom-field tags
  const [colsOpen, setColsOpen] = useState(false);
  const colsRef = useRef(null);
  useClickOutside(colsRef, () => setColsOpen(false), colsOpen);

  useEffect(() => {
    listsApi.list({ page: 1, per_page: 100 })
      .then(({ data }) => {
        const all = data.data || [];
        setLists(all);
        setList(all[0] || null);
      })
      .catch(() => setLists([]));
  }, []);

  // Custom list fields drive the "Columns" selector (standard email/name are always shown).
  useEffect(() => {
    if (!list?.uid) { setFields([]); return; }
    listsApi.fields(list.uid)
      .then(({ data }) => setFields(
        (data.fields || []).filter((f) => !['EMAIL', 'FIRST_NAME', 'LAST_NAME'].includes(f.tag)),
      ))
      .catch(() => setFields([]));
  }, [list?.uid]);

  const fetchSubscribers = async () => {
    setLoading(true);
    try {
      const { data } = await subscribersApi.list({
        page: 1,
        per_page: 50,
        keyword,
        status,
        verification_result: verification,
        list_uid: list?.uid,
      });
      setSubscribers(data.data || []);
      setTotal(data.pagination?.total ?? (data.data || []).length);
    } catch (err) {
      console.error(err);
      setSubscribers([]);
      setTotal(null);
    } finally {
      setLoading(false);
    }
  };

  // `imported` is bumped by the Subscribers ▸ Import action so the list refetches
  // even when we're already on /lists/contacts.
  const importedToken = searchParams.get('imported');
  useEffect(() => {
    fetchSubscribers();
    setSelected(new Set()); // clear selection when the filter/list changes
  }, [keyword, status, verification, list?.uid, importedToken]);

  // Delete a single subscriber via the "Are you sure?" dialog.
  const deleteSubscriber = (subscriber) => {
    if (!subscriber.uid) return;
    setConfirmAction({
      message: t('subs.confirm_delete_one', null, "You're about to delete 1 subscriber(s) from the list."),
      run: async () => {
        try {
          await subscribersApi.delete(subscriber.uid);
          toast.success(t('subs.deleted', null, 'Subscriber deleted.'));
          fetchSubscribers();
        } catch (error) {
          toast.error(error.response?.data?.message || t('subs.delete_fail', null, 'Unable to delete subscriber.'));
        } finally {
          setConfirmAction(null);
        }
      },
    });
  };

  // Send Confirmation Email — confirm dialog, then actually dispatch the email.
  const sendConfirmation = (subscriber) => {
    if (!subscriber.uid) return;
    setConfirmAction({
      message: t('subs.confirm_send_one', null, "You're about to send confirmation email(s) to 1 subscriber(s) from the list."),
      run: async () => {
        try {
          const { data } = await subscribersApi.bulkSendConfirmation({ uids: [subscriber.uid], list_uid: list?.uid });
          toast.success(data.message || t('subs.confirmation_sent', null, 'Confirmation email sent.'));
        } catch (error) {
          toast.error(error.response?.data?.message || t('subs.confirmation_fail', null, 'Unable to send confirmation email.'));
        } finally {
          setConfirmAction(null);
        }
      },
    });
  };

  // Copy / Move dialog submit.
  const submitCopyMove = async ({ target, updateExisting }) => {
    const { mode, subscriber } = copyMove;
    try {
      const payload = { uids: [subscriber.uid], target_list_uid: target, update_existing: updateExisting };
      const { data } = mode === 'copy'
        ? await subscribersApi.bulkCopy(payload)
        : await subscribersApi.bulkMove(payload);
      toast.success(data.message || (mode === 'copy' ? t('subs.copied', null, 'Subscriber copied.') : t('subs.moved', null, 'Subscriber moved.')));
      setCopyMove(null);
      fetchSubscribers();
    } catch (error) {
      toast.error(error.response?.data?.message || t('subs.action_fail', null, 'Action failed.'));
    }
  };

  // ─── Selection + bulk operations ────────────────────────────────────────────
  const toggleOne = (uid) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(uid)) next.delete(uid); else next.add(uid);
    return next;
  });

  const sortedSubscribers = [...subscribers].sort((a, b) => {
    const av = String((sort === 'email' ? a.email : a[sort]) || a.created_at || '');
    const bv = String((sort === 'email' ? b.email : b[sort]) || b.created_at || '');
    const cmp = av.localeCompare(bv);
    return sortDir === 'desc' ? -cmp : cmp;
  });

  const allOnPageSelected = subscribers.length > 0 && subscribers.every((s) => selected.has(s.uid));
  const toggleAll = () => setSelected(() => {
    if (allOnPageSelected) return new Set();
    return new Set(subscribers.map((s) => s.uid));
  });

  const runBulk = async (fn, confirmText) => {
    if (selected.size === 0) return;
    if (confirmText && !window.confirm(confirmText)) return;
    setBulkBusy(true);
    setMessage('');
    try {
      const { data } = await fn([...selected]);
      setMessage(data.message || t('subs.done', null, 'Done.'));
      setSelected(new Set());
      fetchSubscribers();
    } catch (error) {
      setMessage(error.response?.data?.message || t('subs.bulk_fail', null, 'Bulk action failed.'));
    } finally {
      setBulkBusy(false);
    }
  };

  const setSubscriberStatus = async (subscriber, newStatus) => {
    try {
      await subscribersApi.update(subscriber.uid, { status: newStatus });
      toast.success(newStatus === 'subscribed'
        ? t('subs.toast_subscribed', null, 'One or more subscribers were successfully subscribed')
        : t('subs.toast_unsubscribed', null, 'One or more subscribers were successfully unsubscribed'));
      fetchSubscribers();
    } catch (error) {
      toast.error(error.response?.data?.message || t('subs.update_fail', null, 'Could not update subscriber.'));
    }
  };

  const bulkDelete = () => runBulk(
    (uids) => subscribersApi.bulkDelete({ uids }),
    t('subs.confirm_bulk_delete', { n: selected.size }, `Delete ${selected.size} selected subscriber(s)? This cannot be undone.`),
  );
  const bulkStatus = (newStatus) => { if (newStatus) runBulk((uids) => subscribersApi.bulkStatus({ uids, status: newStatus })); };
  const bulkMoveOrCopy = (targetUid, mode) => {
    if (!targetUid) return;
    const fn = mode === 'copy'
      ? (uids) => subscribersApi.bulkCopy({ uids, target_list_uid: targetUid })
      : (uids) => subscribersApi.bulkMove({ uids, target_list_uid: targetUid });
    runBulk(fn);
  };
  const bulkTag = (mode) => {
    const tag = window.prompt(mode === 'remove'
      ? t('subs.prompt_remove_tag', null, 'Tag to remove from selected subscribers:')
      : t('subs.prompt_add_tag', null, 'Tag to add to selected subscribers:'));
    if (!tag || !tag.trim()) return;
    runBulk((uids) => (mode === 'remove'
      ? subscribersApi.bulkRemoveTag({ uids, tag: tag.trim() })
      : subscribersApi.bulkAddTag({ uids, tag: tag.trim() })));
  };
  const bulkBlacklist = () => runBulk(
    (uids) => subscribersApi.bulkBlacklist({ uids }),
    t('subs.confirm_bulk_blacklist', { n: selected.size }, `Blacklist ${selected.size} selected subscriber(s)? They will be suppressed from future sends.`),
  );

  return (
    <AppLayout>
      <div className="sq-page px-8 py-8 lg:px-14">
        <div className="mb-8">
          <p className="text-lg font-normal">{t('common.home', null, 'Home')} &gt; {t('nav.lists', null, 'Lists')}</p>
          <div className="mt-10 flex flex-wrap items-center justify-end gap-3">
            {lists.length > 1 && (
              <select
                className="input h-11 text-lg"
                value={list?.uid || ''}
                onChange={(e) => setList(lists.find((l) => l.uid === e.target.value) || null)}
              >
                {lists.map((l) => (
                  <option key={l.uid} value={l.uid}>{l.name}</option>
                ))}
              </select>
            )}
            <button className="btn-primary h-11 text-lg font-normal" onClick={() => setShowWebhook(true)}>{t('subs.webhook', null, 'Webhook')}</button>
            <button className="btn-secondary h-11 text-lg font-normal" onClick={() => navigate('/lists/all')}>{t('subs.change_list', null, 'Change list')} &gt;&gt;</button>
          </div>
        </div>

        <h1 className="mb-8 text-[40px] font-normal text-[rgba(197,192,142,0.22)]">{t('subs.contacts', null, 'Contacts')}</h1>
        <p className="mb-10 text-xl font-normal">
          <span className="mr-2 rounded-full bg-[#00bcd4] px-3 py-2 text-white">{total ?? '-'}</span>
          {t('common.subscribers', null, 'Subscribers')}
        </p>

        <ListDetailTabs activeLabel="Subscribers" />
        {message && <p className="mb-5 text-lg text-[#bfc0ca]">{message}</p>}

        <div className="mb-12 flex items-center justify-between gap-6">
          <h2 className="flex items-center gap-3 text-[36px] font-normal text-white">
            <MaterialIcon name="people" className="text-[38px]" /> {t('common.subscribers', null, 'Subscribers')}
          </h2>
          <button
            className="btn-primary shrink-0 text-lg font-normal"
            onClick={() => {
              setEditingSubscriber(null);
              setShowSubscriberModal(true);
            }}
          >
            <MaterialIcon name="add" className="text-[22px]" /> {t('subs.new_subscriber', null, 'New subscriber')}
          </button>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <select
            className="input h-11 max-w-[110px] text-lg"
            value=""
            onChange={(e) => {
              if (e.target.value === 'all') setSelected(new Set(subscribers.map((s) => s.uid)));
              else if (e.target.value === 'none') setSelected(new Set());
              e.target.value = '';
            }}
          >
            <option value="">{t('subs.select', null, 'Select')}</option>
            <option value="all">{t('subs.select_all', null, 'Select all')}</option>
            <option value="none">{t('subs.select_none', null, 'Select none')}</option>
          </select>
          <span className="text-lg font-normal text-[#b9b9c4]">{t('common.sort_by', null, 'Sort by')}</span>
          <select className="input h-11 max-w-[136px] text-lg" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="created_at">{t('common.created_at', null, 'Created at')}</option>
            <option value="email">{t('subs.email', null, 'Email')}</option>
          </select>
          <button type="button" className="btn-secondary h-11 w-11 px-0" title={t('common.sort_direction', null, 'Sort direction')} onClick={() => setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))}><MaterialIcon name="sort" className="text-[22px]" /></button>
          <select className="input h-11 max-w-[180px] text-lg" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">{t('subs.all_subscribers', null, 'All subscribers')}</option>
            <option value="subscribed">{t('subs.st_subscribed', null, 'Subscribed')}</option>
            <option value="unsubscribed">{t('subs.st_unsubscribed', null, 'Unsubscribed')}</option>
            <option value="unconfirmed">{t('subs.st_unconfirmed', null, 'Unconfirmed')}</option>
            <option value="spam-reported">{t('subs.st_spam', null, 'Spam reported')}</option>
            <option value="blacklisted">{t('subs.st_blacklisted', null, 'Blacklisted')}</option>
          </select>
          <select className="input h-11 max-w-[180px] text-lg" value={verification} onChange={(event) => setVerification(event.target.value)}>
            <option value="">{t('subs.all_verification', null, 'All verification')}</option>
            <option value="deliverable">{t('subs.ver_deliverable', null, 'Deliverable')}</option>
            <option value="undeliverable">{t('subs.ver_undeliverable', null, 'Undeliverable')}</option>
            <option value="risky">{t('subs.ver_risky', null, 'Risky')}</option>
            <option value="unknown">{t('subs.ver_unknown', null, 'Unknown')}</option>
          </select>
          <div className="relative min-w-[240px] max-w-[320px] flex-1">
            <input className="input h-11 pr-10 text-lg" placeholder={t('common.type_to_search', null, 'Type to search')} value={keyword} onChange={(event) => setKeyword(event.target.value)} />
            <MaterialIcon name="search" className="absolute right-3 top-2.5 text-[22px] text-[#b9b9c4]" />
          </div>
          {fields.length > 0 && (
            <div className="relative" ref={colsRef}>
              <button type="button" className="btn-secondary h-11 text-lg" onClick={() => setColsOpen((o) => !o)}>
                <MaterialIcon name="view_column" className="text-[20px]" /> {t('subs.columns', null, 'Columns')}
              </button>
              {colsOpen && (
                <div className="absolute right-0 top-12 z-30 w-[240px] rounded-md border border-[#3f3f55] bg-[#19192f] py-2 shadow-xl">
                  {fields.map((f) => (
                    <label key={f.tag} className="flex cursor-pointer items-center gap-3 px-4 py-2 text-base text-white hover:bg-[#28283e]">
                      <input
                        type="checkbox"
                        checked={visibleCols.includes(f.tag)}
                        onChange={() => setVisibleCols((c) => (c.includes(f.tag) ? c.filter((x) => x !== f.tag) : [...c, f.tag]))}
                      />
                      {f.label}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {selected.size > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-[#1f1f33] px-5 py-4">
            <span className="text-lg font-semibold text-white">{t('subs.n_selected', { n: selected.size }, `${selected.size} selected`)}</span>
            <button className="btn-secondary h-10 text-base" disabled={bulkBusy} onClick={() => setSelected(new Set())}>{t('subs.clear', null, 'Clear')}</button>
            <span className="mx-1 h-6 w-px bg-[#3f3f55]" />
            <button className="btn-secondary h-10 text-base" disabled={bulkBusy} onClick={bulkDelete}>
              <MaterialIcon name="delete_outline" className="text-[20px]" /> {t('common.delete', null, 'Delete')}
            </button>
            <select
              className="input h-10 max-w-[170px] text-base"
              defaultValue=""
              disabled={bulkBusy}
              onChange={(e) => { bulkStatus(e.target.value); e.target.value = ''; }}
            >
              <option value="">{t('subs.set_status', null, 'Set status…')}</option>
              <option value="subscribed">{t('subs.st_subscribed', null, 'Subscribed')}</option>
              <option value="unsubscribed">{t('subs.st_unsubscribed', null, 'Unsubscribed')}</option>
              <option value="unconfirmed">{t('subs.st_unconfirmed', null, 'Unconfirmed')}</option>
              <option value="blacklisted">{t('subs.st_blacklisted', null, 'Blacklisted')}</option>
            </select>
            <select
              className="input h-10 max-w-[200px] text-base"
              defaultValue=""
              disabled={bulkBusy}
              onChange={(e) => { bulkMoveOrCopy(e.target.value, 'move'); e.target.value = ''; }}
            >
              <option value="">{t('subs.move_to_list', null, 'Move to list…')}</option>
              {lists.filter((l) => l.uid !== list?.uid).map((l) => <option key={l.uid} value={l.uid}>{l.name}</option>)}
            </select>
            <select
              className="input h-10 max-w-[200px] text-base"
              defaultValue=""
              disabled={bulkBusy}
              onChange={(e) => { bulkMoveOrCopy(e.target.value, 'copy'); e.target.value = ''; }}
            >
              <option value="">{t('subs.copy_to_list', null, 'Copy to list…')}</option>
              {lists.map((l) => <option key={l.uid} value={l.uid}>{l.name}</option>)}
            </select>
            <button className="btn-secondary h-10 text-base" disabled={bulkBusy} onClick={() => bulkTag('add')}>
              <MaterialIcon name="sell" className="text-[20px]" /> {t('subs.add_tag', null, 'Add tag')}
            </button>
            <button className="btn-secondary h-10 text-base" disabled={bulkBusy} onClick={() => bulkTag('remove')}>
              <MaterialIcon name="label_off" className="text-[20px]" /> {t('subs.remove_tag', null, 'Remove tag')}
            </button>
            <button className="btn-secondary h-10 text-base" disabled={bulkBusy} onClick={bulkBlacklist}>
              <MaterialIcon name="block" className="text-[20px]" /> {t('subs.blacklist', null, 'Blacklist')}
            </button>
            {bulkBusy && <Spinner size="sm" />}
          </div>
        )}

        {loading ? (
          <div className="flex h-64 items-center justify-center"><Spinner size="lg" /></div>
        ) : subscribers.length === 0 ? (
          <div className="flex h-[326px] items-center justify-center rounded-xl bg-[#29293f] text-xl font-normal text-[#b8b7c2]">
            {t('subs.empty', null, 'There are no subscribers yet')}
          </div>
        ) : (
          <div className="overflow-visible">
            <div className="min-w-[1120px]">
              <label className="mb-2 flex items-center gap-3 border-b border-[#28283d] pb-3 text-lg text-[#b9b9c4]">
                <input
                  type="checkbox"
                  className="h-6 w-6 rounded border border-[#666679] bg-transparent"
                  checked={allOnPageSelected}
                  onChange={toggleAll}
                />
                {t('subs.select_all', null, 'Select all')}
              </label>
              {sortedSubscribers.map((subscriber) => (
                <SubscriberRow
                  key={subscriber.uid || subscriber.email}
                  subscriber={subscriber}
                  columns={fields.filter((f) => visibleCols.includes(f.tag))}
                  selected={selected.has(subscriber.uid)}
                  onToggle={toggleOne}
                  onEdit={(item) => {
                    setEditingSubscriber(item);
                    setShowSubscriberModal(true);
                  }}
                  onDelete={deleteSubscriber}
                  onSetStatus={setSubscriberStatus}
                  onCopyMove={(sub, mode) => setCopyMove({ mode, subscriber: sub })}
                  onSendConfirmation={sendConfirmation}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {timelineSub && <TimelineDrawer subscriber={timelineSub} onClose={() => setTimelineSub(null)} />}
      {copyMove && (
        <CopyMoveDialog
          mode={copyMove.mode}
          count={1}
          lists={lists}
          currentListUid={list?.uid}
          onSubmit={submitCopyMove}
          onClose={() => setCopyMove(null)}
        />
      )}
      {confirmAction && (
        <ConfirmDialog
          message={confirmAction.message}
          onConfirm={confirmAction.run}
          onClose={() => setConfirmAction(null)}
        />
      )}
      {showWebhook && <WebhookModal onClose={() => setShowWebhook(false)} listUid={list?.uid} />}
      <NewSubscriberModal
        open={showSubscriberModal}
        subscriber={editingSubscriber}
        listUid={list?.uid}
        onError={setMessage}
        onClose={() => {
          setShowSubscriberModal(false);
          setEditingSubscriber(null);
        }}
        onSaved={fetchSubscribers}
      />
    </AppLayout>
  );
};

export default SubscribersPage;
