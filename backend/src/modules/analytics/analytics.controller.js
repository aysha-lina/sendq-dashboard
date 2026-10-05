const prisma = require('../../config/database.config');

const safeCount = async (promise) => {
  try {
    return await promise;
  } catch (err) {
    if (err?.code === 'P2021') return 0;
    throw err;
  }
};

const rates = ({ totalSent, opens, clicks, bounces }) => ({
  totalSent,
  opens,
  clicks,
  bounces,
  bounceRate: totalSent ? Number(((bounces / totalSent) * 100).toFixed(2)) : 0,
  openRate: totalSent ? Number(((opens / totalSent) * 100).toFixed(2)) : 0,
  clickRate: totalSent ? Number(((clicks / totalSent) * 100).toFixed(2)) : 0,
});

exports.dashboard = async (req, res) => {
  const customerId = req.customer.id;

  const recentCampaigns = await prisma.campaign.findMany({
    where: { customer_id: customerId, status: { in: ['done', 'sending', 'paused'] } },
    orderBy: { updated_at: 'desc' },
    take: 10,
    select: { id: true, uid: true, name: true, subject: true, status: true, run_at: true, delivery_at: true },
  });

  const campaignIds = recentCampaigns.map((c) => c.id);
  const allCampaignIds = (await prisma.campaign.findMany({
    where: { customer_id: customerId },
    select: { id: true },
  })).map((c) => c.id);

  const [totalSent, opens, clicks, bounces, totalCampaigns, totalSubscribers, ...perCampaignCounts] = await Promise.all([
    safeCount(prisma.emailLog.count({ where: { customer_id: customerId, status: 'sent' } })),
    safeCount(prisma.openLog.count({ where: { campaign_id: { in: allCampaignIds } } })),
    safeCount(prisma.clickLog.count({ where: { campaign_id: { in: allCampaignIds } } })),
    safeCount(prisma.bounceLog.count({ where: { campaign_id: { in: allCampaignIds } } })),
    safeCount(prisma.campaign.count({ where: { customer_id: customerId } })),
    safeCount(prisma.subscriber.count({ where: { customer_id: customerId } })),
    ...campaignIds.flatMap((id) => [
      safeCount(prisma.emailLog.count({ where: { campaign_id: id, status: 'sent' } })),
      safeCount(prisma.openLog.count({ where: { campaign_id: id } })),
      safeCount(prisma.clickLog.count({ where: { campaign_id: id } })),
      safeCount(prisma.bounceLog.count({ where: { campaign_id: id } })),
    ]),
  ]);

  const campaigns = recentCampaigns.map((campaign, i) => {
    const base = 6 + i * 4;
    const sent = perCampaignCounts[base] ?? 0;
    const campaignOpens = perCampaignCounts[base + 1] ?? 0;
    const campaignClicks = perCampaignCounts[base + 2] ?? 0;
    const campaignBounces = perCampaignCounts[base + 3] ?? 0;
    return {
      ...campaign,
      totalSent: sent,
      opens: campaignOpens,
      clicks: campaignClicks,
      bounces: campaignBounces,
      openRate: sent ? Number(((campaignOpens / sent) * 100).toFixed(2)) : 0,
      clickRate: sent ? Number(((campaignClicks / sent) * 100).toFixed(2)) : 0,
    };
  });

  res.json({
    ...rates({ totalSent, opens, clicks, bounces }),
    totalCampaigns,
    totalSubscribers,
    campaigns,
  });
};

exports.campaign = async (req, res) => {
  const campaign = await prisma.campaign.findFirst({
    where: { OR: [{ uid: req.params.id }, { id: Number(req.params.id) || 0 }], customer_id: req.customer.id },
    include: { mailList: { select: { uid: true, name: true } } },
  });
  if (!campaign) return res.status(404).json({ message: 'Campaign not found.' });

  const [totalSent, opens, clicks, bounces, unsubscribed, feedback, failed, listTotal, listActive] = await Promise.all([
    safeCount(prisma.emailLog.count({ where: { campaign_id: campaign.id, status: 'sent' } })),
    safeCount(prisma.openLog.count({ where: { campaign_id: campaign.id } })),
    safeCount(prisma.clickLog.count({ where: { campaign_id: campaign.id } })),
    safeCount(prisma.bounceLog.count({ where: { campaign_id: campaign.id } })),
    safeCount(prisma.unsubscribeLog.count({ where: { campaign_id: campaign.id } })),
    safeCount(prisma.feedbackLog.count({ where: { campaign_id: campaign.id } })),
    safeCount(prisma.emailLog.count({ where: { campaign_id: campaign.id, status: 'failed' } })),
    campaign.mail_list_id ? safeCount(prisma.subscriber.count({ where: { mail_list_id: campaign.mail_list_id } })) : 0,
    campaign.mail_list_id ? safeCount(prisma.subscriber.count({ where: { mail_list_id: campaign.mail_list_id, status: 'subscribed' } })) : 0,
  ]);

  res.json({ campaign, ...rates({ totalSent, opens, clicks, bounces }), unsubscribed, feedback, failed, listTotal, listActive });
};

// Resolve a campaign by uid or numeric id, scoped to the customer.
const findCampaign = (req) => prisma.campaign.findFirst({
  where: { OR: [{ uid: req.params.id }, { id: Number(req.params.id) || 0 }], customer_id: req.customer.id },
});

const deviceFromUA = (ua = '') => {
  const s = String(ua).toLowerCase();
  if (!s) return 'Unknown';
  if (/ipad|tablet/.test(s)) return 'Tablet';
  if (/mobi|android|iphone|ipod/.test(s)) return 'Mobile';
  return 'Desktop';
};

const emailClientFromUA = (ua = '') => {
  const s = String(ua).toLowerCase();
  if (!s) return 'Unknown';
  if (/googleimageproxy|gmail/.test(s)) return 'Gmail';
  if (/outlook|microsoft office|msoffice|ms-office|word\//.test(s)) return 'Outlook';
  if (/yahoo/.test(s)) return 'Yahoo Mail';
  if (/thunderbird/.test(s)) return 'Thunderbird';
  if (/(iphone|ipad|ipod).*mobile|apple mail|applemail/.test(s)) return 'Apple Mail';
  if (/edg\//.test(s)) return 'Edge';
  if (/chrome\//.test(s)) return 'Chrome / webmail';
  if (/firefox\//.test(s)) return 'Firefox / webmail';
  if (/safari\//.test(s)) return 'Safari / webmail';
  return 'Other';
};

const osFromUA = (ua = '') => {
  const s = String(ua).toLowerCase();
  if (!s) return 'Unknown';
  if (/windows/.test(s)) return 'Windows';
  if (/iphone|ipad|ipod|ios/.test(s)) return 'iOS';
  if (/mac os x|macintosh/.test(s)) return 'macOS';
  if (/android/.test(s)) return 'Android';
  if (/linux/.test(s)) return 'Linux';
  return 'Other';
};

// Tally a list into [{label,value}] sorted desc, capped.
const tally = (rows, fn, cap = 10) => {
  const counts = rows.reduce((acc, r) => {
    const k = fn(r);
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, cap);
};

// ─── GET /analytics/campaign/:id/logs/:type ─────────────────────────────────────
// type: tracking | opens | clicks | bounces | unsubscribes | feedback
exports.campaignLogs = async (req, res) => {
  const campaign = await findCampaign(req);
  if (!campaign) return res.status(404).json({ message: 'Campaign not found.' });

  const page = Math.max(Number(req.query.page) || 1, 1);
  const perPage = Math.min(Math.max(Number(req.query.per_page) || 25, 1), 100);
  const skip = (page - 1) * perPage;
  const subscriberInclude = { subscriber: { select: { uid: true, email: true } } };

  const sources = {
    tracking: { model: prisma.trackingLog, include: subscriberInclude },
    opens: { model: prisma.openLog, include: subscriberInclude },
    clicks: { model: prisma.clickLog, include: subscriberInclude },
    bounces: { model: prisma.bounceLog, include: subscriberInclude },
    unsubscribes: { model: prisma.unsubscribeLog, include: subscriberInclude },
    feedback: { model: prisma.feedbackLog, include: subscriberInclude },
  };
  const source = sources[req.params.type];
  if (!source) return res.status(400).json({ message: 'Unknown log type.' });

  const where = { campaign_id: campaign.id };
  const [total, data] = await Promise.all([
    safeCount(source.model.count({ where })),
    source.model.findMany({ where, include: source.include, orderBy: { created_at: 'desc' }, skip, take: perPage }),
  ]);

  res.json({
    data,
    pagination: { page, per_page: perPage, total, total_pages: Math.max(Math.ceil(total / perPage), 1) },
  });
};

// ─── GET /analytics/campaign/:id/logs/:type/export ──────────────────────────────
// Streams the full log (all rows) for a campaign as CSV.
exports.campaignLogsExport = async (req, res) => {
  const campaign = await findCampaign(req);
  if (!campaign) return res.status(404).json({ message: 'Campaign not found.' });

  const models = {
    tracking: prisma.trackingLog,
    opens: prisma.openLog,
    clicks: prisma.clickLog,
    bounces: prisma.bounceLog,
    unsubscribes: prisma.unsubscribeLog,
    feedback: prisma.feedbackLog,
  };
  const model = models[req.params.type];
  if (!model) return res.status(400).json({ message: 'Unknown log type.' });

  let rows = [];
  try {
    rows = await model.findMany({
      where: { campaign_id: campaign.id },
      include: { subscriber: { select: { email: true } } },
      orderBy: { created_at: 'desc' },
      take: 100000,
    });
  } catch (err) {
    if (err?.code !== 'P2021') throw err;
  }

  const cols = ['email', 'created_at', 'ip', 'user_agent', 'url', 'reason'];
  const esc = (v) => {
    if (v == null) return '';
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  const lines = [cols.join(',')];
  rows.forEach((r) => {
    lines.push(cols.map((c) => esc(c === 'email' ? r.subscriber?.email : r[c])).join(','));
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${req.params.type}-${campaign.uid}.csv"`);
  res.send(lines.join('\n'));
};

// ─── GET /analytics/campaign/:id/breakdown ──────────────────────────────────────
// Device split (from open logs), top clicked links, and a 24h open/click timeline.
exports.campaignBreakdown = async (req, res) => {
  const campaign = await findCampaign(req);
  if (!campaign) return res.status(404).json({ message: 'Campaign not found.' });

  let opens = [];
  let clicks = [];
  try {
    [opens, clicks] = await Promise.all([
      prisma.openLog.findMany({ where: { campaign_id: campaign.id }, select: { user_agent: true, created_at: true, ip: true, subscriber_id: true } }),
      prisma.clickLog.findMany({ where: { campaign_id: campaign.id }, select: { url: true, created_at: true, ip: true } }),
    ]);
  } catch (err) {
    if (err?.code !== 'P2021') throw err;
  }

  // Device / email-client / OS breakdown (from open-log user agents)
  const devices = tally(opens, (o) => deviceFromUA(o.user_agent));
  const emailClients = tally(opens, (o) => emailClientFromUA(o.user_agent));
  const os = tally(opens, (o) => osFromUA(o.user_agent));

  // Top clicked links (with last-clicked timestamp)
  const linkCounts = clicks.reduce((acc, c) => {
    if (!c.url) return acc;
    if (!acc[c.url]) acc[c.url] = { value: 0, last_clicked: null };
    acc[c.url].value += 1;
    const t = new Date(c.created_at).getTime();
    if (!acc[c.url].last_clicked || t > new Date(acc[c.url].last_clicked).getTime()) {
      acc[c.url].last_clicked = c.created_at;
    }
    return acc;
  }, {});
  const links = Object.entries(linkCounts)
    .map(([url, info]) => ({ url, value: info.value, last_clicked: info.last_clicked }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 50);

  // 24-hour timeline (last 24 hours, hourly buckets)
  const now = Date.now();
  const buckets = Array.from({ length: 24 }, (_, i) => {
    const hourStart = now - (23 - i) * 3600000;
    const d = new Date(hourStart);
    return { label: `${String(d.getHours()).padStart(2, '0')}:00`, from: hourStart, to: hourStart + 3600000, opens: 0, clicks: 0 };
  });
  const bucketize = (rows, key) => rows.forEach((r) => {
    const t = new Date(r.created_at).getTime();
    const b = buckets.find((bk) => t >= bk.from && t < bk.to);
    if (b) b[key] += 1;
  });
  bucketize(opens, 'opens');
  bucketize(clicks, 'clicks');
  const timeline = buckets.map(({ label, opens: o, clicks: c }) => ({ label, opens: o, clicks: c }));

  // Subscribers with the most opens (top 10)
  let topSubscribers = [];
  try {
    const openCounts = opens.reduce((acc, o) => {
      if (o.subscriber_id) acc[o.subscriber_id] = (acc[o.subscriber_id] || 0) + 1;
      return acc;
    }, {});
    const topIds = Object.entries(openCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
    if (topIds.length) {
      const subs = await prisma.subscriber.findMany({
        where: { id: { in: topIds.map(([id]) => Number(id)) } },
        select: { id: true, email: true },
      });
      const emailById = Object.fromEntries(subs.map((s) => [s.id, s.email]));
      topSubscribers = topIds.map(([id, value]) => ({ label: emailById[id] || `#${id}`, value }));
    }
  } catch { /* optional */ }

  res.json({ devices, emailClients, os, links, timeline, topSubscribers });
};

// ─── GET /analytics/audience ────────────────────────────────────────────────
// Audience overview: totals + a 16-month growth series (new vs unsubscribed).
exports.audience = async (req, res) => {
  const cid = req.customer.id;
  const [subscribers_total, active_total, forms_total, blacklisted_total] = await Promise.all([
    safeCount(prisma.subscriber.count({ where: { customer_id: cid } })),
    safeCount(prisma.subscriber.count({ where: { customer_id: cid, status: 'subscribed' } })),
    safeCount(prisma.listForm.count({ where: { mailList: { customer_id: cid } } })),
    safeCount(prisma.blacklist.count({ where: { customer_id: cid } })),
  ]);

  const base = new Date();
  const months = [];
  for (let i = 15; i >= 0; i--) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    months.push({
      ym: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleString('en', { month: 'short', year: '2-digit' }),
      subscribed: 0,
      unsubscribed: 0,
    });
  }
  const sinceStr = `${months[0].ym}-01`;
  try {
    const [subRows, unsubRows] = await Promise.all([
      prisma.$queryRawUnsafe(
        "SELECT DATE_FORMAT(created_at,'%Y-%m') ym, COUNT(*) c FROM sendq_subscribers WHERE customer_id=? AND created_at>=? GROUP BY ym",
        cid, sinceStr),
      prisma.$queryRawUnsafe(
        "SELECT DATE_FORMAT(created_at,'%Y-%m') ym, COUNT(*) c FROM sendq_unsubscribe_logs WHERE customer_id=? AND created_at>=? GROUP BY ym",
        cid, sinceStr),
    ]);
    const idx = Object.fromEntries(months.map((m, i) => [m.ym, i]));
    subRows.forEach((r) => { const i = idx[r.ym]; if (i !== undefined) months[i].subscribed = Number(r.c); });
    unsubRows.forEach((r) => { const i = idx[r.ym]; if (i !== undefined) months[i].unsubscribed = Number(r.c); });
  } catch { /* growth optional */ }

  res.json({
    subscribers_total,
    active_total,
    forms_total,
    blacklisted_total,
    active_percent: subscribers_total ? Math.round((active_total / subscribers_total) * 100) : 0,
    growth: months.map(({ label, subscribed, unsubscribed }) => ({ label, subscribed, unsubscribed })),
  });
};
