import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import AppLayout from '../../components/layout/AppLayout';
import { Spinner } from '../../components/ui';
import useAuthStore from '../../store/authStore';
import { dashboardApi, analyticsApi } from '../../api/services';
import { useTranslation } from '../../i18n/index.jsx';

const MaterialIcon = ({ children, className = '' }) => (
  <span className={`material-symbols-rounded ${className}`}>{children}</span>
);

const formatNumber = (value) => {
  if (value === null || value === undefined || value === '') return '-';
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString() : value;
};

const formatDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getPercentValue = (quota) => {
  const percent = Number(quota?.percent ?? 0);
  if (!Number.isFinite(percent)) return 0;
  return Math.max(0, Math.min(percent, 100));
};

const numberValue = (...values) => {
  const value = values.find((item) => item !== undefined && item !== null && item !== '');
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const percentText = (value) => `${numberValue(value).toFixed(2)}%`;

const campaignMetric = (campaign, ...keys) => numberValue(...keys.map((key) => campaign?.[key]));

const SectionHeading = ({ icon, children, className = '' }) => (
  <h3 className={`dashboard-heading ${className}`}>
    <MaterialIcon className="dashboard-heading-icon">{icon}</MaterialIcon>
    <span>{children}</span>
  </h3>
);

const EmptyList = ({ icon = 'auto_awesome', children }) => (
  <div className="dashboard-empty-list">
    <MaterialIcon className="dashboard-empty-icon">{icon}</MaterialIcon>
    <span>{children}</span>
  </div>
);

const QuotaLine = ({ label, quota }) => {
  const percent = getPercentValue(quota);

  return (
    <div className="dashboard-quota-item">
      <div className="dashboard-quota-label-row">
        <label>{label}</label>
        <div>
          <span className="dashboard-muted">{quota?.label || '-'}</span>
          <span className="dashboard-quota-percent">{percent.toFixed(2)}%</span>
        </div>
      </div>
      <div className="dashboard-progress">
        <div
          className={percent >= 80 ? 'dashboard-progress-bar dashboard-progress-danger' : 'dashboard-progress-bar'}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};

const DashboardSelect = ({ value, onChange, children }) => (
  <select className="dashboard-select" value={value} onChange={(event) => onChange(event.target.value)}>
    {children}
  </select>
);

const ChartFrame = ({ title, subtitle, children }) => (
  <div className="dashboard-chart-frame">
    {(title || subtitle) && (
      <div className="dashboard-chart-title">
        {title && <h4>{title}</h4>}
        {subtitle && <p>{subtitle}</p>}
      </div>
    )}
    {children}
  </div>
);

const CampaignBarChart = ({ campaign }) => {
  const rows = [
    ['Recipients', campaignMetric(campaign, 'subscriber_count', 'recipients', 'total_recipients')],
    ['Delivered', campaignMetric(campaign, 'delivered_count', 'delivered')],
    ['Failed', campaignMetric(campaign, 'failed_count', 'failed')],
    ['Open', campaignMetric(campaign, 'open_count', 'opens', 'unique_open_count')],
    ['Click', campaignMetric(campaign, 'click_count', 'clicks', 'unique_click_count')],
    ['Bounce', campaignMetric(campaign, 'bounce_count', 'bounces')],
    ['Report', campaignMetric(campaign, 'feedback_count', 'reports')],
    ['Unsubscribe', campaignMetric(campaign, 'unsubscribe_count', 'unsubscribes')],
  ];
  const max = Math.max(...rows.map(([, value]) => value), 1);

  return (
    <div className="dashboard-campaign-bars">
      <div className="dashboard-campaign-plot">
        {rows.map(([label, value], index) => (
          <div className="dashboard-campaign-bar-row" key={label}>
            <span>{label}</span>
            <div>
              <i
                style={{
                  width: `${Math.max((value / max) * 100, value > 0 ? 1 : 0)}%`,
                  background: ['#555555', '#626eb2', '#81ac8d', '#7d5fb2', '#b26e59', '#5cb2b2', '#b25977', '#aab25a'][index],
                }}
              />
            </div>
          </div>
        ))}
        <div className="dashboard-campaign-xaxis">
          {[0, 25, 50, 75, 100].map((tick) => (
            <span key={tick}>{Math.round((max * tick) / 100).toLocaleString()}</span>
          ))}
          <b>Subscribers</b>
        </div>
      </div>
    </div>
  );
};

const CampaignBadgeRows = ({ campaign, onLog }) => {
  const recipients = campaignMetric(campaign, 'subscriber_count', 'recipients', 'total_recipients');
  const delivered = campaignMetric(campaign, 'delivered_count', 'delivered');
  const uniqOpens = campaignMetric(campaign, 'unique_open_count', 'uniq_open_count', 'opens');
  const notOpened = Math.max(recipients - uniqOpens, 0);
  const clicks = campaignMetric(campaign, 'unique_click_count', 'clicks');
  const unsubscribed = campaignMetric(campaign, 'unsubscribe_count', 'unsubscribed');
  const bounced = campaignMetric(campaign, 'bounce_count', 'bounced');
  const reported = campaignMetric(campaign, 'feedback_count', 'reported');

  const rows = [
    { color: 'bg-color0', percent: recipients ? (uniqOpens / Math.max(delivered || recipients, 1)) * 100 : 0, text: `Opened ${formatNumber(uniqOpens)} unique / ${formatNumber(delivered || recipients)} message(s)`, action: () => onLog('opens') },
    { color: 'bg-color1', percent: recipients ? (notOpened / recipients) * 100 : 0, text: `Not opened ${formatNumber(notOpened)} / ${formatNumber(recipients)} subscribers`, action: () => onLog('opens') },
    { color: 'bg-color2', percent: uniqOpens ? (clicks / uniqOpens) * 100 : 0, text: `Unique clicks ${formatNumber(clicks)} / ${formatNumber(uniqOpens)} unique opens`, action: () => onLog('clicks') },
    { color: 'bg-color3', percent: recipients ? (unsubscribed / recipients) * 100 : 0, text: `Unsubscribed ${formatNumber(unsubscribed)} unsubscribed`, action: () => onLog('unsubscribes') },
    { color: 'bg-color4', percent: recipients ? (bounced / recipients) * 100 : 0, text: `Bounced ${formatNumber(bounced)} bounced`, action: () => onLog('bounces') },
    { color: 'bg-color5', percent: recipients ? (reported / recipients) * 100 : 0, text: `Reported ${formatNumber(reported)} reported`, action: () => onLog('feedback') },
  ];

  return (
    <div className="dashboard-badge-list">
      {rows.map((row) => (
        <div className="dashboard-badge-row" key={row.text}>
          <span className={`dashboard-stat-badge ${row.color}`}>{percentText(row.percent)}</span>
          <span>{row.text}</span>
          <span>·</span>
          <button type="button" onClick={row.action}>
            <MaterialIcon>arrow_forward</MaterialIcon>
            View log
          </button>
        </div>
      ))}
    </div>
  );
};

const RateSummary = ({ title, percent, rows, buttonLabel, onButtonClick }) => (
  <div className="dashboard-rate-panel">
    <div className="dashboard-rate-head">
      <h4>{title}</h4>
      <span>{percentText(percent)}</span>
    </div>
    <div className="dashboard-progress">
      <div className="dashboard-progress-bar" style={{ width: `${Math.max(0, Math.min(numberValue(percent), 100))}%` }} />
    </div>
    <div className="dashboard-stat-table">
      {rows.map((row) => (
        <div className="dashboard-stat-row" key={row.label}>
          <p>{row.label}</p>
          <span>{row.value || '-'}</span>
        </div>
      ))}
    </div>
    <div className="dashboard-align-end">
      <button type="button" className="btn-primary" onClick={onButtonClick}>
        {buttonLabel} <MaterialIcon>arrow_forward</MaterialIcon>
      </button>
    </div>
  </div>
);

const PerformanceChart = ({ timeline = [] }) => {
  const { t } = useTranslation();
  const hasData = timeline.some((p) => (p.opens || 0) > 0 || (p.clicks || 0) > 0);
  return (
  <section className="dashboard-section">
    <div className="dashboard-performance-heading">
      <SectionHeading icon="schedule">{t('dash.performance')}</SectionHeading>
      <span className="dashboard-muted">{t('dash.last_24h', null, 'Last 24 hours')}</span>
    </div>
    <p>Below are the details of subscriber activity (opens and clicks) measured for this campaign recently.</p>
    <div className="dashboard-chart-frame" style={{ paddingTop: 12 }}>
      <div className="dashboard-performance-legend">
        <span><i className="opened" />{t('dash.opened')}</span>
        <span><i className="clicked" />{t('dash.clicked')}</span>
      </div>
      {hasData ? (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={timeline} margin={{ top: 10, right: 16, bottom: 4, left: -10 }}>
            <XAxis dataKey="label" stroke="#9aa0b5" tickLine={false} fontSize={11} interval={1} />
            <YAxis stroke="#9aa0b5" tickLine={false} allowDecimals={false} fontSize={11} />
            <Tooltip cursor={{ fill: 'rgba(125,130,160,0.1)' }} />
            <Bar dataKey="opens" name="Opened" fill="#5db7b5" radius={[3, 3, 0, 0]} />
            <Bar dataKey="clicks" name="Clicked" fill="#7d5fb2" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <EmptyList icon="schedule">No activity in the last 24 hours</EmptyList>
      )}
    </div>
  </section>
  );
};

const ActivityLog = ({ logs = [] }) => {
  const { t } = useTranslation();
  return (
  <section className="dashboard-section">
    <SectionHeading icon="history_toggle_off">{t('dash.activity_log')}</SectionHeading>
    {logs.length === 0 ? (
      <EmptyList>{t('dash.no_activity')}</EmptyList>
    ) : (
      <div className="dashboard-action-log-box">
        {logs.slice(0, 20).map((log, index) => (
          <article className="dashboard-action-log-card" key={log.id || index}>
            <div>
              <strong>{log.actor || 'You'}</strong>
              <p>{log.message || '-'}</p>
            </div>
            <span><MaterialIcon>history</MaterialIcon>{formatDateTime(log.time || log.created_at) || '-'}</span>
          </article>
        ))}
      </div>
    )}
  </section>
  );
};

const DashGrowthChart = ({ data }) => {
  const hasData = data.some((d) => (d.subscribers || 0) > 0);
  return (
    <ChartFrame title="Subscribers" subtitle="Growth chart">
      {hasData ? (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} margin={{ top: 10, right: 16, bottom: 4, left: -10 }}>
            <XAxis dataKey="label" stroke="#9aa0b5" tickLine={false} fontSize={11} />
            <YAxis stroke="#9aa0b5" tickLine={false} allowDecimals={false} fontSize={11} />
            <Tooltip cursor={{ fill: 'rgba(125,130,160,0.1)' }} />
            <Bar dataKey="subscribers" name="Subscribers" fill="#5db7b5" radius={[3, 3, 0, 0]} barSize={42} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <EmptyList icon="signal_cellular_alt">No growth data yet</EmptyList>
      )}
    </ChartFrame>
  );
};

const DashSubscriberPie = ({ total }) => {
  const has = Number.isFinite(total) && total > 0;
  return (
    <ChartFrame title="Subscribers">
      {has ? (
        <div style={{ position: 'relative', height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={[{ name: 'Subscribed', value: total }]} dataKey="value" nameKey="name" outerRadius={110} stroke="#d8d8e4" strokeWidth={2}>
                <Cell fill="#5db7b5" />
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="dashboard-pie-legend" style={{ justifyContent: 'center' }}>
            <span><i style={{ background: '#5db7b5' }} />Subscribed 100% ({formatNumber(total)})</span>
          </div>
        </div>
      ) : (
        <EmptyList icon="group">No subscribers yet</EmptyList>
      )}
    </ChartFrame>
  );
};

export const DashboardContent = () => {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedCampaignUid, setSelectedCampaignUid] = useState('');
  const [selectedListUid, setSelectedListUid] = useState('');
  const [breakdown, setBreakdown] = useState(null);
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    dashboardApi.get()
      .then((res) => {
        setData(res.data);
        const campaigns = res.data?.recent_campaigns || [];
        const lists = res.data?.recent_lists || [];
        setSelectedCampaignUid(campaigns[0]?.uid || '');
        setSelectedListUid('');
        if (lists.length > 0) {
          setSelectedListUid('all');
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const campaigns = data?.recent_campaigns || [];
  const lists = data?.recent_lists || [];
  const selectedCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.uid === selectedCampaignUid) || campaigns[0],
    [campaigns, selectedCampaignUid],
  );
  const selectedList = useMemo(
    () => lists.find((list) => list.uid === selectedListUid),
    [lists, selectedListUid],
  );
  const campaignUid = selectedCampaign?.uid;

  // 24h opens/clicks timeline for the selected campaign (reuses the analytics breakdown).
  useEffect(() => {
    if (!campaignUid) { setBreakdown(null); return; }
    let active = true;
    analyticsApi.campaignBreakdown(campaignUid)
      .then(({ data: bd }) => { if (active) setBreakdown(bd); })
      .catch(() => { if (active) setBreakdown(null); });
    return () => { active = false; };
  }, [campaignUid]);

  // Subscriber growth for the list-growth section ("all" aggregates every list).
  const growthData = useMemo(() => {
    const source = selectedListUid === 'all' ? lists : (selectedList ? [selectedList] : []);
    const buckets = {};
    source.forEach((l) => (l.growth_data || []).forEach(({ label, subscribers }) => {
      buckets[label] = (buckets[label] || 0) + (Number(subscribers) || 0);
    }));
    // Keep chronological order from the first list's labels.
    const order = (source[0]?.growth_data || []).map((g) => g.label);
    return order.map((label) => ({ label, subscribers: buckets[label] || 0 }));
  }, [lists, selectedList, selectedListUid]);

  const subscriberTotal = useMemo(() => {
    const source = selectedListUid === 'all' ? lists : (selectedList ? [selectedList] : []);
    return source.reduce((sum, l) => sum + (Number(l.subscriber_count) || 0), 0);
  }, [lists, selectedList, selectedListUid]);

  const recipients = campaignMetric(selectedCampaign, 'subscriber_count', 'recipients', 'total_recipients');
  const delivered = campaignMetric(selectedCampaign, 'delivered_count', 'delivered') || recipients;
  const uniqOpens = campaignMetric(selectedCampaign, 'unique_open_count', 'uniq_open_count', 'opens');
  const clicks = campaignMetric(selectedCampaign, 'unique_click_count', 'clicks');
  const openRate = delivered ? (uniqOpens / delivered) * 100 : 0;
  const clickRate = uniqOpens ? (clicks / uniqOpens) * 100 : 0;
  const goToCampaign = (suffix = '') => {
    if (campaignUid) navigate(`/campaigns/${campaignUid}${suffix}`);
  };

  const displayName = user?.customer
    ? `${user.customer.first_name || ''} ${user.customer.last_name || ''}`.trim()
    : `${user?.first_name || ''} ${user?.last_name || ''}`.trim();

  return (
    <div className="dashboard-page">
      {loading ? (
        <div className="dashboard-loading"><Spinner size="lg" /></div>
      ) : (
        <>
          <section className="dashboard-welcome">
              <h2>Hello, {displayName || '-'}</h2>
              <p>
                Welcome back to your account dashboard.
                <br />
                Check out your email campaigns' performance statistics and personalized tips from our insight reports.
              </p>
            </section>

            <section className="dashboard-section">
              <SectionHeading icon="donut_large">{t('dash.credits_used')}</SectionHeading>
              <p>{t('dash.credits_summary')}</p>
              <div className="dashboard-quota-grid">
                <QuotaLine label="List" quota={data?.quota?.lists} />
                <QuotaLine label="Campaign" quota={data?.quota?.campaigns} />
                <QuotaLine label="Subscriber" quota={data?.quota?.subscribers} />
              </div>
            </section>

            <section className="dashboard-section">
              <SectionHeading icon="history_toggle_off">{t('dash.recently_sent')}</SectionHeading>
              {campaigns.length === 0 ? (
                <EmptyList>{t('dash.no_sent')}</EmptyList>
              ) : (
                <>
                  <div className="dashboard-select-wrap">
                    <DashboardSelect value={selectedCampaignUid} onChange={setSelectedCampaignUid}>
                      {campaigns.map((campaign) => (
                        <option key={campaign.uid} value={campaign.uid}>{campaign.name || '-'}</option>
                      ))}
                    </DashboardSelect>
                  </div>

                  <div className="dashboard-campaign-summary">
                    <div>
                      <h5>
                        Sent to <span className="dashboard-badge">{formatNumber(selectedCampaign?.subscriber_count)}</span> recipient(s)
                      </h5>
                      <p>
                        <span className="dashboard-muted">{t('dash.from')}</span>
                        <span>{selectedCampaign?.from || '-'}</span>
                      </p>
                    </div>
                    <div>
                      <p>
                        <span className="dashboard-muted">{t('dash.subject')}</span>
                        <span>{selectedCampaign?.subject || '-'}</span>
                      </p>
                      <p>
                        <span className="dashboard-muted">{t('dash.scheduled_at')}</span>
                        <span>{formatDateTime(selectedCampaign?.run_at)}</span>
                      </p>
                      <p>
                        <span className="dashboard-muted">{t('dash.delivery_at')}</span>
                        <span>{formatDateTime(selectedCampaign?.delivery_at)}</span>
                      </p>
                    </div>
                  </div>

                  <h4 className="dashboard-subtitle">{t('dash.statistics')}</h4>
                  <p className="dashboard-intro">
                    The key email marketing metrics of your campaign are visualized in the tables/charts below.
                    <br />
                    You can look at those metrics to assess the overall success of your email marketing campaigns.
                  </p>

                  <div className="dashboard-campaign-stat-grid">
                    <CampaignBarChart campaign={selectedCampaign} />
                    <CampaignBadgeRows
                      campaign={selectedCampaign}
                      onLog={(type) => goToCampaign(`/logs/${type}`)}
                    />
                  </div>

                  <p className="dashboard-rate-intro">
                    Open rate is a measure that tells you how many delivered emails were opened by subscribers.
                    Click rate is a measure of how many people clicked on one of the links in your email campaign.
                  </p>

                  <div className="dashboard-rate-grid">
                    <RateSummary
                      title={t('dash.open_rate')}
                      percent={openRate}
                      rows={[
                        { label: t('dash.successful_deliveries'), value: `${formatNumber(delivered)} ${percentText(delivered ? 100 : 0)}` },
                        { label: t('dash.total_opens'), value: formatNumber(uniqOpens) },
                        { label: t('dash.uniq_opens'), value: formatNumber(uniqOpens) },
                        { label: t('dash.last_opened'), value: selectedCampaign?.last_opened_at ? formatDateTime(selectedCampaign.last_opened_at) : '-' },
                      ]}
                      buttonLabel="Open log"
                      onButtonClick={() => goToCampaign('/logs/opens')}
                    />
                    <RateSummary
                      title={t('dash.click_rate')}
                      percent={clickRate}
                      rows={[
                        { label: t('dash.total_clicks'), value: formatNumber(clicks) },
                        { label: t('dash.total_opens'), value: formatNumber(uniqOpens) },
                        { label: t('dash.abuse_reports'), value: formatNumber(campaignMetric(selectedCampaign, 'abuse_reports', 'feedback_count')) },
                        { label: t('dash.last_clicked'), value: selectedCampaign?.last_clicked_at ? formatDateTime(selectedCampaign.last_clicked_at) : '-' },
                      ]}
                      buttonLabel="Click log"
                      onButtonClick={() => goToCampaign('/logs/clicks')}
                    />
                  </div>

                  <PerformanceChart timeline={breakdown?.timeline || []} />
                </>
              )}
            </section>

            <section className="dashboard-section">
              <SectionHeading icon="signal_cellular_alt">{t('dash.list_growth')}</SectionHeading>
              {lists.length === 0 ? (
                <EmptyList icon="signal_cellular_alt">{t('dash.no_saved_lists')}</EmptyList>
              ) : (
                <>
                  <div className="dashboard-select-wrap">
                    <DashboardSelect value={selectedListUid} onChange={setSelectedListUid}>
                      <option value="all">All</option>
                      {lists.map((list) => (
                        <option key={list.uid} value={list.uid}>{list.name || '-'}</option>
                      ))}
                    </DashboardSelect>
                  </div>

                  <div className="dashboard-list-meta">
                    {selectedList && (
                      <>
                        <span>{selectedList.name || '-'}</span>
                        <span className="dashboard-muted">Created at: {formatDateTime(selectedList.created_at)}</span>
                      </>
                    )}
                  </div>

                  <div className="dashboard-growth-grid">
                    <DashGrowthChart data={growthData} />
                    <DashSubscriberPie total={subscriberTotal} />
                  </div>
                </>
              )}
            </section>

            <ActivityLog logs={data?.activity_logs || []} />

            <footer className="dashboard-footer">
              Copyright © 2025. SendQ - Send with Unlimited Confidence Email Marketing. All Rights Reserved.
          </footer>
        </>
      )}
    </div>
  );
};

const DashboardPage = () => (
  <AppLayout>
    <DashboardContent />
  </AppLayout>
);

export default DashboardPage;
