import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import AppLayout from '../../components/layout/AppLayout';
import { Spinner } from '../../components/ui';
import { listsApi } from '../../api/services';
import { useTranslation } from '../../i18n';
import ListDetailTabs from './ListDetailTabs';
import WebhookModal from './WebhookModal';

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const formatNumber = (value) => {
  const number = toNumber(value);
  return number === null ? '-' : number.toLocaleString();
};

const formatPercent = (value) => {
  const number = toNumber(value);
  return number === null ? '-' : `${number.toFixed(2)}%`;
};

const ProgressMetric = ({ label, value }) => {
  const number = toNumber(value);
  const width = number === null ? 0 : Math.max(0, Math.min(100, number));

  return (
    <div>
      <div className="mb-3 flex items-end justify-between gap-4">
        <span className="text-xl font-medium text-[rgba(197,192,142,0.22)]">{label}</span>
        <span className="text-2xl font-medium text-white">{formatPercent(number)}</span>
      </div>
      <div className="h-5 rounded-full bg-[#565665]">
        <div className="h-full rounded-full bg-[#5db7b5]" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
};

const StatCard = ({ value, label }) => (
  <div className="rounded-md bg-[#303046] px-6 py-7 text-center">
    <p className="text-[30px] font-medium text-[rgba(197,192,142,0.22)]">{value}</p>
    <p className="mt-2 text-lg font-medium text-[#bebeca]">{label}</p>
  </div>
);

const EmptyChart = ({ text }) => (
  <div className="flex h-full min-h-[340px] items-center justify-center text-center text-lg font-medium text-[#8f90a0]">
    {text}
  </div>
);

const GrowthChart = ({ data }) => {
  const { t } = useTranslation();
  return (
  <div className="sq-panel min-h-[430px] p-8">
    <h3 className="text-center text-[26px] font-medium text-white">{t('common.subscribers')}</h3>
    <p className="mb-8 text-center text-lg font-medium text-[#777889]">{t('ld.growth_chart')}</p>
    {data.length === 0 ? (
      <EmptyChart text={t('ld.no_growth_data')} />
    ) : (
      <ResponsiveContainer width="100%" height={310}>
        <BarChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
          <XAxis dataKey="label" stroke="#d8d8e4" tickLine={false} />
          <YAxis stroke="#d8d8e4" tickLine={false} allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="subscribers" fill="#5db7b5" barSize={78} />
        </BarChart>
      </ResponsiveContainer>
    )}
  </div>
  );
};

const SubscriberPie = ({ total }) => {
  const { t } = useTranslation();
  const hasTotal = Number.isFinite(total) && total > 0;
  const data = hasTotal ? [{ name: t('ld.subscribed'), value: total, color: '#5db7b5' }] : [];

  return (
    <div className="sq-panel min-h-[430px] p-8">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="flex-1 text-center text-[26px] font-medium text-white">{t('common.subscribers')}</h3>
        <span className="flex items-center gap-2 text-base font-medium text-white">
          {t('ld.subscribed')}
          <span className="h-5 w-8 rounded border-2 border-[#e1e1e8] bg-[#5db7b5]" />
        </span>
      </div>

      {hasTotal ? (
        <div className="relative h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" outerRadius={150} stroke="#d8d8e4" strokeWidth={2}>
                <Cell fill="#5db7b5" />
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center text-base font-medium text-white">
            {t('ld.subscribed')}<br />100% ({formatNumber(total)})
          </div>
        </div>
      ) : (
        <EmptyChart text={t('ld.no_chart_data')} />
      )}
    </div>
  );
};

const ListDetailOverviewPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [showWebhook, setShowWebhook] = useState(false);
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState(null);

  useEffect(() => {
    listsApi.list({ page: 1, per_page: 1 })
      .then(async ({ data }) => {
        const first = data.data?.[0];
        if (!first?.uid) { setLoading(false); return; }
        const detail = await listsApi.get(first.uid);
        setList(detail.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const subscriberTotal = toNumber(list?.subscriber_count);

  const growthData = useMemo(() => {
    if (!Array.isArray(list?.growth_data)) return [];
    return list.growth_data.map((item) => ({
      label: item.label || '-',
      subscribers: toNumber(item.subscribers) ?? 0,
    }));
  }, [list]);

  return (
    <AppLayout>
      <div className="sq-page px-8 py-8 lg:px-14">
        {loading ? (
          <div className="flex h-[60vh] items-center justify-center"><Spinner size="lg" /></div>
        ) : (
          <div className="max-w-[1500px]">
            <div className="mb-8 flex flex-col gap-8">
              <p className="text-lg font-medium">{t('common.home')} &gt; {t('nav.lists')}</p>
              <div className="flex justify-end gap-3 pr-2 lg:pr-10">
                <button className="btn-primary text-lg font-medium" onClick={() => setShowWebhook(true)}>{t('subs.webhook')}</button>
                <button className="btn-secondary text-lg font-medium" onClick={() => navigate('/lists/all')}>{t('subs.change_list')} &gt;&gt;</button>
              </div>
            </div>

            <h1 className="mb-8 text-[40px] font-medium text-[rgba(197,192,142,0.22)]">
              {list?.name || t('ld.list')}
            </h1>

            <p className="mb-10 text-xl font-medium">
              <span className="mr-2 rounded-full bg-[#00bcd4] px-3 py-2 text-white">
                {formatNumber(subscriberTotal)}
              </span>
              {t('common.subscribers')}
            </p>

            <ListDetailTabs activeLabel="Overview" />

            <section className="mb-12">
              <h2 className="mb-8 text-[36px] font-medium text-white">{t('ld.list_performance')}</h2>

              <div className="mb-14 grid gap-10 lg:grid-cols-2">
                <ProgressMetric label={t('ld.average_open_rate')} value={list?.average_open_rate} />
                <ProgressMetric label={t('ld.average_click_rate')} value={list?.average_click_rate} />
              </div>

              <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-4">
                <StatCard value={formatNumber(list?.subscriber_count)} label={t('ld.total_subscribers')} />
                <StatCard value={formatPercent(list?.avg_unsubscribe_rate)} label={t('ld.avg_unsubscribe_rate')} />
                <StatCard value={formatNumber(list?.total_unsubscribers)} label={t('ld.total_unsubscribers')} />
                <StatCard value={formatNumber(list?.total_unconfirmed)} label={t('ld.total_unconfirmed')} />
              </div>
            </section>

            <section>
              <h2 className="mb-5 text-[32px] font-medium text-white">{t('ld.list_growth')}</h2>
              <div className="grid gap-10 xl:grid-cols-2">
                <GrowthChart data={growthData} />
                <SubscriberPie total={toNumber(subscriberTotal)} />
              </div>
            </section>

            <footer className="mt-12 pb-5 text-lg font-medium text-[#b9b9c4]">
              {t('common.copyright')}
            </footer>
          </div>
        )}
      </div>
      {showWebhook && <WebhookModal onClose={() => setShowWebhook(false)} listUid={list?.uid} />}
    </AppLayout>
  );
};

export default ListDetailOverviewPage;
