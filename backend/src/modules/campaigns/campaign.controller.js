const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const prisma = require('../../config/database.config');
const { campaignQueue } = require('../../queues/index');
const { getConnection } = require('../../queues/connection');
const { dispatchCampaignEmail } = require('../email-engine/mail.dispatcher');
const { sendCampaign, readCampaignOptions } = require('./campaign.sender');
const { analyzeSpam } = require('./spam-score');
const { normalizeAbConfig } = require('./ab-test.service');

// Merge a patch into a campaign's additive `options` JSON (raw SQL — the column isn't in
// the Prisma client). Reuses readCampaignOptions so targets/resend flags are preserved.
const mergeCampaignOptions = async (campaignId, patch) => {
  const current = await readCampaignOptions(campaignId);
  const next = { ...current, ...patch };
  await prisma.$executeRawUnsafe('UPDATE sendq_campaigns SET options = ? WHERE id = ?', JSON.stringify(next), campaignId);
  return next;
};

// Persist campaign "extras" (custom headers + delivery webhooks) into options JSON.
const saveCampaignExtras = async (campaignId, bodyData) => {
  const patch = {};
  if (Array.isArray(bodyData.custom_headers)) {
    patch.custom_headers = bodyData.custom_headers
      .filter((h) => h && h.name)
      .map((h) => ({ name: String(h.name).slice(0, 200), value: String(h.value ?? '').slice(0, 1000) }))
      .slice(0, 25);
  }
  if (Array.isArray(bodyData.webhooks)) {
    patch.webhooks = bodyData.webhooks
      .filter((wh) => wh && wh.url)
      .map((wh) => ({ url: String(wh.url).slice(0, 500), events: Array.isArray(wh.events) ? wh.events : ['sent'] }))
      .slice(0, 10);
  }
  if (Object.keys(patch).length) await mergeCampaignOptions(campaignId, patch);
};

// Quick Redis reachability probe so we can fall back to sending inline when the
// background queue/worker isn't available (otherwise campaigns sit "queued" forever).
const redisReachable = async () => {
  try {
    const pong = await Promise.race([
      getConnection().ping(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('redis-timeout')), 1500)),
    ]);
    return pong === 'PONG';
  } catch {
    return false;
  }
};

// ─── Spam score check (works on unsaved content from the wizard) ─────────────────
exports.spamScore = async (req, res) => {
  const { subject, html, plain } = req.body;
  res.json(analyzeSpam({ subject, html, plain }));
};

const campaignSelect = {
  uid: true,
  name: true,
  type: true,
  subject: true,
  from_email: true,
  from_name: true,
  reply_to: true,
  status: true,
  track_open: true,
  track_click: true,
  delivery_at: true,
  run_at: true,
  scheduled_at: true,
  created_at: true,
  updated_at: true,
};

exports.index = async (req, res) => {
  const page = Number(req.query.page || 1);
  const perPage = Number(req.query.per_page || 10);
  const keyword = req.query.keyword || '';
  const status = req.query.status || '';
  const where = {
    customer_id: req.customer.id,
    // Archived campaigns are hidden from the default list; selecting the
    // "Archived" status filter surfaces them (matches PHP archive behaviour).
    ...(status ? { status } : { status: { not: 'archived' } }),
    ...(keyword ? {
      OR: [
        { name: { contains: keyword } },
        { subject: { contains: keyword } },
      ],
    } : {}),
  };

  const [total, campaigns] = await Promise.all([
    prisma.campaign.count({ where }),
    prisma.campaign.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: perPage,
      skip: (page - 1) * perPage,
      select: campaignSelect,
    }),
  ]);

  res.json({
    data: campaigns,
    pagination: {
      total,
      per_page: perPage,
      current_page: page,
      total_pages: Math.ceil(total / perPage),
    },
  });
};

exports.show = async (req, res) => {
  const campaign = await prisma.campaign.findFirst({
    where: { uid: req.params.uid || req.params.id, customer_id: req.customer.id },
    include: { mailList: { select: { uid: true, name: true } } },
  });
  if (!campaign) return res.status(404).json({ message: 'Campaign not found.' });
  // Surface the additive `options` JSON (ab_test, targets) — not in the Prisma client.
  const options = await readCampaignOptions(campaign.id);
  res.json({ ...campaign, ab_test: options.ab_test || null, options });
};

exports.store = [
  // Draft-friendly: the wizard creates an "Untitled" campaign after the Recipients
  // step, then fills subject/from in the Setup step. Only validate when provided.
  body('from_email').optional({ checkFalsy: true }).isEmail().withMessage('Valid from email is required'),
  body('reply_to').optional({ checkFalsy: true }).isEmail().withMessage('Valid reply-to email required'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const {
      name, subject, from_email, from_name, reply_to,
      type = 'regular', html, plain, preheader,
      track_open = true, track_click = true,
      sign_dkim = false, run_at,
      mail_list_id, segment_id,
    } = req.body;

    const campaign = await prisma.campaign.create({
      data: {
        uid: uuidv4(),
        customer_id: req.customer.id,
        name: name && name.trim() ? name.trim() : 'Untitled',
        subject: subject || '',
        from_email: from_email || '',
        from_name: from_name || '',
        reply_to: reply_to || null,
        mail_list_id: mail_list_id ? Number(mail_list_id) : null,
        segment_id: segment_id ? Number(segment_id) : null,
        type,
        html,
        plain,
        preheader,
        track_open,
        track_click,
        sign_dkim,
        status: 'new',
        run_at: run_at ? new Date(run_at) : null,
        custom_order: 0,
        resend: 0,
      },
    });

    // A/B config (subject/content variants) lives in the additive options JSON.
    if (req.body.ab_test !== undefined) {
      const ab = normalizeAbConfig(req.body.ab_test);
      if (ab) await mergeCampaignOptions(campaign.id, { ab_test: ab });
    }
    await saveCampaignExtras(campaign.id, req.body);
    require('../../utils/event-log').logEvent({ customerId: req.customer.id, type: 'campaign.created', name: campaign.name });

    res.status(201).json(campaign);
  },
];

exports.update = [
  body('from_email').optional().isEmail().withMessage('Valid from email required'),
  body('reply_to').optional().isEmail().withMessage('Valid reply-to email required'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const campaign = await prisma.campaign.findFirst({
      where: { uid: req.params.uid || req.params.id, customer_id: req.customer.id },
    });
    if (!campaign) return res.status(404).json({ message: 'Campaign not found.' });
    if (campaign.status === 'sending') {
      return res.status(422).json({ message: 'Cannot edit a campaign that is currently sending.' });
    }

    const allowedFields = [
      'name', 'subject', 'from_email', 'from_name', 'reply_to',
      'html', 'plain', 'type', 'track_open', 'track_click',
      'sign_dkim', 'run_at', 'scheduled_at', 'preheader',
      'mail_list_id', 'segment_id',
    ];
    const dateFields = new Set(['run_at', 'scheduled_at']);
    const data = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        data[field] = dateFields.has(field) && req.body[field] ? new Date(req.body[field]) : req.body[field];
      }
    });

    const updated = await prisma.campaign.update({ where: { id: campaign.id }, data });

    // A/B config: enabling stores the normalised config; explicit null/disabled clears it.
    if (req.body.ab_test !== undefined) {
      const ab = normalizeAbConfig(req.body.ab_test);
      await mergeCampaignOptions(campaign.id, { ab_test: ab || undefined });
    }
    await saveCampaignExtras(campaign.id, req.body);

    res.json(updated);
  },
];

exports.destroy = async (req, res) => {
  const campaign = await prisma.campaign.findFirst({
    where: { uid: req.params.uid || req.params.id, customer_id: req.customer.id },
  });
  if (!campaign) return res.status(404).json({ message: 'Campaign not found.' });
  await prisma.campaign.delete({ where: { id: campaign.id } });
  res.json({ message: 'Campaign deleted successfully.' });
};

// ─── GET /campaigns/:uid/preview?subscriber_uid= ────────────────────────────
// Renders the campaign HTML as a given (or sample) subscriber would see it.
exports.preview = async (req, res) => {
  const campaign = await prisma.campaign.findFirst({
    where: { uid: req.params.uid || req.params.id, customer_id: req.customer.id },
  });
  if (!campaign) return res.status(404).json({ message: 'Campaign not found.' });

  let subscriber = req.query.subscriber_uid
    ? await prisma.subscriber.findFirst({ where: { uid: String(req.query.subscriber_uid), customer_id: req.customer.id } })
    : null;
  if (!subscriber) {
    subscriber = await prisma.subscriber.findFirst({
      where: { customer_id: req.customer.id, ...(campaign.mail_list_id ? { mail_list_id: campaign.mail_list_id } : {}) },
    });
  }
  const s = subscriber || { first_name: 'John', last_name: 'Doe', email: 'preview@example.com' };
  const { mergeTags } = require('../tracking/tracking.controller');
  res.json({
    html: mergeTags(campaign.html, s, { unsub: '#', prefs: '#' }),
    subject: campaign.subject,
    subscriber: { email: s.email, first_name: s.first_name, last_name: s.last_name },
  });
};

// ─── Campaign attachments (stored in options JSON, files under /uploads) ─────
exports.listAttachments = async (req, res) => {
  const campaign = await prisma.campaign.findFirst({ where: { uid: req.params.uid, customer_id: req.customer.id } });
  if (!campaign) return res.status(404).json({ message: 'Campaign not found.' });
  const options = await readCampaignOptions(campaign.id);
  res.json({ attachments: Array.isArray(options.attachments) ? options.attachments : [] });
};

exports.uploadAttachment = async (req, res) => {
  const campaign = await prisma.campaign.findFirst({ where: { uid: req.params.uid, customer_id: req.customer.id } });
  if (!campaign) return res.status(404).json({ message: 'Campaign not found.' });
  if (!req.file) return res.status(422).json({ message: 'No file uploaded.' });
  const options = await readCampaignOptions(campaign.id);
  const attachments = Array.isArray(options.attachments) ? options.attachments : [];
  const entry = {
    id: uuidv4(),
    filename: req.file.originalname,
    path: `/uploads/attachments/${req.file.filename}`,
    size: req.file.size,
  };
  attachments.push(entry);
  await mergeCampaignOptions(campaign.id, { attachments });
  res.status(201).json({ attachment: entry, attachments });
};

exports.removeAttachment = async (req, res) => {
  const campaign = await prisma.campaign.findFirst({ where: { uid: req.params.uid, customer_id: req.customer.id } });
  if (!campaign) return res.status(404).json({ message: 'Campaign not found.' });
  const options = await readCampaignOptions(campaign.id);
  const attachments = (Array.isArray(options.attachments) ? options.attachments : []).filter((a) => a.id !== req.params.attId);
  await mergeCampaignOptions(campaign.id, { attachments });
  res.json({ attachments });
};

// Duplicate a campaign (content + settings) into a fresh "new" draft — mirrors PHP Campaign::copy().
exports.copy = async (req, res) => {
  const src = await prisma.campaign.findFirst({
    where: { uid: req.params.uid || req.params.id, customer_id: req.customer.id },
  });
  if (!src) return res.status(404).json({ message: 'Campaign not found.' });
  const name = (req.body && req.body.name && String(req.body.name).trim()) || `Copy of ${src.name}`;
  const copy = await prisma.campaign.create({
    data: {
      uid: uuidv4(),
      customer_id: src.customer_id,
      mail_list_id: src.mail_list_id,
      segment_id: src.segment_id,
      template_id: src.template_id,
      type: src.type,
      name,
      subject: src.subject,
      preheader: src.preheader,
      html: src.html,
      plain: src.plain,
      from_email: src.from_email,
      from_name: src.from_name,
      reply_to: src.reply_to,
      sign_dkim: src.sign_dkim,
      track_open: src.track_open,
      track_click: src.track_click,
      status: 'new',
      custom_order: 0,
      resend: 0,
    },
  });
  res.status(201).json(copy);
};

// Resend to non-openers: duplicate the campaign and tag it (via the additive
// `options` column) to exclude everyone who opened the source campaign at send time.
exports.resend = async (req, res) => {
  const src = await prisma.campaign.findFirst({
    where: { uid: req.params.uid || req.params.id, customer_id: req.customer.id },
  });
  if (!src) return res.status(404).json({ message: 'Campaign not found.' });
  const copy = await prisma.campaign.create({
    data: {
      uid: uuidv4(),
      customer_id: src.customer_id,
      mail_list_id: src.mail_list_id,
      segment_id: src.segment_id,
      template_id: src.template_id,
      type: src.type,
      name: `${src.name} (resend)`,
      subject: src.subject,
      preheader: src.preheader,
      html: src.html,
      plain: src.plain,
      from_email: src.from_email,
      from_name: src.from_name,
      reply_to: src.reply_to,
      sign_dkim: src.sign_dkim,
      track_open: src.track_open,
      track_click: src.track_click,
      status: 'new',
      custom_order: 0,
      resend: (src.resend || 0) + 1,
    },
  });
  await prisma.$executeRawUnsafe(
    'UPDATE sendq_campaigns SET options = ? WHERE id = ?',
    JSON.stringify({ exclude_openers_of: src.id }),
    copy.id,
  );
  res.status(201).json(copy);
};

// Set multiple list/segment targets (additive `options.targets`). Accepts list/segment
// UIDs; keeps the single mail_list_id/segment_id columns in sync with the first target.
exports.setTargets = async (req, res) => {
  const campaign = await prisma.campaign.findFirst({
    where: { uid: req.params.uid || req.params.id, customer_id: req.customer.id },
  });
  if (!campaign) return res.status(404).json({ message: 'Campaign not found.' });

  const incoming = Array.isArray(req.body.targets) ? req.body.targets : [];
  const resolved = [];
  for (const t of incoming) {
     
    const list = t.list_uid
      ? await prisma.mailList.findFirst({ where: { uid: t.list_uid, customer_id: req.customer.id } })
      : null;
    if (!list) continue;
    let segId = null;
    if (t.segment_uid) {
       
      const seg = await prisma.segment.findFirst({ where: { uid: t.segment_uid, mail_list_id: list.id } });
      segId = seg?.id || null;
    } else if (t.segment_id) {
       
      const seg = await prisma.segment.findFirst({ where: { id: Number(t.segment_id), mail_list_id: list.id } });
      segId = seg?.id || null;
    }
    resolved.push({ list_id: list.id, segment_id: segId });
  }

  const first = resolved[0];
  if (first) {
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { mail_list_id: first.list_id, segment_id: first.segment_id },
    });
  }

  const rows = await prisma.$queryRawUnsafe('SELECT options FROM sendq_campaigns WHERE id = ?', campaign.id);
  let opts = {};
  try { opts = rows?.[0]?.options ? JSON.parse(rows[0].options) : {}; } catch {}
  if (resolved.length > 1) opts.targets = resolved;
  else delete opts.targets; // single target uses the plain columns
  await prisma.$executeRawUnsafe('UPDATE sendq_campaigns SET options = ? WHERE id = ?', JSON.stringify(opts), campaign.id);

  res.json({ message: 'Targets updated.', count: resolved.length });
};

// Archive: hide from the default list without deleting. Stored via status='archived'.
exports.archive = async (req, res) => {
  const campaign = await prisma.campaign.findFirst({
    where: { uid: req.params.uid || req.params.id, customer_id: req.customer.id },
  });
  if (!campaign) return res.status(404).json({ message: 'Campaign not found.' });
  if (campaign.status === 'sending') {
    return res.status(422).json({ message: 'Cannot archive a campaign that is currently sending.' });
  }
  await prisma.campaign.update({ where: { id: campaign.id }, data: { status: 'archived' } });
  res.json({ message: 'Campaign archived.' });
};

// Unarchive: restore to a sensible status — 'done' if it was ever sent, else 'new'.
exports.unarchive = async (req, res) => {
  const campaign = await prisma.campaign.findFirst({
    where: { uid: req.params.uid || req.params.id, customer_id: req.customer.id },
  });
  if (!campaign) return res.status(404).json({ message: 'Campaign not found.' });
  const restored = campaign.real_sent_count > 0 ? 'done' : 'new';
  await prisma.campaign.update({ where: { id: campaign.id }, data: { status: restored } });
  res.json({ message: 'Campaign unarchived.' });
};

exports.pause = async (req, res) => {
  const campaign = await findOwnedCampaign(req);
  if (!campaign) return res.status(404).json({ message: 'Campaign not found.' });
  if (campaign.status !== 'sending') return res.status(422).json({ message: 'Only sending campaigns can be paused.' });
  res.json({ message: 'Campaign paused.', campaign: await prisma.campaign.update({ where: { id: campaign.id }, data: { status: 'paused' } }) });
};

exports.resume = async (req, res) => {
  const campaign = await findOwnedCampaign(req);
  if (!campaign) return res.status(404).json({ message: 'Campaign not found.' });
  if (campaign.status !== 'paused') return res.status(422).json({ message: 'Only paused campaigns can be resumed.' });
  res.json({ message: 'Campaign resumed.', campaign: await prisma.campaign.update({ where: { id: campaign.id }, data: { status: 'sending' } }) });
};

exports.run = async (req, res) => {
  const campaign = await findOwnedCampaign(req);
  if (!campaign) return res.status(404).json({ message: 'Campaign not found.' });
  if (!['new', 'ready', 'scheduled'].includes(campaign.status)) {
    return res.status(422).json({ message: 'Campaign is not ready to run.' });
  }

  const jobId = `campaign-${campaign.id}`;
  const scheduledAt = campaign.scheduled_at ? new Date(campaign.scheduled_at) : null;
  const now = new Date();
  const isDelayed = scheduledAt && scheduledAt > now;
  const delay = isDelayed ? scheduledAt.getTime() - now.getTime() : 0;

  const useQueue = await redisReachable();

  // ─── Background queue available: enqueue as normal ───────────────────────────
  if (useQueue) {
    const queue = campaignQueue();
    const existing = await queue.getJob(jobId);
    if (existing) await existing.remove().catch(() => {});

    const updated = await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: isDelayed ? 'scheduled' : 'queued', run_at: isDelayed ? scheduledAt : now },
    });

    const job = await queue.add(
      'send-campaign',
      { campaignId: campaign.id },
      { jobId, ...(delay > 0 ? { delay } : {}) },
    );

    const message = isDelayed
      ? `Campaign scheduled for ${scheduledAt.toISOString()}.`
      : 'Campaign queued for sending.';
    return res.json({ message, campaign: updated, jobId: job.id });
  }

  // ─── Redis/worker unavailable ────────────────────────────────────────────────
  // Scheduling needs the background service; immediate sends run inline so they
  // actually go out instead of sitting "queued" forever.
  if (isDelayed) {
    const updated = await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: 'scheduled', run_at: scheduledAt },
    });
    return res.json({
      message: 'Campaign scheduled. Note: the background service is offline, so it will send once that service is running.',
      campaign: updated,
    });
  }

  const updated = await prisma.campaign.update({
    where: { id: campaign.id },
    data: { status: 'sending', run_at: now },
  });
  // Run in the background so the HTTP response returns immediately; status is
  // finalised to done/error by the sender. sendCampaign routes A/B campaigns too.
  sendCampaign(campaign.id).catch(async (err) => {
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: 'error', last_error: err.message },
    }).catch(() => {});
  });

  return res.json({ message: 'Campaign is sending.', campaign: updated });
};

exports.unschedule = async (req, res) => {
  const campaign = await findOwnedCampaign(req);
  if (!campaign) return res.status(404).json({ message: 'Campaign not found.' });
  if (campaign.status !== 'scheduled') {
    return res.status(422).json({ message: 'Only scheduled campaigns can be unscheduled.' });
  }

  const jobId = `campaign-${campaign.id}`;
  const existing = await campaignQueue().getJob(jobId);
  if (existing) await existing.remove().catch(() => {});

  const updated = await prisma.campaign.update({
    where: { id: campaign.id },
    data: { status: 'new', scheduled_at: null, run_at: null },
  });

  res.json({ message: 'Campaign unscheduled.', campaign: updated });
};

exports.send = exports.run;

const findOwnedCampaign = (req) => prisma.campaign.findFirst({
  where: { uid: req.params.uid || req.params.id, customer_id: req.customer.id },
});

// ─── Send a test email (pre-flight) ──────────────────────────────────────────────
exports.test = async (req, res) => {
  const email = String(req.body.email || '').trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(422).json({ message: 'A valid email address is required.' });
  }
  const campaign = await findOwnedCampaign(req);
  if (!campaign) return res.status(404).json({ message: 'Campaign not found.' });
  if (!campaign.html && !campaign.plain) {
    return res.status(422).json({ message: 'Add email content before sending a test.' });
  }

  const testSubscriber = {
    id: 0, uid: 'test-preview', email, first_name: 'Test', last_name: 'Recipient', status: 'subscribed',
  };
  try {
    await dispatchCampaignEmail({
      campaign: { ...campaign, subject: `[TEST] ${campaign.subject || campaign.name || 'Campaign'}`.trim() },
      subscriber: testSubscriber,
    });
    res.json({ message: `Test email sent to ${email}.` });
  } catch (err) {
    res.status(502).json({ message: `Could not send test email: ${err.message}. Check your sending configuration.` });
  }
};
