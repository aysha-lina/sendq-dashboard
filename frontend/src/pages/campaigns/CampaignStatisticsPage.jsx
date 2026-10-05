import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { Spinner } from '../../components/ui';
import { campaignsApi, analyticsApi } from '../../api/services';
import { CampaignHeader, CampaignTabs } from './CampaignNav';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { useTranslation } from '../../i18n';

const MaterialIcon = ({ children, className = '' }) => (
  <span className={`material-symbols-rounded ${className}`}>{children}</span>
);

const formatDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
};

const InfoRow = ({ label, icon, children }) => (
  <div className="campaign-info-row">
    <span className="campaign-info-label">
      {label} <MaterialIcon>{icon}</MaterialIcon>
    </span>
    <span>{children || '-'}</span>
  </div>
);

const RateBar = ({ label, rate, logLabel, onViewLog, details }) => (
  <div className="campaign-rate-panel">
    <div className="campaign-rate-head">
      <h4>{label}</h4>
      <span>{rate != null ? `${Number(rate).toFixed(2)}%` : '0.00%'}</span>
    </div>
    <div className="campaign-progress">
      <div style={{ width: rate != null ? `${Math.min(rate, 100)}%` : '0%' }} />
    </div>
    <div className="campaign-rate-details">
      {details.map((d) => (
        <div key={d.label} className="campaign-rate-detail-row">
          <span>{d.label}</span><strong>{d.value}</strong>
        </div>
      ))}
    </div>
    <div className="campaign-rate-foot">
      <button type="button" className="btn-secondary" onClick={onViewLog}>
        {logLabel} <MaterialIcon>arrow_forward</MaterialIcon>
      </button>
    </div>
  </div>
);

const PerfChart = ({ timeline = [] }) => {
  const { t } = useTranslation();
  return (
    <div className="campaign-perf-chart">
      <ResponsiveContainer width="100%" height={340}>
        <LineChart data={timeline} margin={{ top: 20, right: 24, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="4 4" stroke="rgba(148,163,184,.18)" />
          <XAxis dataKey="label" stroke="#9aa6c0" fontSize={11} tickMargin={8} />
          <YAxis allowDecimals={false} stroke="#9aa6c0" fontSize={11} />
          <Tooltip contentStyle={{ background: '#1b2236', border: '1px solid #3a3a4d', borderRadius: 8, color: '#fff' }} />
          <Legend />
          <Line type="monotone" dataKey="opens" name={t('cst.opened')} stroke="#16c0c0" strokeWidth={2} dot={{ r: 2 }} />
          <Line type="monotone" dataKey="clicks" name={t('cst.clicked')} stroke="#e0848f" strokeWidth={2} dot={{ r: 2 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

// Heading + empty/data panel used for the geo / subscriber analytics rows.
const AnalyticsPanel = ({ icon, title, rows }) => {
  const { t } = useTranslation();
  return (
    <div className="campaign-analytics-panel">
      <h4 className="campaign-analytics-title"><MaterialIcon>{icon}</MaterialIcon> {title}</h4>
      <div className="campaign-analytics-card">
        {rows?.length ? (
          rows.map((r) => (
            <div key={r.label} className="campaign-breakdown-row"><span>{r.label}</span><strong>{r.value}</strong></div>
          ))
        ) : (
          <div className="campaign-analytics-empty">
            <MaterialIcon>auto_awesome</MaterialIcon>
            <p>{t('cst.no_logs_yet')}</p>
          </div>
        )}
      </div>
    </div>
  );
};

const DeviceCard = ({ icon, title, rows }) => {
  const { t } = useTranslation();
  return (
    <div className="campaign-device-card">
      <h5><MaterialIcon>{icon}</MaterialIcon> {title}</h5>
      {rows?.length ? (
        rows.map((r) => (
          <div key={r.label} className="campaign-breakdown-row"><span>{r.label}</span><strong>{r.value}</strong></div>
        ))
      ) : (
        <p className="campaign-device-empty">{t('cst.no_data_available')}</p>
      )}
    </div>
  );
};

const CampaignStatisticsPage = () => {
  const { uid } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [campaign, setCampaign] = useState(null);
  const [stats, setStats] = useState(null);
  const [breakdown, setBreakdown] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      campaignsApi.get(uid),
      analyticsApi.campaign(uid),
    ])
      .then(([campaignRes, statsRes]) => {
        setCampaign(campaignRes.data);
        setStats(statsRes.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
    analyticsApi.campaignBreakdown(uid)
      .then(({ data }) => setBreakdown(data))
      .catch(() => setBreakdown(null));
  }, [uid]);

  const statRows = stats ? [
    { label: t('cst.opened'), value: stats.opens, icon: 'drafts', type: 'opens' },
    { label: t('cst.not_opened'), value: stats.totalSent - stats.opens, icon: 'mark_email_unread' },
    { label: t('cst.unique_clicks'), value: stats.clicks, icon: 'ads_click', type: 'clicks' },
    { label: t('cst.unsubscribed'), value: stats.unsubscribed, icon: 'unsubscribe', type: 'unsubscribes' },
    { label: t('cst.bounced'), value: stats.bounces, icon: 'bounce_email', type: 'bounces' },
    { label: t('cst.reported'), value: stats.feedback, icon: 'report', type: 'feedback' },
  ] : [];

  return (
    <AppLayout>
      <div className="campaigns-page campaign-detail-page">
        {loading ? (
          <div className="campaign-loading"><Spinner size="lg" /></div>
        ) : (
          <>
            <CampaignHeader campaign={campaign} />

            <CampaignTabs uid={uid} active="overview" />

            <section className="campaign-detail-info">
              <h2>
                <span className="text-teal">{stats?.totalSent ?? campaign?.real_sent_count ?? '-'}</span>
                {' '}{t('cst.recipients')}
              </h2>
              <div className="campaign-info-grid">
                <div>
                  <InfoRow label={t('cst.from')} icon="alternate_email">
                    {campaign?.mailList?.name || campaign?.from_name}
                  </InfoRow>
                  <InfoRow label={t('cst.subject')} icon="subject">{campaign?.subject}</InfoRow>
                  <InfoRow label={t('cst.from_email')} icon="alternate_email">{campaign?.from_email}</InfoRow>
                  <InfoRow label={t('cst.from_name')} icon="subject">{campaign?.from_name}</InfoRow>
                </div>
                <div>
                  <InfoRow label={t('cst.reply_to')} icon="alternate_email">{campaign?.reply_to}</InfoRow>
                  <InfoRow label={t('cst.updated_at')} icon="event">{formatDateTime(campaign?.updated_at)}</InfoRow>
                  <InfoRow label={t('cst.run_at')} icon="event">{formatDateTime(campaign?.run_at)}</InfoRow>
                  <InfoRow label={t('cst.delivery_at')} icon="event">{formatDateTime(campaign?.delivery_at)}</InfoRow>
                </div>
              </div>
            </section>

            <section className="campaign-detail-section">
              <h4>{t('common.statistics')}</h4>
              <p>
                {t('cst.statistics_intro')}
              </p>
              <div className="campaign-detail-stat-grid">
                <div className="campaign-detail-empty-chart">
                  <div style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <span style={{ color: '#a0a0b0', fontSize: '14px' }}>{t('camp.sent')}</span>
                      <span style={{ color: '#00bcd4', fontWeight: 600 }}>{stats?.totalSent ?? 0}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <span style={{ color: '#a0a0b0', fontSize: '14px' }}>{t('common.open_rate')}</span>
                      <span style={{ color: '#4caf50', fontWeight: 600 }}>{stats?.openRate ?? 0}%</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <span style={{ color: '#a0a0b0', fontSize: '14px' }}>{t('common.click_rate')}</span>
                      <span style={{ color: '#ff9800', fontWeight: 600 }}>{stats?.clickRate ?? 0}%</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#a0a0b0', fontSize: '14px' }}>{t('cst.bounce_rate')}</span>
                      <span style={{ color: '#e53935', fontWeight: 600 }}>{stats?.bounceRate ?? 0}%</span>
                    </div>
                  </div>
                </div>
                <div className="campaign-badge-list">
                  {statRows.map(({ label, value, type }) => (
                    <div key={label} className="campaign-badge-row">
                      <span className="campaign-badge-empty" style={value > 0 ? { color: '#00bcd4' } : {}}>
                        {value ?? '-'}
                      </span>
                      <span>{label}</span>
                      {type ? (
                        <button type="button" onClick={() => navigate(`/campaigns/${uid}/logs/${type}`)}>
                          <MaterialIcon>arrow_forward</MaterialIcon> {t('cst.view_log')}
                        </button>
                      ) : <span />}
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="campaign-detail-section">
              <p>
                {t('cst.rate_intro')}
              </p>
              <div className="campaign-rate-grid">
                <RateBar
                  label={t('common.open_rate')}
                  rate={stats?.openRate}
                  logLabel={t('cst.open_log')}
                  onViewLog={() => navigate(`/campaigns/${uid}/logs/opens`)}
                  details={[
                    { label: t('cst.successful_deliveries'), value: `${stats?.totalSent ?? 0}  ${Number(stats?.openRate ?? 0).toFixed(2)}%` },
                    { label: t('cst.total_opens'), value: stats?.opens ?? 0 },
                    { label: t('cst.uniq_opens'), value: stats?.opens ?? 0 },
                    { label: t('cst.last_opened'), value: formatDateTime(stats?.lastOpenedAt) || '-' },
                  ]}
                />
                <RateBar
                  label={t('common.click_rate')}
                  rate={stats?.clickRate}
                  logLabel={t('cst.click_log')}
                  onViewLog={() => navigate(`/campaigns/${uid}/logs/clicks`)}
                  details={[
                    { label: t('cst.total_clicks'), value: stats?.clicks ?? 0 },
                    { label: t('cst.total_opens'), value: stats?.opens ?? 0 },
                    { label: t('cst.abuse_reports'), value: stats?.feedback ?? 0 },
                    { label: t('cst.last_clicked'), value: formatDateTime(stats?.lastClickedAt) || '-' },
                  ]}
                />
              </div>
            </section>

            {/* Performance — stat cards + 24h activity line chart */}
            <section className="campaign-detail-section">
              <div className="campaign-perf-cards">
                <div className="campaign-perf-card perf-opened"><strong>{stats?.opens ?? 0}</strong><span>{t('cst.opened')}</span></div>
                <div className="campaign-perf-card perf-clicked"><strong>{stats?.clicks ?? 0}</strong><span>{t('cst.clicked')}</span></div>
                <div className="campaign-perf-card perf-bounced"><strong>{stats?.bounces ?? 0}</strong><span>{t('cst.bounced')}</span></div>
                <div className="campaign-perf-card perf-unsub"><strong>{stats?.unsubscribed ?? 0}</strong><span>{t('cst.unsubscribed')}</span></div>
              </div>
              <div className="campaign-perf-head">
                <h4><MaterialIcon>schedule</MaterialIcon> {t('cst.performance')}</h4>
                <div className="campaign-perf-period">
                  <span>{t('cst.period')}</span>
                  <select className="input"><option>{t('cst.24_hour')}</option></select>
                </div>
              </div>
              <p>{t('cst.performance_intro')}</p>
              <PerfChart timeline={breakdown?.timeline || []} />
            </section>

            {/* Geo + subscriber analytics */}
            <section className="campaign-detail-section">
              <div className="campaign-analytics-grid">
                <AnalyticsPanel icon="group" title={t('cst.subscribers_most_opens')} rows={breakdown?.topSubscribers} />
                <AnalyticsPanel
                  icon="link"
                  title={t('cst.top_clicked_links', null, 'Top clicked links')}
                  rows={(breakdown?.links || []).map((l) => ({ label: l.url, value: l.value }))}
                />
              </div>
            </section>

            {/* Device & client analytics */}
            <section className="campaign-detail-section">
              <h4><MaterialIcon>devices</MaterialIcon> {t('cst.device_client_analytics')}</h4>
              <div className="campaign-device-grid">
                <DeviceCard icon="devices" title={t('cst.device_types')} rows={breakdown?.devices} />
                <DeviceCard icon="mail" title={t('cst.email_clients_browsers')} rows={breakdown?.emailClients} />
                <DeviceCard icon="computer" title={t('cst.operating_systems')} rows={breakdown?.os} />
              </div>
            </section>
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default CampaignStatisticsPage;
