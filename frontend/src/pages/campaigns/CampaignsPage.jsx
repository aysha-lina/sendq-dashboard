import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, campaignsApi } from '../../api/services';
import AppLayout from '../../components/layout/AppLayout';
import { Spinner, toast } from '../../components/ui';
import { useTranslation } from '../../i18n/index.jsx';

const STATUS_KEYS = {
  new: 'camp.st_new', ready: 'camp.st_ready', scheduled: 'camp.st_scheduled',
  sending: 'camp.st_sending', paused: 'camp.st_paused', done: 'camp.st_done', error: 'camp.st_error',
};

const MaterialIcon = ({ children, className = '' }) => (
  <span className={`material-symbols-rounded ${className}`}>{children}</span>
);

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

const formatCampaignType = (type) => {
  if (!type) return '-';
  return `${type.charAt(0).toUpperCase()}${type.slice(1)}`;
};

const formatStatus = (status) => {
  if (!status) return '-';
  return status.replace(/_/g, ' ').toUpperCase();
};

const MetricBox = ({ value, sub, label }) => {
  const numeric = Number.parseFloat(value);
  const width = Number.isFinite(numeric) ? Math.max(0, Math.min(numeric, 100)) : 0;
  const displayValue = value === null || value === undefined || value === '' ? '-' : value;

  return (
    <div className="campaign-metric-box">
      <span className="campaign-stat-num">{displayValue}</span>
      <div className="campaign-progress">
        <div style={{ width: `${width}%` }} />
      </div>
      {sub && <span className="campaign-stat-sub">{sub}</span>}
      <span className="campaign-stat-label">{label}</span>
    </div>
  );
};

const EmptyList = ({ search }) => {
  const { t } = useTranslation();
  return (
    <div className="campaign-empty-list">
      <MaterialIcon>auto_awesome</MaterialIcon>
      <span>{search ? t('camp.no_result', null, 'No search result') : t('camp.empty', null, 'There are no campaigns yet')}</span>
    </div>
  );
};

const CampaignsPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [campaigns, setCampaigns] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('');
  const [sortOrder, setSortOrder] = useState('created_at');
  const [sortDirection, setSortDirection] = useState('desc');
  const [selected, setSelected] = useState([]);
  const [actionMenuUid, setActionMenuUid] = useState(null);
  const [perPage, setPerPage] = useState(25);

  // Close the open row action menu when clicking outside any row menu.
  useEffect(() => {
    if (actionMenuUid === null) return undefined;
    const onPointerDown = (event) => {
      if (!event.target.closest('.campaign-row-menu')) setActionMenuUid(null);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [actionMenuUid]);

  const query = useMemo(() => ({
    page: 1,
    per_page: perPage,
    keyword,
    status,
    sort_order: sortOrder,
    sort_direction: sortDirection,
  }), [keyword, status, sortOrder, sortDirection, perPage]);

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const { data } = await campaignsApi.list(query);
      setCampaigns(data.data || []);
      setPagination(data.pagination || null);
      setSelected([]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
     
  }, [query]);

  const allSelected = campaigns.length > 0 && selected.length === campaigns.length;

  const toggleSelected = (uid) => {
    setSelected((current) => (
      current.includes(uid)
        ? current.filter((item) => item !== uid)
        : [...current, uid]
    ));
  };

  const toggleAll = () => {
    setSelected(allSelected ? [] : campaigns.map((campaign) => campaign.uid));
  };

  const statusLabel = (s) => (STATUS_KEYS[s] ? t(STATUS_KEYS[s], null, formatStatus(s)) : formatStatus(s));

  const deleteCampaign = async (uid) => {
    const campaign = campaigns.find((item) => item.uid === uid);
    if (!window.confirm(t('camp.confirm_delete', { name: campaign?.name || uid }, `Delete campaign "${campaign?.name || uid}"?`))) return;
    await campaignsApi.delete(uid);
    setActionMenuUid(null);
    fetchCampaigns();
  };

  const sendTest = async (uid) => {
    setActionMenuUid(null);
    const email = window.prompt(t('camp.test_prompt', null, 'Send a test email of this campaign to:'));
    if (!email) return;
    try {
      const { data } = await campaignsApi.sendTest(uid, email.trim());
      toast.success(data.message || t('camp.test_sent', null, 'Test email sent.'));
    } catch (err) {
      toast.error(err.response?.data?.message || t('camp.test_fail', null, 'Could not send test email.'));
    }
  };

  const unscheduleCampaign = async (uid) => {
    if (!window.confirm(t('camp.confirm_unschedule', null, 'Cancel the scheduled send for this campaign?'))) return;
    await api.campaigns.unschedule(uid);
    setActionMenuUid(null);
    fetchCampaigns();
  };

  const handleBulkDelete = async () => {
    if (selected.length === 0) return;
    if (!window.confirm(t('camp.confirm_bulk_delete', { n: selected.length }, `Delete ${selected.length} selected campaign(s)?`))) return;
    await Promise.all(selected.map((uid) => campaignsApi.delete(uid)));
    fetchCampaigns();
  };

  const rowPauseResume = async (uid, action) => {
    try {
      await (action === 'pause' ? campaignsApi.pause(uid) : campaignsApi.resume(uid));
      setActionMenuUid(null);
      fetchCampaigns();
      toast.success(action === 'pause' ? t('camp.paused_one', null, 'Campaign paused.') : t('camp.resumed_one', null, 'Campaign resumed.'));
    } catch (err) {
      toast.error(err.response?.data?.message || t('camp.action_failed', null, 'Action failed.'));
    }
  };

  const copyCampaign = async (uid) => {
    setActionMenuUid(null);
    const campaign = campaigns.find((c) => c.uid === uid);
    const name = window.prompt(
      t('camp.copy_prompt', null, 'Name for the copied campaign:'),
      `Copy of ${campaign?.name || ''}`,
    );
    if (name === null) return;
    try {
      await campaignsApi.copy(uid, name.trim());
      toast.success(t('camp.copied', null, 'Campaign copied.'));
      fetchCampaigns();
    } catch (err) {
      toast.error(err.response?.data?.message || t('camp.action_failed', null, 'Action failed.'));
    }
  };

  const resendCampaign = async (uid) => {
    setActionMenuUid(null);
    if (!window.confirm(t('camp.resend_confirm', null, 'Create a copy of this campaign that sends only to people who did NOT open the original?'))) return;
    try {
      const { data } = await campaignsApi.resend(uid);
      toast.success(t('camp.resend_created', null, 'Resend draft created.'));
      if (data?.uid) navigate(`/campaigns/${data.uid}/edit`);
      else fetchCampaigns();
    } catch (err) {
      toast.error(err.response?.data?.message || t('camp.action_failed', null, 'Action failed.'));
    }
  };

  const archiveCampaign = async (uid, archived) => {
    setActionMenuUid(null);
    try {
      await (archived ? campaignsApi.unarchive(uid) : campaignsApi.archive(uid));
      toast.success(archived
        ? t('camp.unarchived', null, 'Campaign unarchived.')
        : t('camp.archived', null, 'Campaign archived.'));
      fetchCampaigns();
    } catch (err) {
      toast.error(err.response?.data?.message || t('camp.action_failed', null, 'Action failed.'));
    }
  };

  const handleBulkPauseResume = async (action) => {
    if (selected.length === 0) return;
    const call = action === 'pause' ? campaignsApi.pause : campaignsApi.resume;
    const results = await Promise.allSettled(selected.map((uid) => call(uid)));
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - ok;
    if (ok) toast.success(t(`camp.${action}d`, { n: ok }, `${ok} campaign(s) ${action === 'pause' ? 'paused' : 'resumed'}.`));
    if (failed) toast.error(t(`camp.${action}_failed`, { n: failed }, `${failed} could not be ${action === 'pause' ? 'paused' : 'resumed'} (wrong status).`));
    setSelected([]);
    fetchCampaigns();
  };

  return (
    <AppLayout>
      <div className="campaigns-page">
        <header className="campaign-page-title">
          <nav>Home</nav>
          <h1>
            <MaterialIcon>format_list_bulleted</MaterialIcon>
            <span>{t('camp.title', null, 'Campaigns')}</span>
          </h1>
        </header>

        <section className="campaign-listing-form">
          <div className="campaign-top-controls">
            <div className="campaign-filter-box">
              <label className="campaign-checkbox">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} />
              </label>

              {selected.length > 0 && (
                <div className="campaign-bulk-actions">
                  <button type="button" className="btn-secondary">
                    {t('common.actions', null, 'Actions')} <span>{selected.length}</span>
                  </button>
                  <div className="campaign-dropdown-menu">
                    <button type="button" onClick={() => handleBulkPauseResume('resume')}>
                      <MaterialIcon>restore</MaterialIcon> {t('camp.resume', null, 'Resume')}
                    </button>
                    <button type="button" onClick={() => handleBulkPauseResume('pause')}>
                      <MaterialIcon>motion_photos_pause</MaterialIcon> {t('camp.pause', null, 'Pause')}
                    </button>
                    <button type="button" onClick={handleBulkDelete}>
                      <MaterialIcon>delete_outline</MaterialIcon> {t('common.delete', null, 'Delete')}
                    </button>
                  </div>
                </div>
              )}

              <span className="campaign-filter-group">
                <span className="campaign-filter-title">{t('camp.sort_by', null, 'Sort by')}</span>
                <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)}>
                  <option value="created_at">{t('camp.created_at', null, 'Created at')}</option>
                  <option value="name">{t('camp.name', null, 'Name')}</option>
                </select>
                <button
                  type="button"
                  className="campaign-sort-button"
                  title="Change sort direction"
                  onClick={() => setSortDirection((current) => (current === 'desc' ? 'asc' : 'desc'))}
                >
                  <MaterialIcon>{sortDirection === 'desc' ? 'sort' : 'sort_by_alpha'}</MaterialIcon>
                </button>
              </span>

              <span className="campaign-filter-group">
                <span className="campaign-filter-title">{t('common.status', null, 'Status')}</span>
                <select value={status} onChange={(event) => setStatus(event.target.value)}>
                  <option value="">{t('camp.all_statuses', null, 'All statuses')}</option>
                  <option value="new">{t('camp.st_new', null, 'New')}</option>
                  <option value="ready">{t('camp.st_ready', null, 'Ready')}</option>
                  <option value="scheduled">{t('camp.st_scheduled', null, 'Scheduled')}</option>
                  <option value="sending">{t('camp.st_sending', null, 'Sending')}</option>
                  <option value="paused">{t('camp.st_paused', null, 'Paused')}</option>
                  <option value="done">{t('camp.st_done', null, 'Done')}</option>
                  <option value="error">{t('camp.st_error', null, 'Error')}</option>
                  <option value="archived">{t('camp.st_archived', null, 'Archived')}</option>
                </select>
              </span>

              <label className="campaign-search">
                <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder={t('camp.search_ph', null, 'Type to search')} />
                <MaterialIcon>search</MaterialIcon>
              </label>
            </div>

            <button type="button" className="btn-secondary campaign-create-button" onClick={() => navigate('/campaigns/create')}>
              <MaterialIcon>add</MaterialIcon> {t('camp.create', null, 'Create campaign')}
            </button>
          </div>

          <div className="campaign-table-container">
            {loading ? (
              <div className="campaign-loading"><Spinner size="lg" /></div>
            ) : campaigns.length === 0 ? (
              <EmptyList search={Boolean(keyword)} />
            ) : (
              <table className="campaign-table">
                <tbody>
                  {campaigns.map((campaign) => (
                    <tr key={campaign.uid}>
                      <td className="campaign-check-cell">
                        <label className="campaign-checkbox">
                          <input
                            type="checkbox"
                            checked={selected.includes(campaign.uid)}
                            onChange={() => toggleSelected(campaign.uid)}
                          />
                        </label>
                      </td>
                      <td className="campaign-name-cell">
                        <button type="button" className="campaign-title-link" onClick={() => navigate(`/campaigns/${campaign.uid}/statistics`)}>
                          {campaign.name || '-'}
                        </button>
                        <span className="campaign-muted">{formatCampaignType(campaign.type)}</span>
                        {campaign.status === 'scheduled' && campaign.scheduled_at ? (
                          <span className="campaign-scheduled-at">
                            <MaterialIcon>schedule</MaterialIcon>
                            {t('camp.sends_at', null, 'Sends at:')} {formatDateTime(campaign.scheduled_at)}
                          </span>
                        ) : (
                          <span className="campaign-updated">
                            {t('camp.updated_at', null, 'Updated at:')} {formatDateTime(campaign.updated_at || campaign.created_at)}
                          </span>
                        )}
                      </td>
                      <td className="campaign-stat-cell">
                        {campaign.status !== 'new' ? (
                          <MetricBox value={campaign.delivered_rate} sub={campaign.delivered_label} label={t('camp.sent', null, 'Sent')} />
                        ) : null}
                      </td>
                      <td className="campaign-stat-cell">
                        {campaign.status !== 'new' ? (
                          <MetricBox value={campaign.open_rate} label={t('camp.open_rate', null, 'Open rate')} />
                        ) : null}
                      </td>
                      <td className="campaign-stat-cell">
                        {campaign.status !== 'new' ? (
                          <MetricBox value={campaign.click_rate} label={t('camp.click_rate', null, 'Click rate')} />
                        ) : null}
                      </td>
                      <td className="campaign-status-cell">
                        <span className={`campaign-status campaign-status-${campaign.status || 'unknown'}`}>
                          {statusLabel(campaign.status)}
                        </span>
                      </td>
                      <td className="campaign-actions-cell">
                        <div className="campaign-actions">
                          <button type="button" className="btn-primary" onClick={() => navigate(`/campaigns/${campaign.uid}/edit`)}>
                            <MaterialIcon>edit</MaterialIcon> {t('common.edit', null, 'Edit')}
                          </button>
                          <button type="button" className="btn-danger" onClick={() => navigate(`/campaigns/${campaign.uid}/statistics`)}>
                            <MaterialIcon>multiline_chart</MaterialIcon> {t('camp.statistics', null, 'Statistics')}
                          </button>
                          <div className="campaign-row-menu">
                            <button
                              type="button"
                              className="btn-secondary campaign-caret-button"
                              onClick={() => setActionMenuUid((current) => (current === campaign.uid ? null : campaign.uid))}
                            >
                              ⌄
                            </button>
                            {actionMenuUid === campaign.uid && (
                              <div className="campaign-dropdown-menu campaign-row-dropdown">
                                <button type="button" onClick={() => sendTest(campaign.uid)}>
                                  <MaterialIcon>forward_to_inbox</MaterialIcon> {t('camp.send_test', null, 'Send test email')}
                                </button>
                                <button type="button" onClick={() => copyCampaign(campaign.uid)}>
                                  <MaterialIcon>content_copy</MaterialIcon> {t('camp.copy', null, 'Copy')}
                                </button>
                                {campaign.status === 'done' && (
                                  <button type="button" onClick={() => resendCampaign(campaign.uid)}>
                                    <MaterialIcon>replay</MaterialIcon> {t('camp.resend_nonopeners', null, 'Resend to non-openers')}
                                  </button>
                                )}
                                <button type="button" onClick={() => archiveCampaign(campaign.uid, campaign.status === 'archived')}>
                                  <MaterialIcon>{campaign.status === 'archived' ? 'unarchive' : 'archive'}</MaterialIcon>{' '}
                                  {campaign.status === 'archived' ? t('camp.unarchive', null, 'Unarchive') : t('camp.archive', null, 'Archive')}
                                </button>
                                {campaign.status === 'sending' && (
                                  <button type="button" onClick={() => rowPauseResume(campaign.uid, 'pause')}>
                                    <MaterialIcon>motion_photos_pause</MaterialIcon> {t('camp.pause', null, 'Pause')}
                                  </button>
                                )}
                                {campaign.status === 'paused' && (
                                  <button type="button" onClick={() => rowPauseResume(campaign.uid, 'resume')}>
                                    <MaterialIcon>restore</MaterialIcon> {t('camp.resume', null, 'Resume')}
                                  </button>
                                )}
                                {campaign.status === 'scheduled' && (
                                  <button type="button" onClick={() => unscheduleCampaign(campaign.uid)}>
                                    <MaterialIcon>cancel_schedule_send</MaterialIcon> {t('camp.unschedule', null, 'Unschedule')}
                                  </button>
                                )}
                                <button type="button" onClick={() => deleteCampaign(campaign.uid)}>
                                  <MaterialIcon>delete_outline</MaterialIcon> {t('common.delete', null, 'Delete')}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {pagination && campaigns.length > 0 && (
            <div className="campaign-pagination-row">
              <select value={perPage} onChange={(e) => setPerPage(Number(e.target.value))}>
                {[15, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <span>
                {t('camp.items_per_page', null, 'items per page')} | {t('camp.page_range', { from: 1, to: campaigns.length, total: pagination.total || campaigns.length }, `From 1 to ${campaigns.length}. Total ${pagination.total || campaigns.length} records`)}
              </span>
              <span>{t('camp.page_of', { current: pagination.current_page || 1, total: pagination.total_pages || 1 }, `Page ${pagination.current_page || 1} of ${pagination.total_pages || 1}`)}</span>
            </div>
          )}
        </section>

      </div>
    </AppLayout>
  );
};

export default CampaignsPage;
