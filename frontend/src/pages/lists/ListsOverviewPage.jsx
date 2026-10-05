import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { Spinner, toast } from '../../components/ui';
import { analyticsApi, dashboardApi, listsApi, subscribersApi } from '../../api/services';
import { CartesianGrid, Line, LineChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTranslation } from '../../i18n';

const StatTile = ({ value, children }) => (
  <div className="flex min-h-[148px] items-center justify-center rounded-lg bg-[#343449] px-6 text-center">
    <div>
      <p className="mb-3 text-[34px] font-medium text-[rgba(197,192,142,0.18)]">{value}</p>
      <p className="text-xl font-bold leading-7 text-[#bab9c5]">{children}</p>
    </div>
  </div>
);

const EmptyChart = ({ label }) => {
  return (
    <div className="sq-panel relative h-[300px] px-8 py-6">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={[]}>
          <CartesianGrid stroke="#858592" strokeDasharray="4 4" vertical={false} />
          <XAxis hide />
          <YAxis hide />
        </LineChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-lg font-semibold text-[#777887]">
        {label}
      </div>
    </div>
  );
};

const GrowthChart = ({ data, subscribedLabel, unsubscribedLabel }) => (
  <div className="sq-panel h-[300px] px-4 py-6">
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 20, bottom: 8, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,140,0.18)" />
        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="subscribed" name={subscribedLabel} stroke="#00698f" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="unsubscribed" name={unsubscribedLabel} stroke="#e0414b" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  </div>
);

const ActionArtwork = () => (
  <div className="relative h-[99px] w-[226px] overflow-hidden rounded-sm bg-[#dceacf]">
    <div className="absolute left-8 top-5 h-16 w-12 rounded-full bg-[#f4f1e8]" />
    <div className="absolute left-4 top-9 h-12 w-10 rounded bg-[#ee7d4f]" />
    <div className="absolute right-8 top-3 h-[78px] w-[92px] rounded bg-white shadow-sm">
      <div className="m-3 h-2 w-11 rounded bg-[#c8c8c8]" />
      <div className="mx-3 mt-2 h-2 w-14 rounded bg-[#d7d7d7]" />
      <div className="mx-3 mt-4 h-4 w-16 rounded border border-[#d0d0d0]" />
      <div className="mx-3 mt-3 h-2 w-9 rounded bg-[#777]" />
    </div>
  </div>
);

const ImportArtwork = () => (
  <div className="relative h-[99px] w-[226px] overflow-hidden rounded-sm bg-[#f4c3b1]">
    <div className="absolute left-9 top-6 h-14 w-32 rounded bg-white/80" />
    <div className="absolute left-14 top-4 h-4 w-4 rounded-full bg-[#f15464]" />
    <div className="absolute left-28 top-9 h-4 w-4 rounded-full bg-[#2aa7d8]" />
    <div className="absolute right-8 top-2 h-4 w-4 rounded-full bg-[#2aa7d8]" />
    <div className="absolute left-16 top-10 h-2 w-20 rounded bg-[#c8c8c8]" />
    <div className="absolute left-16 top-16 h-2 w-28 rounded bg-[#d5d5d5]" />
  </div>
);

const QuickAction = ({ tone = 'neutral', title, description, button, artwork }) => (
  <div className="grid grid-cols-[226px_1fr_auto] items-center gap-7 border-t border-[#303044] py-5">
    {artwork}
    <div>
      <h3 className="mb-2 text-2xl font-bold text-white">{title}</h3>
      <p className="max-w-[480px] text-xl font-bold italic leading-7 text-[#b9b8c3]">{description}</p>
    </div>
    <button className={tone === 'danger' ? 'btn-danger min-w-[170px] text-lg' : 'btn-primary min-w-[170px] text-lg'} onClick={button.onClick}>
      {button.label}
    </button>
  </div>
);

const DisabledQuickAction = ({ title, description, button, artwork, onClick }) => (
  <div className="grid grid-cols-[226px_1fr_auto] items-center gap-7 border-t border-[#303044] py-5">
    {artwork}
    <div>
      <h3 className="mb-2 text-2xl font-bold text-white">{title}</h3>
      <p className="max-w-[480px] text-xl font-bold italic leading-7 text-[#b9b8c3]">{description}</p>
    </div>
    <button className="btn-danger min-w-[170px] text-lg" type="button" onClick={onClick}>
      {button}
    </button>
  </div>
);

const ImportContactsModal = ({ open, onClose, lists, t }) => {
  const navigate = useNavigate();
  const [selectedList, setSelectedList] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const onPickFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !selectedList) return;
    setBusy(true);
    try {
      const { data } = await listsApi.importSubscribers(selectedList, { csv: await file.text() });
      toast.success(data.message || t('lov.contacts_imported'));
      onClose();
      navigate(`/lists/contacts?imported=${Date.now()}`);
    } catch (err) {
      toast.error(err.response?.data?.message || t('lov.import_failed'));
    } finally { setBusy(false); }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/55 pt-24">
      <div className="w-[772px] rounded-lg bg-[#19192f] shadow-2xl">
        <div className="flex h-14 items-center justify-end border-b border-[#444456] px-5">
          <button className="text-4xl leading-none text-[#9c9ca9]" onClick={onClose} title={t('common.cancel')}>×</button>
        </div>
        <div className="px-14 py-12">
          <h2 className="mb-8 text-[26px] font-bold text-[rgba(197,192,142,0.22)]">{t('lov.import_contacts')}</h2>
          <label className="mb-3 block text-xl font-bold text-[#d8d8e4]">
            {t('lov.import_select_label')}
          </label>
          <select
            className="input h-11 text-lg"
            value={selectedList}
            onChange={(e) => setSelectedList(e.target.value)}
          >
            <option value="">--</option>
            {lists.map((list) => (
              <option key={list.uid} value={list.uid}>{list.name}</option>
            ))}
          </select>
          <p className="mt-3 text-sm text-[#9c9ca9]">{t('lov.import_help')}</p>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onPickFile} />
          <button
            className="btn-primary mt-8 min-w-[56px] text-lg"
            type="button"
            disabled={!selectedList || busy}
            onClick={() => fileRef.current?.click()}
          >
            {busy ? t('lov.importing') : t('lov.go')}
          </button>
        </div>
      </div>
    </div>
  );
};

const ListsOverviewPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [dashboard, setDashboard] = useState(null);
  const [subscriberTotal, setSubscriberTotal] = useState(null);
  const [audience, setAudience] = useState(null);
  const [lists, setLists] = useState([]);
  const [showImport, setShowImport] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      dashboardApi.get(),
      subscribersApi.list({ page: 1, per_page: 1 }),
      listsApi.list({ page: 1, per_page: 100 }),
      analyticsApi.audience(),
    ]).then(([dashboardResult, subscribersResult, listsResult, audienceResult]) => {
      if (dashboardResult.status === 'fulfilled') {
        setDashboard(dashboardResult.value.data);
      }
      if (subscribersResult.status === 'fulfilled') {
        setSubscriberTotal(subscribersResult.value.data?.pagination?.total ?? 0);
      }
      if (listsResult.status === 'fulfilled') {
        setLists(listsResult.value.data?.data || []);
      }
      if (audienceResult.status === 'fulfilled') {
        setAudience(audienceResult.value.data);
      }
    }).finally(() => setLoading(false));
  }, []);

  const listCount = dashboard?.stats?.total_lists ?? null;
  return (
    <AppLayout>
      <div className="sq-page px-14 py-16">
        {loading ? (
          <div className="flex h-[60vh] items-center justify-center"><Spinner size="lg" /></div>
        ) : (
          <div className="max-w-[1500px]">
            <section className="mb-12">
              <h1 className="mb-5 text-[34px] font-medium text-[rgba(197,192,142,0.22)]">{t('lov.manage_audience')}</h1>
              <p className="text-xl font-semibold leading-7">
                {t('lov.intro1')}<br />
                {t('lov.intro2')}
              </p>
            </section>

            <section className="mb-16 grid gap-12 xl:grid-cols-4">
              <StatTile value={audience?.subscribers_total ?? subscriberTotal ?? '-'}>
                {t('lov.tile_total_l1')}<br />
                {t('lov.tile_total_l2', { count: listCount ?? '-' })}
              </StatTile>
              <StatTile value={audience ? `${audience.active_percent}%` : '-'}>
                {t('lov.tile_active_l1')}<br />
                {t('lov.tile_active_l2')}
              </StatTile>
              <StatTile value={audience?.forms_total ?? '-'}>
                {t('lov.tile_form_l1')}<br />
                {t('lov.tile_form_l2')}
              </StatTile>
              <StatTile value={audience?.blacklisted_total ?? '-'}>
                {t('lov.tile_black_l1')}<br />
                {t('lov.tile_black_l2')}
              </StatTile>
            </section>

            <section className="mb-16">
              <h2 className="sq-section-title mb-5 flex items-center gap-3">
                <span>⌁</span> {t('lov.growth_title')}
              </h2>
              <p className="mb-8 text-xl font-semibold">{t('lov.growth_sub')}</p>
              {audience?.growth?.some((g) => g.subscribed || g.unsubscribed) ? (
                <GrowthChart
                  data={audience.growth}
                  subscribedLabel={t('lov.tile_active_l1', null, 'Subscribed')}
                  unsubscribedLabel={t('lov.tile_black_l1', null, 'Unsubscribed')}
                />
              ) : (
                <EmptyChart label={t('lov.no_growth_data')} />
              )}
            </section>

            <section className="mb-16">
              <h2 className="sq-section-title mb-4 flex items-center gap-3">
                <span className="flex h-[51px] w-[51px] items-center justify-center bg-[#0b5fd3] text-white">□</span>
                {t('lov.quick_action')}
              </h2>
              <p className="mb-8 text-xl font-semibold">{t('lov.quick_action_sub')}</p>
              <QuickAction
                title={t('lov.create_form_title')}
                description={t('lov.capture_desc')}
                button={{ label: t('lov.create_form_btn'), onClick: () => navigate('/lists/forms') }}
                artwork={<ActionArtwork />}
              />
              <DisabledQuickAction
                title={t('lov.import_contacts')}
                description={t('lov.capture_desc')}
                button={t('lov.import_contacts')}
                artwork={<ImportArtwork />}
                onClick={() => setShowImport(true)}
              />
            </section>

            <footer className="pb-5 text-lg font-semibold text-[#b9b9c4]">
              {t('common.copyright')}
            </footer>
          </div>
        )}
      </div>
      <ImportContactsModal open={showImport} onClose={() => setShowImport(false)} lists={lists} t={t} />
    </AppLayout>
  );
};

export default ListsOverviewPage;
