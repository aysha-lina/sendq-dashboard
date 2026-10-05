import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { Spinner } from '../../components/ui';
import { analyticsApi } from '../../api/services';
import { useTranslation } from '../../i18n';

const MaterialIcon = ({ children, className = '' }) => (
  <span className={`material-symbols-rounded ${className}`}>{children}</span>
);

const formatNumber = (value) => {
  if (value === null || value === undefined) return '-';
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString() : '-';
};

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString(undefined, {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
};

const clamp = (v) => Math.max(0, Math.min(Number(v) || 0, 100));

const StatusBadge = ({ status, t }) => {
  const map = {
    done: ['analytics-status-done', t('camp.sent')],
    sending: ['analytics-status-sending', t('camp.st_sending')],
    paused: ['analytics-status-paused', t('camp.st_paused')],
    queued: ['analytics-status-queued', t('an.st_queued')],
  };
  const [cls, label] = map[status] || ['analytics-status-default', status];
  return <span className={`analytics-status-badge ${cls}`}>{label}</span>;
};

const StatCard = ({ icon, label, value, sub }) => (
  <div className="analytics-stat-card">
    <div className="analytics-stat-icon">
      <MaterialIcon>{icon}</MaterialIcon>
    </div>
    <div>
      <p className="analytics-stat-label">{label}</p>
      <p className="analytics-stat-value">{value}</p>
      {sub && <p className="analytics-stat-sub">{sub}</p>}
    </div>
  </div>
);

const RatePanel = ({ title, rate, rows }) => (
  <div className="analytics-rate-panel">
    <div className="analytics-rate-head">
      <h4>{title}</h4>
      <span>{rate != null ? `${rate}%` : '-'}</span>
    </div>
    <div className="analytics-progress">
      <div style={{ width: `${clamp(rate)}%` }} />
    </div>
    <div className="analytics-rate-rows">
      {rows.map(({ label, value }) => (
        <div key={label} className="analytics-rate-row">
          <span>{label}</span>
          <span>{value}</span>
        </div>
      ))}
    </div>
  </div>
);

const AnalyticsPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    analyticsApi.dashboard()
      .then((res) => setData(res.data))
      .catch((err) => setError(err?.response?.data?.message || t('an.load_failed')))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppLayout>
      <div className="analytics-page">
        <header className="analytics-header">
          <h1>{t('an.title')}</h1>
          <p>{t('an.subtitle')}</p>
        </header>

        {loading && (
          <div className="analytics-loading"><Spinner size="lg" /></div>
        )}

        {error && (
          <div className="analytics-error">
            <MaterialIcon>error_outline</MaterialIcon>
            <p>{error}</p>
          </div>
        )}

        {data && (
          <>
            {/* Summary stat cards */}
            <section className="analytics-section">
              <div className="analytics-stat-grid">
                <StatCard icon="send" label={t('an.total_sent')} value={formatNumber(data.totalSent)} />
                <StatCard icon="drafts" label={t('an.total_opens')} value={formatNumber(data.opens)} />
                <StatCard icon="ads_click" label={t('an.total_clicks')} value={formatNumber(data.clicks)} />
                <StatCard icon="campaign" label={t('an.campaigns')} value={formatNumber(data.totalCampaigns)} />
                <StatCard icon="group" label={t('common.subscribers')} value={formatNumber(data.totalSubscribers)} />
                <StatCard
                  icon="bounce_email"
                  label={t('an.bounces')}
                  value={formatNumber(data.bounces)}
                  sub={data.bounceRate != null ? t('an.bounce_rate_sub', { rate: data.bounceRate }) : null}
                />
              </div>
            </section>

            {/* Rate panels */}
            <section className="analytics-section">
              <h3 className="analytics-section-title">
                <MaterialIcon>auto_graph</MaterialIcon> {t('an.overall_rates')}
              </h3>
              <div className="analytics-rate-grid">
                <RatePanel
                  title={t('common.open_rate')}
                  rate={data.openRate}
                  rows={[
                    { label: t('an.emails_sent'), value: formatNumber(data.totalSent) },
                    { label: t('an.total_opens'), value: formatNumber(data.opens) },
                  ]}
                />
                <RatePanel
                  title={t('common.click_rate')}
                  rate={data.clickRate}
                  rows={[
                    { label: t('an.total_opens'), value: formatNumber(data.opens) },
                    { label: t('an.total_clicks'), value: formatNumber(data.clicks) },
                  ]}
                />
                <RatePanel
                  title={t('an.bounce_rate')}
                  rate={data.bounceRate}
                  rows={[
                    { label: t('an.emails_sent'), value: formatNumber(data.totalSent) },
                    { label: t('an.total_bounces'), value: formatNumber(data.bounces) },
                  ]}
                />
              </div>
            </section>

            {/* Recent campaigns table */}
            <section className="analytics-section">
              <h3 className="analytics-section-title">
                <MaterialIcon>history_toggle_off</MaterialIcon> {t('an.recent_campaigns')}
              </h3>
              {(!data.campaigns || data.campaigns.length === 0) ? (
                <div className="analytics-empty">
                  <MaterialIcon>campaign</MaterialIcon>
                  <p>{t('an.no_sent')}</p>
                </div>
              ) : (
                <div className="analytics-table-wrap">
                  <table className="analytics-table">
                    <thead>
                      <tr>
                        <th>{t('an.col_campaign')}</th>
                        <th>{t('common.status')}</th>
                        <th>{t('camp.sent')}</th>
                        <th>{t('an.col_opens')}</th>
                        <th>{t('an.col_clicks')}</th>
                        <th>{t('common.open_rate')}</th>
                        <th>{t('common.click_rate')}</th>
                        <th>{t('an.run_at')}</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {data.campaigns.map((c) => (
                        <tr key={c.uid}>
                          <td>
                            <div className="analytics-campaign-name">{c.name}</div>
                            <div className="analytics-campaign-subject">{c.subject}</div>
                          </td>
                          <td><StatusBadge status={c.status} t={t} /></td>
                          <td>{formatNumber(c.totalSent)}</td>
                          <td>{formatNumber(c.opens)}</td>
                          <td>{formatNumber(c.clicks)}</td>
                          <td>
                            <div className="analytics-mini-rate">
                              <div className="analytics-mini-bar">
                                <div style={{ width: `${clamp(c.openRate)}%` }} />
                              </div>
                              <span>{c.openRate}%</span>
                            </div>
                          </td>
                          <td>
                            <div className="analytics-mini-rate">
                              <div className="analytics-mini-bar analytics-mini-bar-click">
                                <div style={{ width: `${clamp(c.clickRate)}%` }} />
                              </div>
                              <span>{c.clickRate}%</span>
                            </div>
                          </td>
                          <td>{formatDateTime(c.run_at)}</td>
                          <td>
                            <button
                              type="button"
                              className="analytics-view-btn"
                              onClick={() => navigate(`/campaigns/${c.uid}/statistics`)}
                            >
                              <MaterialIcon>arrow_forward</MaterialIcon>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default AnalyticsPage;
