import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import ListDetailTabs from './ListDetailTabs';
import WebhookModal from './WebhookModal';
import { listsApi } from '../../api/services';
import { toast } from '../../components/ui';
import { useTranslation } from '../../i18n';

const MaterialIcon = ({ name, className = '' }) => (
  <span className={`material-symbols-rounded ${className}`}>{name}</span>
);

const OPERATORS = [
  { value: 'is', label: 'is' },
  { value: 'is_not', label: 'is not' },
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: "doesn't contain" },
  { value: 'starts_with', label: 'starts with' },
  { value: 'ends_with', label: 'ends with' },
  { value: 'greater', label: 'greater than' },
  { value: 'less', label: 'less than' },
  { value: 'is_empty', label: 'is empty' },
  { value: 'is_not_empty', label: 'is not empty' },
];
const VALUELESS = ['is_empty', 'is_not_empty'];

const SegmentModal = ({ open, onClose, listUid, segment, onSaved, onMessage }) => {
  const { t } = useTranslation();
  const editing = Boolean(segment);
  const [name, setName] = useState('');
  const [matching, setMatching] = useState('all');
  const [conditions, setConditions] = useState([]);
  const [fields, setFields] = useState([]);
  const [saving, setSaving] = useState(false);
  const [matchCount, setMatchCount] = useState(null);

  useEffect(() => {
    if (!open) return;
    setName(segment?.name || '');
    setMatching(segment?.matching || 'all');
    setConditions(Array.isArray(segment?.conditions) && segment.conditions.length
      ? segment.conditions
      : [{ field: 'email', operator: 'contains', value: '' }]);
    if (listUid) {
      listsApi.fields(listUid)
        .then(({ data }) => {
          const def = (data.default_fields || []).map((f) => ({ value: f.key, label: f.label }));
          const custom = (data.fields || []).map((f) => ({ value: f.tag || f.uid, label: f.label }));
          setFields([...def, { value: 'status', label: t('common.status') }, ...custom]);
        })
        .catch(() => setFields([
          { value: 'email', label: t('subs.email') }, { value: 'first_name', label: t('auth.first_name') },
          { value: 'last_name', label: t('auth.last_name') }, { value: 'status', label: t('common.status') },
        ]));
    }
  }, [open, segment, listUid]);

  // Live "how many subscribers match" preview (debounced) as conditions change.
  useEffect(() => {
    if (!open || !listUid) return undefined;
    const valid = conditions.filter((c) => c.field && c.operator);
    const t = setTimeout(() => {
      listsApi.previewSegmentCount(listUid, { matching, conditions: valid })
        .then(({ data }) => setMatchCount(data.count))
        .catch(() => setMatchCount(null));
    }, 350);
    return () => clearTimeout(t);
  }, [open, listUid, matching, conditions]);

  if (!open) return null;

  const setCond = (i, patch) => setConditions((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const addCond = () => setConditions((prev) => [...prev, { field: fields[0]?.value || 'email', operator: 'contains', value: '' }]);
  const removeCond = (i) => setConditions((prev) => prev.filter((_, idx) => idx !== i));

  const save = async (event) => {
    event.preventDefault();
    if (!listUid) { onMessage(t('seg.need_list')); return; }
    setSaving(true);
    try {
      const payload = {
        name,
        matching,
        conditions: conditions.filter((c) => c.field && c.operator),
      };
      if (editing) await listsApi.updateSegment(listUid, segment.uid, payload);
      else await listsApi.createSegment(listUid, payload);
      onMessage(editing ? t('seg.updated') : t('seg.created'));
      onSaved();
      onClose();
    } catch (error) {
      onMessage(error.response?.data?.message || t('seg.save_failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/55 px-4">
      <div className="w-full max-w-2xl rounded-md bg-[#1d1d33] shadow-2xl sendq-segment-modal">
        <div className="flex items-center justify-between border-b border-[#4b4a5e] px-8 py-5">
          <h2 className="sq-section-title text-[28px]">{editing ? t('seg.edit') : t('seg.create')}</h2>
          <button onClick={onClose} className="text-3xl text-[#a7a8b5]" title={t('common.cancel')} type="button">×</button>
        </div>
        <form className="space-y-5 px-8 py-7" onSubmit={save}>
          <label className="block">
            <span className="mb-2 block text-lg font-normal text-white">{t('seg.name')}</span>
            <input className="input h-11 text-lg" value={name} onChange={(e) => setName(e.target.value)} />
          </label>

          <div className="flex items-center gap-3 text-lg text-white">
            <span>{t('seg.match')}</span>
            <select className="input h-11 w-[120px] text-lg" value={matching} onChange={(e) => setMatching(e.target.value)}>
              <option value="all">{t('seg.all')}</option>
              <option value="any">{t('seg.any')}</option>
            </select>
            <span>{t('seg.of_following')}</span>
          </div>

          <div className="space-y-3">
            {conditions.map((cond, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <select className="input h-11 flex-1 min-w-[140px] text-base" value={cond.field} onChange={(e) => setCond(i, { field: e.target.value })}>
                  {fields.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
                <select className="input h-11 w-[160px] text-base" value={cond.operator} onChange={(e) => setCond(i, { operator: e.target.value })}>
                  {OPERATORS.map((o) => <option key={o.value} value={o.value}>{t(`seg.op_${o.value}`)}</option>)}
                </select>
                {!VALUELESS.includes(cond.operator) && (
                  <input className="input h-11 flex-1 min-w-[120px] text-base" placeholder={t('seg.value_ph')}
                    value={cond.value || ''} onChange={(e) => setCond(i, { value: e.target.value })} />
                )}
                <button type="button" className="btn-secondary h-11 w-11 px-0" title={t('common.delete')} onClick={() => removeCond(i)}>
                  <MaterialIcon name="close" />
                </button>
              </div>
            ))}
            <button type="button" className="btn-secondary h-11" onClick={addCond}>
              <MaterialIcon name="add" /> {t('seg.add_condition')}
            </button>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-[#343448] pt-5">
            <span className="text-lg text-[#00aeca]">
              {matchCount == null ? '' : t('seg.match_count', { count: matchCount.toLocaleString() })}
            </span>
            <div className="flex gap-3">
            <button type="button" onClick={onClose} className="btn-secondary h-11 px-5 text-lg">{t('common.cancel')}</button>
            <button type="submit" className="btn-primary h-11 px-5 text-lg" disabled={!name || saving}>
              {saving ? t('subs.saving') : (editing ? t('common.save') : t('common.create'))}
            </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

const SegmentsPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [keyword, setKeyword] = useState('');
  const [sort, setSort] = useState('created_at');
  const [dir, setDir] = useState('desc');
  const [isModalOpen, setIsModalOpen] = useState(searchParams.get('action') === 'create-segment');
  const [editSegment, setEditSegment] = useState(null);
  const [showWebhook, setShowWebhook] = useState(false);
  const [segments, setSegments] = useState([]);
  const [list, setList] = useState(null);
  const [message, setMessage] = useState('');
  const [counts, setCounts] = useState({});

  // Per-segment subscriber counts (PHP shows a SubscriberCount column).
  useEffect(() => {
    if (!list?.uid || !segments.length) { setCounts({}); return undefined; }
    let mounted = true;
    Promise.all(segments.map((s) => listsApi.segmentCount(list.uid, s.uid)
      .then(({ data }) => [s.uid, data.count ?? data.total ?? 0])
      .catch(() => [s.uid, null])))
      .then((pairs) => { if (mounted) setCounts(Object.fromEntries(pairs)); });
    return () => { mounted = false; };
  }, [list?.uid, segments]);

  const loadSegments = async (selectedList = list) => {
    if (!selectedList?.uid) {
      setSegments([]);
      return;
    }
    const segmentResponse = await listsApi.segments(selectedList.uid);
    setSegments(segmentResponse.data.data || []);
  };

  useEffect(() => {
    if (searchParams.get('action') === 'create-segment') setIsModalOpen(true);
  }, [searchParams]);

  useEffect(() => {
    let mounted = true;
    listsApi.list({ page: 1, per_page: 1 })
      .then(async ({ data }) => {
        const firstList = data.data?.[0] || null;
        if (!mounted) return;
        setList(firstList);
        if (firstList?.uid) {
          const segmentResponse = await listsApi.segments(firstList.uid);
          if (mounted) setSegments(segmentResponse.data.data || []);
        }
      })
      .catch(() => {
        if (mounted) {
          setList(null);
          setSegments([]);
        }
      });
    return () => { mounted = false; };
  }, []);

  const deleteSegment = async (segment) => {
    if (!list?.uid || !segment.uid || !window.confirm(t('lists.confirm_delete', { name: segment.name }))) return;
    await listsApi.deleteSegment(list.uid, segment.uid);
    loadSegments();
  };

  const copySegment = async (segment) => {
    if (!list?.uid || !segment.uid) return;
    try {
      await listsApi.copySegment(list.uid, segment.uid);
      toast.success(t('seg.copied', null, 'Segment duplicated.'));
      loadSegments();
    } catch (err) {
      toast.error(err.response?.data?.message || t('seg.copy_failed', null, 'Could not duplicate the segment.'));
    }
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

          <h1 className="mb-8 text-[40px] font-normal text-[rgba(197,192,142,0.22)]">{t('seg.title')}</h1>

          <p className="mb-10 text-xl font-normal">
            <span className="mr-2 rounded-full bg-[#00bcd4] px-3 py-2 text-white">-</span>
            {t('common.subscribers')}
          </p>

          <ListDetailTabs activeLabel="Segments" />
          {message && <p className="mb-5 text-lg font-normal text-[#bfc0ca]">{message}</p>}

          <div className="mb-10 flex items-center gap-3">
            <MaterialIcon name="splitscreen" className="text-[42px]" />
            <h2 className="text-[38px] font-normal text-white">{t('seg.title')}</h2>
          </div>

          <div className="mb-5 flex flex-col gap-4 border-b border-[#2d2d43] pb-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <label className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-[#66667a]">
                <input className="sr-only" type="checkbox" />
              </label>
              <span className="text-lg font-normal text-[#c3c3cf]">{t('common.sort_by')}</span>
              <select className="input h-11 w-[136px] text-lg" value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="created_at">{t('common.created_at')}</option>
                <option value="name">{t('common.name')}</option>
                <option value="updated_at">{t('common.updated_at')}</option>
              </select>
              <button className="btn-secondary h-11 w-11 px-0" title={t('common.sort_direction')} type="button" onClick={() => setDir((d) => (d === 'desc' ? 'asc' : 'desc'))}>
                <MaterialIcon name="sort" className="text-[22px]" />
              </button>
              <div className="relative w-full sm:w-[250px]">
                <input
                  className="input h-11 pr-10 text-lg"
                  placeholder={t('common.type_to_search')}
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                />
                <MaterialIcon name="search" className="absolute right-3 top-2.5 text-[22px] text-[#b8b8c3]" />
              </div>
            </div>
            <button onClick={() => setIsModalOpen(true)} className="btn-primary h-11 px-5 text-lg font-normal" type="button">
              <MaterialIcon name="add" className="text-[22px]" /> {t('seg.create')}
            </button>
          </div>

          {segments.length === 0 ? (
            <section className="sq-panel flex min-h-[326px] flex-col items-center justify-center text-center text-[#bfc0ca]">
              <MaterialIcon name="splitscreen" className="mb-8 text-[84px] text-[#777889]" />
              <p className="text-xl font-normal">{t('seg.you_have_none')}</p>
            </section>
          ) : (
            <section className="overflow-hidden rounded-xl border border-[#303044]">
              {segments
                .filter((segment) => !keyword || segment.name?.toLowerCase().includes(keyword.toLowerCase()))
                .slice()
                .sort((a, b) => {
                  const av = String((sort === 'name' ? a.name : a[sort]) || a.created_at || '');
                  const bv = String((sort === 'name' ? b.name : b[sort]) || b.created_at || '');
                  const cmp = av.localeCompare(bv);
                  return dir === 'desc' ? -cmp : cmp;
                })
                .map((segment) => (
                  <div key={segment.uid} className="grid grid-cols-[1fr_140px_160px_200px] items-center gap-6 border-b border-[#303044] px-5 py-5 last:border-0">
                    <div>
                      <button type="button" className="text-xl font-normal text-[#00aeca] hover:underline" onClick={() => setEditSegment(segment)}>{segment.name}</button>
                      <p className="text-lg text-[#a9a8b3]">
                        {t('seg.match_line', {
                          matching: segment.matching || 'all',
                          count: (Array.isArray(segment.conditions) ? segment.conditions.length : 0),
                        })}
                      </p>
                    </div>
                    <div className="text-lg text-[#bfc0ca]">
                      <strong className="text-white">{counts[segment.uid] ?? '—'}</strong>
                      <span className="block text-sm text-[#8f8fa0]">{t('common.subscribers')}</span>
                    </div>
                    <p className="text-lg text-[#bfc0ca]">{new Date(segment.created_at).toISOString().slice(0, 10)}</p>
                    <div className="flex justify-end gap-2">
                      <button className="btn-primary h-11" type="button" onClick={() => setEditSegment(segment)}>{t('common.edit')}</button>
                      <button className="btn-secondary h-11" type="button" onClick={() => copySegment(segment)}>{t('seg.copy', null, 'Copy')}</button>
                      <button className="btn-secondary h-11" type="button" onClick={() => deleteSegment(segment)}>{t('common.delete')}</button>
                    </div>
                  </div>
                ))}
            </section>
          )}
        </main>

        <footer className="pt-10 text-lg font-normal text-[#b8b8c2]">
          {t('common.copyright')}
        </footer>
      </div>

      <SegmentModal
        open={isModalOpen || Boolean(editSegment)}
        segment={editSegment}
        onClose={() => { setIsModalOpen(false); setEditSegment(null); }}
        listUid={list?.uid}
        onSaved={() => loadSegments()}
        onMessage={setMessage}
      />
      {showWebhook && <WebhookModal onClose={() => setShowWebhook(false)} listUid={list?.uid} />}
    </AppLayout>
  );
};

export default SegmentsPage;
