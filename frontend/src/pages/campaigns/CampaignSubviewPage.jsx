import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { Spinner, toast } from '../../components/ui';
import { campaignsApi, analyticsApi, subscribersApi, listsApi } from '../../api/services';
import { CampaignHeader, CampaignTabs } from './CampaignNav';
import useClickOutside from '../../hooks/useClickOutside';
import { useTranslation } from '../../i18n';

const MaterialIcon = ({ children, className = '' }) => (
  <span className={`material-symbols-rounded ${className}`}>{children}</span>
);

const formatDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
};

const EmptyState = ({ children }) => (
  <div className="campaign-log-empty-state">
    <MaterialIcon>auto_awesome</MaterialIcon>
    <span>{children}</span>
  </div>
);

// ── Links: top clicked links from the analytics breakdown ──
const LinksView = ({ uid }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [links, setLinks] = useState(null);
  useEffect(() => {
    analyticsApi.campaignBreakdown(uid)
      .then(({ data }) => setLinks(data.links || []))
      .catch(() => setLinks([]));
  }, [uid]);

  return (
    <>
      <h2 className="campaign-log-title">{t('cst.links')}</h2>
      <div className="campaign-log-panel">
        {links === null ? (
          <div className="campaign-loading"><Spinner /></div>
        ) : links.length === 0 ? (
          <EmptyState>{t('cst.no_links_clicked')}</EmptyState>
        ) : (
          <table className="campaign-log-table">
            <thead><tr><th>{t('cst.col_url')}</th><th style={{ textAlign: 'right' }}>{t('cst.clicks')}</th><th>{t('cst.last_clicked')}</th></tr></thead>
            <tbody>
              {links.map((l) => (
                <tr key={l.url}>
                  <td><a href={l.url} target="_blank" rel="noreferrer" className="campaign-link-url">{l.url}</a></td>
                  <td style={{ textAlign: 'right' }}>{l.value}</td>
                  <td>{formatDateTime(l.last_clicked)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div style={{ textAlign: 'right', marginTop: 16 }}>
        <button type="button" className="btn-secondary" onClick={() => navigate(`/campaigns/${uid}/logs/clicks`)}>
          {t('cst.click_log')} <MaterialIcon>arrow_forward</MaterialIcon>
        </button>
      </div>
    </>
  );
};

// ── Subscribers tab: campaign list's subscribers with delivery stats (mirrors PHP) ──
const STATUS_LABEL = {
  subscribed: 'cst.status_subscribed', unsubscribed: 'cst.status_unsubscribed', unconfirmed: 'cst.status_unconfirmed',
  'spam-reported': 'cst.status_spam_reported', blacklisted: 'cst.status_blacklisted',
};

const CopyMoveModal = ({ mode, subscriber, sourceListUid, onClose, onDone }) => {
  const { t } = useTranslation();
  const [lists, setLists] = useState([]);
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    listsApi.list({ page: 1, per_page: 100 })
      .then(({ data }) => setLists((data.data || []).filter((l) => l.uid !== sourceListUid)))
      .catch(() => setLists([]));
  }, [sourceListUid]);
  const run = async () => {
    if (!target) return;
    setBusy(true);
    try {
      const fn = mode === 'copy' ? subscribersApi.bulkCopy : subscribersApi.bulkMove;
      await fn({ uids: [subscriber.uid], target_list_uid: target });
      toast.success(mode === 'copy' ? t('cst.copied') : t('cst.moved'));
      onDone();
    } catch (err) { toast.error(err.response?.data?.message || t('cst.failed')); } finally { setBusy(false); }
  };
  return (
    <div className="sending-modal-backdrop" onClick={onClose}>
      <div className="sending-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sending-modal-head"><h3>{mode === 'copy' ? t('cst.copy_to_list') : t('cst.move_to_list')}</h3><button type="button" onClick={onClose}>✕</button></div>
        <label className="sending-modal-field"><span>{t('cst.target_list')}</span>
          <select value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">{t('cst.select_a_list')}</option>
            {lists.map((l) => <option key={l.uid} value={l.uid}>{l.name}</option>)}
          </select>
        </label>
        <div className="sending-modal-actions">
          <button type="button" className="btn-primary" onClick={run} disabled={!target || busy}>{busy ? t('cst.working') : (mode === 'copy' ? t('cst.copy') : t('cst.move'))}</button>
          <button type="button" className="btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
        </div>
      </div>
    </div>
  );
};

const SubRow = ({ sub, columns, onAction }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false), open);
  return (
    <div className="csub-row">
      <input type="checkbox" className="csub-check" checked={sub._sel || false} onChange={() => onAction('toggle', sub)} />
      <div className="csub-main">
        <div>
          <button type="button" className="csub-email" onClick={() => onAction('edit', sub)}>{sub.email}</button>
          <span className={`csub-badge csub-${sub.status || 'subscribed'}`}>{STATUS_LABEL[sub.status] ? t(STATUS_LABEL[sub.status]) : (sub.status || 'subscribed').toUpperCase()}</span>
        </div>
        <span className="csub-badge csub-new">{(sub.delivery_status || 'NEW').toUpperCase()}</span>
      </div>
      {columns.created_at && <div className="csub-cell"><strong>{formatDateTime(sub.created_at) || '--'}</strong><span>{t('cst.col_created_at')}</span></div>}
      {columns.updated_at && <div className="csub-cell"><strong>{formatDateTime(sub.updated_at) || '--'}</strong><span>{t('cst.updated_at')}</span></div>}
      <div className="csub-cell"><strong>{sub.last_open ? formatDateTime(sub.last_open) : '--'}</strong><span>{t('cst.last_open')}</span></div>
      <div className="csub-cell"><strong>{sub.last_click ? formatDateTime(sub.last_click) : '--'}</strong><span>{t('cst.last_click')}</span></div>
      <div className="csub-actions">
        <button type="button" className="btn-secondary admin-icon-btn" title={t('common.edit')} onClick={() => onAction('edit', sub)}><MaterialIcon>edit</MaterialIcon></button>
        <div ref={ref} className="admin-dd">
          <button type="button" className="btn-secondary admin-icon-btn" onClick={() => setOpen((v) => !v)} aria-label={t('cst.more')}><span className="admin-caret">⌄</span></button>
          {open && (
            <div className="admin-dd-menu admin-dd-menu-end">
              <button type="button" onClick={() => { setOpen(false); onAction('subscribe', sub); }}><MaterialIcon>mark_email_read</MaterialIcon> {t('cst.subscribe')}</button>
              <button type="button" onClick={() => { setOpen(false); onAction('unsubscribe', sub); }}><MaterialIcon>logout</MaterialIcon> {t('cst.unsubscribe')}</button>
              <button type="button" onClick={() => { setOpen(false); onAction('copy', sub); }}><MaterialIcon>copy_all</MaterialIcon> {t('cst.copy_to')}</button>
              <button type="button" onClick={() => { setOpen(false); onAction('move', sub); }}><MaterialIcon>exit_to_app</MaterialIcon> {t('cst.move_to')}</button>
              <button type="button" onClick={() => { setOpen(false); onAction('confirm', sub); }}><MaterialIcon>mark_email_read</MaterialIcon> {t('cst.send_confirmation_email')}</button>
              <button type="button" onClick={() => { setOpen(false); onAction('delete', sub); }}><MaterialIcon>delete_outline</MaterialIcon> {t('common.delete')}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const SubscribersView = ({ uid, campaign }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const listUid = campaign?.mailList?.uid;
  const [stats, setStats] = useState(null);
  const [subs, setSubs] = useState(null);
  const [keyword, setKeyword] = useState('');
  const [openF, setOpenF] = useState('');
  const [clickF, setClickF] = useState('');
  const [trackF, setTrackF] = useState('');
  const [columns, setColumns] = useState({ created_at: true, updated_at: true });
  const [colOpen, setColOpen] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [copyMove, setCopyMove] = useState(null);
  const colRef = useRef(null);
  useClickOutside(colRef, () => setColOpen(false), colOpen);

  useEffect(() => { analyticsApi.campaign(uid).then(({ data }) => setStats(data)).catch(() => setStats(null)); }, [uid]);

  const fetchSubs = () => {
    if (!listUid) { setSubs([]); return; }
    subscribersApi.list({ list_uid: listUid, keyword, campaign_uid: uid, open: openF, click: clickF, tracking_status: trackF, page: 1, per_page: 50 })
      .then(({ data }) => setSubs(data.data || []))
      .catch(() => setSubs([]));
  };
  useEffect(() => { const t = setTimeout(fetchSubs, 300); return () => clearTimeout(t);   }, [listUid, keyword, openF, clickF, trackF]);

  const listTotal = stats?.listTotal ?? 0;
  const listActive = stats?.listActive ?? 0;
  const totalSent = stats?.totalSent ?? 0;
  const failed = stats?.failed ?? 0;
  const notSend = Math.max(0, listTotal - totalSent - failed);
  const pct = (n) => (listTotal ? Number(((n / listTotal) * 100).toFixed(2)) : 0);
  const nf = (n) => Number(n || 0).toLocaleString();

  const rows = useMemo(() => (subs || []).map((s) => ({ ...s, _sel: selected.has(s.uid) })), [subs, selected]);

  const handleAction = async (action, sub) => {
    try {
      if (action === 'toggle') { setSelected((p) => { const n = new Set(p); if (n.has(sub.uid)) n.delete(sub.uid); else n.add(sub.uid); return n; }); return; }
      if (action === 'edit') { navigate('/lists/contacts'); return; }
      if (action === 'copy' || action === 'move') { setCopyMove({ mode: action, subscriber: sub }); return; }
      if (action === 'subscribe') await subscribersApi.bulkStatus({ uids: [sub.uid], status: 'subscribed' });
      else if (action === 'unsubscribe') await subscribersApi.bulkStatus({ uids: [sub.uid], status: 'unsubscribed' });
      else if (action === 'confirm') { await subscribersApi.bulkSendConfirmation({ uids: [sub.uid], list_uid: listUid }); toast.success(t('cst.confirmation_sent')); }
      else if (action === 'delete') { if (!window.confirm(t('cst.delete_confirm', { email: sub.email }))) return; await subscribersApi.delete(sub.uid); }
      fetchSubs();
    } catch (err) { toast.error(err.response?.data?.message || t('cst.action_failed')); }
  };

  const onSelectTool = (v) => {
    if (v === 'current' || v === 'all') setSelected(new Set((subs || []).map((s) => s.uid)));
    else setSelected(new Set());
  };

  return (
    <>
      <h2 className="campaign-log-title">{t('common.subscribers')}</h2>

      <div className="csub-stat-grid">
        <div className="csub-stat"><strong>{nf(listActive)} / {nf(listTotal)}</strong><span>{t('cst.active_subscribers')}</span></div>
        <div className="csub-stat"><strong>{pct(totalSent)}%</strong><span>{t('cst.unique_email_sent', { count: nf(totalSent) })}</span></div>
        <div className="csub-stat"><strong>{pct(failed)}%</strong><span>{t('cst.failed_delivery_attempt', { count: nf(failed) })}</span></div>
        <div className="csub-stat"><strong>{pct(notSend)}%</strong><span>{t('cst.do_not_send', { count: nf(notSend) })}</span></div>
      </div>

      <div className="csub-toolbar">
        <select className="input csub-ctl" value="" onChange={(e) => { onSelectTool(e.target.value); e.target.value = ''; }}>
          <option value="">{t('cst.select')}</option>
          <option value="current">{t('cst.current_page')}</option>
          <option value="all">{t('cst.all_items')}</option>
        </select>
        <div ref={colRef} className="admin-dd">
          <button type="button" className="btn-secondary csub-ctl" onClick={() => setColOpen((v) => !v)}>{t('cst.columns')} <span className="admin-caret">⌄</span></button>
          {colOpen && (
            <div className="admin-dd-menu">
              <label className="csub-col-opt"><input type="checkbox" checked={columns.created_at} onChange={(e) => setColumns((c) => ({ ...c, created_at: e.target.checked }))} /> {t('cst.col_created_at')}</label>
              <label className="csub-col-opt"><input type="checkbox" checked={columns.updated_at} onChange={(e) => setColumns((c) => ({ ...c, updated_at: e.target.checked }))} /> {t('cst.updated_at')}</label>
            </div>
          )}
        </div>
        <span className="csub-filter-label">{t('cst.subscribers_who')}</span>
        <select className="input csub-ctl" value={openF} onChange={(e) => setOpenF(e.target.value)}>
          <option value="">{t('cst.filter_open')}</option><option value="yes">{t('cst.opened')}</option><option value="no">{t('cst.not_opened')}</option>
        </select>
        <select className="input csub-ctl" value={clickF} onChange={(e) => setClickF(e.target.value)}>
          <option value="">{t('cst.filter_click')}</option><option value="clicked">{t('cst.clicked')}</option><option value="not_clicked">{t('cst.not_clicked')}</option>
        </select>
        <span className="csub-filter-label">{t('cst.tracking_status')}</span>
        <select className="input csub-ctl" value={trackF} onChange={(e) => setTrackF(e.target.value)}>
          <option value="">{t('cst.filter_all')}</option><option value="error">{t('cst.col_error')}</option><option value="sent">{t('camp.sent')}</option>
        </select>
        <div className="admin-filter-search csub-search"><input className="input" placeholder={t('cst.type_to_search')} value={keyword} onChange={(e) => setKeyword(e.target.value)} /><MaterialIcon>search</MaterialIcon></div>
      </div>

      {subs === null ? (
        <div className="campaign-loading"><Spinner /></div>
      ) : subs.length === 0 ? (
        <EmptyState>{t('cst.no_subscribers_yet')}</EmptyState>
      ) : (
        <div className="csub-list">
          {rows.map((s) => <SubRow key={s.uid || s.id} sub={s} columns={columns} onAction={handleAction} />)}
        </div>
      )}

      {copyMove && (
        <CopyMoveModal
          mode={copyMove.mode}
          subscriber={copyMove.subscriber}
          sourceListUid={listUid}
          onClose={() => setCopyMove(null)}
          onDone={() => { setCopyMove(null); fetchSubs(); }}
        />
      )}
    </>
  );
};

// ── Email review: render the campaign's HTML content ──
const ReviewView = ({ campaign }) => {
  const { t } = useTranslation();
  const html = campaign?.html;
  return (
    <>
      <h2 className="campaign-log-title">{t('cst.email_review')}</h2>
      <div className="campaign-review-frame">
        {html ? (
          <iframe title={t('cst.email_review')} srcDoc={html} className="campaign-review-iframe" />
        ) : campaign?.plain ? (
          <pre className="campaign-review-plain">{campaign.plain}</pre>
        ) : (
          <EmptyState>{t('cst.no_content_preview')}</EmptyState>
        )}
      </div>
    </>
  );
};

const VIEW_TO_ACTIVE = {
  links: 'links',
  subscribers: 'subscribers',
  review: 'template',
};

// Renders one of the campaign detail sub-views (Links / Open map / Subscribers / Email review).
const CampaignSubviewPage = ({ view }) => {
  const { uid } = useParams();
  const [campaign, setCampaign] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    campaignsApi.get(uid)
      .then(({ data }) => setCampaign(data))
      .catch(() => setCampaign(null))
      .finally(() => setLoaded(true));
  }, [uid]);

  return (
    <AppLayout>
      <div className="campaigns-page campaign-detail-page">
        <CampaignHeader campaign={campaign} />
        <CampaignTabs uid={uid} active={VIEW_TO_ACTIVE[view] || 'overview'} />

        {!loaded ? (
          <div className="campaign-loading"><Spinner size="lg" /></div>
        ) : (
          <>
            {view === 'links' && <LinksView uid={uid} />}
            {view === 'subscribers' && <SubscribersView uid={uid} campaign={campaign} />}
            {view === 'review' && <ReviewView campaign={campaign} />}
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default CampaignSubviewPage;
