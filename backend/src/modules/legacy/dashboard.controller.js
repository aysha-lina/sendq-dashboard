const prisma = require('../../config/database.config');
const { labelForEvent } = require('../../utils/event-log');

const parseQuota = (customer) => {
  try {
    return customer?.quota ? JSON.parse(customer.quota) : {};
  } catch {
    return {};
  }
};

const safe = async (fn, fallback = 0) => {
  try { return await fn(); } catch { return fallback; }
};

// Distinct-subscriber count for a log model (unique opens / clicks).
const uniqueCount = async (model, campaignId) => safe(async () => {
  const rows = await model.groupBy({ by: ['subscriber_id'], where: { campaign_id: campaignId } });
  return rows.length;
});

// Enrich a campaign with the metrics the dashboard report block renders.
const withCampaignMetrics = async (campaign) => {
  const cid = campaign.id;
  const [
    delivered, totalOpens, uniqueOpens, totalClicks, uniqueClicks,
    bounces, unsubscribes, feedback, listSubscribers, lastOpen, lastClick,
  ] = await Promise.all([
    safe(() => prisma.emailLog.count({ where: { campaign_id: cid, status: 'sent' } })),
    safe(() => prisma.openLog.count({ where: { campaign_id: cid } })),
    uniqueCount(prisma.openLog, cid),
    safe(() => prisma.clickLog.count({ where: { campaign_id: cid } })),
    uniqueCount(prisma.clickLog, cid),
    safe(() => prisma.bounceLog.count({ where: { campaign_id: cid } })),
    safe(() => prisma.unsubscribeLog.count({ where: { campaign_id: cid } })),
    safe(() => prisma.feedbackLog.count({ where: { campaign_id: cid } })),
    campaign.mail_list_id
      ? safe(() => prisma.subscriber.count({ where: { mail_list_id: campaign.mail_list_id } }))
      : Promise.resolve(0),
    safe(() => prisma.openLog.findFirst({ where: { campaign_id: cid }, orderBy: { created_at: 'desc' }, select: { created_at: true } }), null),
    safe(() => prisma.clickLog.findFirst({ where: { campaign_id: cid }, orderBy: { created_at: 'desc' }, select: { created_at: true } }), null),
  ]);

  const recipients = campaign.real_sent_count || delivered || listSubscribers;
  return {
    ...campaign,
    from: campaign.from_email ? `${campaign.from_name || ''} <${campaign.from_email}>`.trim() : campaign.from_name,
    subscriber_count: recipients,
    delivered_count: delivered,
    total_open_count: totalOpens,
    unique_open_count: uniqueOpens,
    total_click_count: totalClicks,
    unique_click_count: uniqueClicks,
    bounce_count: bounces,
    unsubscribe_count: unsubscribes,
    feedback_count: feedback,
    last_opened_at: lastOpen?.created_at || null,
    last_clicked_at: lastClick?.created_at || null,
  };
};

// 6-month subscriber growth for a list + current subscriber total.
const withListGrowth = async (list) => {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);

  const [subscriber_count, recent] = await Promise.all([
    safe(() => prisma.subscriber.count({ where: { mail_list_id: list.id } })),
    safe(() => prisma.subscriber.findMany({
      where: { mail_list_id: list.id, created_at: { gte: sixMonthsAgo } },
      select: { created_at: true },
    }), []),
  ]);

  const monthCounts = {};
  recent.forEach(({ created_at }) => {
    const d = new Date(created_at);
    const key = `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    monthCounts[key] = (monthCounts[key] || 0) + 1;
  });
  const growth_data = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    const key = `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    return { label: key, subscribers: monthCounts[key] || 0 };
  });

  return { ...list, subscriber_count, growth_data };
};

exports.getDashboard = async (req, res) => {
  if (!req.customer) {
    return res.status(404).json({ message: 'Customer profile not found.' });
  }

  const [campaignsCount, listsCount, recentCampaignsRaw, recentListsRaw, statusRows, activityRows, eventRows] = await Promise.all([
    prisma.campaign.count({ where: { customer_id: req.customer.id } }),
    prisma.mailList.count({ where: { customer_id: req.customer.id } }),
    prisma.campaign.findMany({
      where: { customer_id: req.customer.id },
      orderBy: { created_at: 'desc' },
      take: 5,
      select: {
        id: true, uid: true, name: true, subject: true, status: true, type: true,
        mail_list_id: true, real_sent_count: true, from_name: true, from_email: true,
        run_at: true, delivery_at: true, created_at: true,
      },
    }),
    prisma.mailList.findMany({
      where: { customer_id: req.customer.id },
      orderBy: { created_at: 'desc' },
      take: 5,
      select: { id: true, uid: true, name: true, from_email: true, status: true, created_at: true },
    }),
    prisma.campaign.groupBy({
      by: ['status'],
      where: { customer_id: req.customer.id },
      _count: { id: true },
    }),
    // Fallback activity feed — latest campaigns / lists / subscribers, merged + sorted.
    Promise.all([
      safe(() => prisma.campaign.findMany({ where: { customer_id: req.customer.id }, select: { name: true, status: true, updated_at: true, created_at: true }, orderBy: { updated_at: 'desc' }, take: 8 }), []),
      safe(() => prisma.mailList.findMany({ where: { customer_id: req.customer.id }, select: { name: true, updated_at: true, created_at: true }, orderBy: { updated_at: 'desc' }, take: 8 }), []),
      safe(() => prisma.subscriber.findMany({ where: { customer_id: req.customer.id }, select: { email: true, status: true, updated_at: true, created_at: true }, orderBy: { updated_at: 'desc' }, take: 8 }), []),
    ]),
    // Real append-only event log (AuditLog / sendq_logs) — preferred when present.
    safe(() => prisma.auditLog.findMany({ where: { customer_id: req.customer.id }, orderBy: { created_at: 'desc' }, take: 20 }), []),
  ]);

  let activity_logs;
  if (eventRows.length) {
    // True event stream: each row is a real event captured when it happened.
    activity_logs = eventRows.map((e) => ({ actor: e.name || 'System', message: labelForEvent(e.type), created_at: e.created_at }));
  } else {
    // No events logged yet (e.g. existing account) → derive from recent records.
    const [actCampaigns, actLists, actSubscribers] = activityRows;
    activity_logs = [
      ...actCampaigns.map((c) => ({ actor: c.name || 'Campaign', message: `Campaign status: ${c.status}`, created_at: c.updated_at || c.created_at })),
      ...actLists.map((l) => ({ actor: l.name || 'List', message: 'List updated', created_at: l.updated_at || l.created_at })),
      ...actSubscribers.map((s) => ({ actor: s.email, message: `Subscriber ${s.status}`, created_at: s.updated_at || s.created_at })),
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 20);
  }

  const [recent_campaigns, recent_lists] = await Promise.all([
    Promise.all(recentCampaignsRaw.map(withCampaignMetrics)),
    Promise.all(recentListsRaw.map(withListGrowth)),
  ]);

  const totalSubscribers = recent_lists.reduce((sum, l) => sum + (l.subscriber_count || 0), 0);

  const quota = parseQuota(req.customer);
  const maxLists = quota.list_max ?? -1;
  const maxCampaigns = quota.campaign_max ?? -1;
  const maxSubscribers = quota.subscriber_max ?? -1;

  res.json({
    quota: {
      lists: {
        used: listsCount,
        max: maxLists,
        percent: maxLists === -1 ? 0 : Math.round((listsCount / maxLists) * 100),
        label: `${listsCount}/${maxLists === -1 ? 'unlimited' : maxLists}`,
      },
      campaigns: {
        used: campaignsCount,
        max: maxCampaigns,
        percent: maxCampaigns === -1 ? 0 : Math.round((campaignsCount / maxCampaigns) * 100),
        label: `${campaignsCount}/${maxCampaigns === -1 ? 'unlimited' : maxCampaigns}`,
      },
      subscribers: {
        used: totalSubscribers,
        max: maxSubscribers,
        percent: maxSubscribers === -1 ? 0 : Math.round((totalSubscribers / maxSubscribers) * 100),
        label: `${totalSubscribers}/${maxSubscribers === -1 ? 'unlimited' : maxSubscribers}`,
      },
    },
    stats: {
      total_campaigns: campaignsCount,
      total_lists: listsCount,
      total_subscribers: totalSubscribers,
      status_breakdown: statusRows.map((row) => ({ status: row.status, count: row._count.id })),
    },
    recent_campaigns,
    recent_lists,
    activity_logs,
  });
};
