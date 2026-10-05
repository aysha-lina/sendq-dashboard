import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { subscribersApi, sendingApi } from '../../api/services';
import { useTranslation } from '../../i18n';
import ListDetailTabs from './ListDetailTabs';
import WebhookModal from './WebhookModal';

const MaterialIcon = ({ name, className = '' }) => (
  <span className={`material-symbols-rounded ${className}`}>{name}</span>
);

const getVerificationStatus = (subscriber) => {
  const status = (
    subscriber.verification_status
    || subscriber.email_verification_status
    || subscriber.email_status
    || ''
  ).toString().toLowerCase();

  if (['deliverable', 'verified', 'valid'].includes(status)) return 'deliverable';
  if (['undeliverable', 'invalid', 'failed'].includes(status)) return 'undeliverable';
  if (['risky', 'risk'].includes(status)) return 'risky';
  if (status === 'unknown') return 'unknown';
  if (['unverified', 'pending'].includes(status)) return 'unverified';
  return '';
};

const StatLabel = ({ label, color, value, total }) => {
  const hasValue = Number.isFinite(value) && Number.isFinite(total) && total > 0;
  const percent = hasValue ? `${((value / total) * 100).toFixed(0)}%` : '-';
  const count = Number.isFinite(value) ? value : '-';

  return (
    <div className="flex items-center gap-2 text-sm font-normal text-[#d7d7df]">
      <span className="h-4 w-8 rounded border-2 border-white" style={{ backgroundColor: color }} />
      <span>{label}</span>
      <span>{percent} ({count})</span>
    </div>
  );
};

const EmailVerificationPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [showWebhook, setShowWebhook] = useState(false);
  const [subscribers, setSubscribers] = useState([]);
  const [total, setTotal] = useState(null);
  const [isProcessRunning, setIsProcessRunning] = useState(false);
  const [selectedServer, setSelectedServer] = useState('');
  const [servers, setServers] = useState([]);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [stats, setStats] = useState(null);

  const loadSubscribers = () => {
    subscribersApi.list({ page: 1, per_page: 500 })
      .then(({ data }) => {
        setSubscribers(data.data || []);
        setTotal(data.pagination?.total ?? (data.data || []).length);
      })
      .catch(() => { setSubscribers([]); setTotal(null); });
    // Accurate, un-capped counts straight from the backend.
    sendingApi.verifyStats()
      .then(({ data }) => setStats(data))
      .catch(() => setStats(null));
  };

  useEffect(() => { loadSubscribers(); }, []);

  useEffect(() => {
    sendingApi.verificationServers()
      .then(({ data }) => setServers(data.data || []))
      .catch(() => setServers([]));
  }, []);

  const startVerification = async () => {
    setMessage(''); setProgress(0); setIsProcessRunning(true);
    try {
      const { data } = await sendingApi.verifyRun(selectedServer || null);
      // Poll job progress until it finishes.
      const poll = setInterval(async () => {
        try {
          const { data: job } = await sendingApi.jobStatus(data.queue, data.jobId);
          setProgress(job.progress || 0);
          if (['completed', 'failed'].includes(job.state)) {
            clearInterval(poll);
            setIsProcessRunning(false);
            setMessage(job.state === 'completed'
              ? t('ld.verify_complete', { result: JSON.stringify(job.result) })
              : t('ld.verify_failed', { reason: job.failedReason || t('ld.unknown_error') }));
            loadSubscribers();
          }
        } catch {
          clearInterval(poll); setIsProcessRunning(false);
        }
      }, 1500);
    } catch (err) {
      setIsProcessRunning(false);
      setMessage(err.response?.data?.message || t('ld.verify_start_failed'));
    }
  };

  const resetVerification = async () => {
    try {
      await sendingApi.verifyReset();
      setSelectedServer('');
      setMessage(t('ld.verify_reset_done'));
      loadSubscribers();
    } catch (err) {
      setMessage(err.response?.data?.message || t('ld.verify_reset_failed'));
    }
  };

  const counts = useMemo(() => {
    // Prefer accurate backend stats; fall back to counting loaded rows.
    if (stats) {
      return {
        deliverable: stats.deliverable,
        undeliverable: stats.undeliverable,
        risky: stats.risky,
        unknown: stats.unknown,
        unverified: stats.pending,
      };
    }
    const base = { deliverable: 0, undeliverable: 0, risky: 0, unknown: 0, unverified: 0 };
    subscribers.forEach((subscriber) => {
      const status = getVerificationStatus(subscriber);
      base[status || 'unverified'] += 1;
    });
    return base;
  }, [subscribers, stats]);

  const knownTotal = stats ? stats.total : (Number.isFinite(total) ? total : null);
  const verifiedCount = stats ? stats.verified : (counts.deliverable + counts.undeliverable + counts.risky + counts.unknown);
  const unverifiedCount = stats ? stats.pending : (knownTotal === null ? null : Math.max(knownTotal - verifiedCount, 0));

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

          <h1 className="mb-8 text-[40px] font-normal text-[rgba(197,192,142,0.22)]">{t('ld.tab_email_verification')}</h1>

          <p className="mb-10 text-xl font-normal">
            <span className="mr-2 rounded-full bg-[#00bcd4] px-3 py-2 text-white">{knownTotal ?? '-'}</span>
            {t('common.subscribers')}
          </p>

          <ListDetailTabs activeLabel="Email verification" />

          <section className="grid gap-12 xl:grid-cols-[minmax(480px,1fr)_minmax(380px,520px)]">
            <div>
              <h2 className="sq-section-title mb-8 text-[34px]">{t('ld.list_verification')}</h2>
              <p className="mb-6 max-w-[780px] text-[20px] font-normal leading-[1.4] text-white">
                {t('ld.list_verification_desc')}
              </p>

              <select
                className="input mb-7 h-11 max-w-[724px] text-lg font-normal"
                value={selectedServer}
                onChange={(event) => setSelectedServer(event.target.value)}
                disabled={isProcessRunning}
              >
                <option value="">{t('ld.builtin_verifier')}</option>
                {servers.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.type})</option>)}
              </select>

              <button
                className="btn-danger h-[50px] px-6 text-xl font-normal"
                onClick={startVerification}
                disabled={isProcessRunning}
              >
                <MaterialIcon name="play_arrow" className="text-[24px]" />
                {isProcessRunning ? t('ld.verifying_progress', { progress }) : t('ld.start_verification')}
              </button>
              {message && <p className="mt-4 max-w-[780px] text-base text-[#9ad0ff]">{message}</p>}

              <h3 className="sq-section-title mb-5 mt-14 text-[34px]">{t('ld.verification_status')}</h3>
              <p className="max-w-[780px] text-[20px] font-normal leading-[1.35] text-white">
                {isProcessRunning
                  ? t('ld.verification_ready')
                  : t('ld.verification_none')}
                {knownTotal !== null && (
                  <>
                    {' '}{t('ld.verification_summary', { verified: verifiedCount, total: knownTotal })}
                  </>
                )}
              </p>

              <button
                className="btn-primary mt-7 h-11 px-5 text-lg font-normal"
                onClick={resetVerification}
                disabled={isProcessRunning}
              >
                {t('ld.reset_verification')}
              </button>
            </div>

            <div className="pt-1">
              <h2 className="mb-7 text-center text-[26px] font-normal text-white">{t('common.statistics')}</h2>
              <div className="relative mx-auto h-[360px] w-[360px] max-w-full">
                <div className="absolute inset-0 rounded-full border-2 border-[#c9cad5] bg-[#5f80b7]" />
                <div className="absolute left-1/2 top-0 h-1/2 w-px bg-[#b7bdd2]" />
                <div className="absolute left-[30px] top-[-18px] text-right text-sm font-normal leading-tight text-[#d7d7df]">{t('ld.unknown')}<br />{counts.unknown || '-'}</div>
                <div className="absolute left-[190px] top-[-16px] text-sm font-normal leading-tight text-[#d7d7df]">{t('ld.deliverable')}<br />{counts.deliverable || '-'}</div>
                <div className="absolute right-[-84px] top-[58px] text-sm font-normal leading-tight text-[#d7d7df]">{t('ld.undeliverable')}<br />{counts.undeliverable || '-'}</div>
                <div className="absolute right-[-58px] top-[112px] text-sm font-normal leading-tight text-[#d7d7df]">{t('ld.risky')}<br />{counts.risky || '-'}</div>
                <div className="absolute bottom-[-35px] left-[200px] text-sm font-normal leading-tight text-[#d7d7df]">{t('ld.unverified')}<br />{unverifiedCount ?? '-'}</div>
              </div>

              <div className="mx-auto mt-16 grid max-w-[520px] grid-cols-2 gap-x-4 gap-y-3">
                <StatLabel label={t('ld.deliverable')} color="#61b9b4" value={counts.deliverable} total={knownTotal} />
                <StatLabel label={t('ld.undeliverable')} color="#bf617a" value={counts.undeliverable} total={knownTotal} />
                <StatLabel label={t('ld.risky')} color="#b2bd5f" value={counts.risky} total={knownTotal} />
                <StatLabel label={t('ld.unverified')} color="#6286be" value={unverifiedCount} total={knownTotal} />
                <StatLabel label={t('ld.unknown')} color="#5d5d5b" value={counts.unknown} total={knownTotal} />
              </div>
            </div>
          </section>
        </main>

        <footer className="pt-10 text-lg font-normal text-[#b8b8c2]">
          {t('common.copyright')}
        </footer>
      </div>
      {showWebhook && <WebhookModal onClose={() => setShowWebhook(false)} />}
    </AppLayout>
  );
};

export default EmailVerificationPage;
