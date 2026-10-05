const prisma = require('../../config/database.config');
const { dispatchCampaignEmail, resolveProvider, resolveDkim, resolveExtras } = require('../email-engine/mail.dispatcher');
const { buildSegmentWhere } = require('../subscribers/segment.evaluator');

const BATCH_SIZE = 50;

// Resolve a segment id into a Prisma where fragment (null when no/invalid segment).
const segmentWhereFor = async (segmentId) => {
  if (!segmentId) return null;
  const segment = await prisma.segment.findUnique({ where: { id: segmentId } });
  if (!segment) return null;
  const listFields = await prisma.listField.findMany({
    where: { mail_list_id: segment.mail_list_id },
    select: { id: true, tag: true, uid: true },
  });
  const where = buildSegmentWhere(segment, listFields);
  return Object.keys(where).length ? where : null;
};

// Read the additive `options` JSON column via raw SQL so multi-list / resend work
// without a Prisma client regen. Returns {} when unset or invalid.
const readCampaignOptions = async (campaignId) => {
  try {
    const rows = await prisma.$queryRawUnsafe('SELECT options FROM sendq_campaigns WHERE id = ?', campaignId);
    const raw = rows?.[0]?.options;
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

// BUG-14: load the customer's suppression set (their own blacklist + global NULL
// entries), lowercased, so blacklisted recipients are skipped at send time.
const loadBlacklistSet = async (customerId) => {
  try {
    const rows = await prisma.$queryRawUnsafe(
      'SELECT email FROM sendq_blacklists WHERE customer_id = ? OR customer_id IS NULL', customerId,
    );
    return new Set(rows.map((r) => String(r.email || '').trim().toLowerCase()));
  } catch {
    return new Set();
  }
};

const isSuppressed = (email, set) => set.has(String(email || '').trim().toLowerCase());

// Build the Prisma `where` that resolves a campaign's recipients: targets
// (multi-list/segment or the single list), only 'subscribed', minus resend exclusions.
// Shared by the regular sender and the A/B runner so they target the same audience.
const buildSubscriberWhere = async (campaign, options) => {
  const targets = Array.isArray(options.targets) && options.targets.length
    ? options.targets
    : [{ list_id: campaign.mail_list_id, segment_id: campaign.segment_id }];

  const orFrags = [];
  for (const tgt of targets) {
    if (!tgt.list_id) continue;
    const segWhere = await segmentWhereFor(tgt.segment_id);
    orFrags.push({ mail_list_id: tgt.list_id, ...(segWhere ? { AND: [segWhere] } : {}) });
  }

  let excludeIds = [];
  if (options.exclude_openers_of) {
    const opens = await prisma.openLog.findMany({
      where: { campaign_id: Number(options.exclude_openers_of) },
      select: { subscriber_id: true },
      distinct: ['subscriber_id'],
    });
    excludeIds = opens.map((o) => o.subscriber_id).filter(Boolean);
  }

  return {
    customer_id: campaign.customer_id,
    status: 'subscribed',
    ...(orFrags.length ? { OR: orFrags } : {}),
    ...(excludeIds.length ? { id: { notIn: excludeIds } } : {}),
  };
};

// Send a campaign (or variant-cloned campaign) to an explicit list of subscriber ids,
// in batches, honouring the blacklist. Used by the A/B runner (test cohorts + winner).
const sendToSubscriberIds = async (campaignForDispatch, ids, { provider, dkim, blacklist }) => {
  let sent = 0; let failed = 0; let suppressed = 0;
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const slice = ids.slice(i, i + BATCH_SIZE);
    const rows = await prisma.subscriber.findMany({ where: { id: { in: slice } } });
    await Promise.allSettled(rows.map(async (subscriber) => {
      if (isSuppressed(subscriber.email, blacklist)) { suppressed += 1; return; }
      try { await dispatchCampaignEmail({ campaign: campaignForDispatch, subscriber, provider, dkim }); sent += 1; }
      catch { failed += 1; }
    }));
  }
  return { sent, failed, suppressed };
};

// A/B-aware entry point: route A/B campaigns to the A/B runner, else regular send.
// Both the BullMQ worker and the inline (no-Redis) path call this.
const sendCampaign = async (campaignId, opts = {}) => {
  const options = await readCampaignOptions(campaignId);
  if (options.ab_test && options.ab_test.enabled && options.ab_test.phase !== 'done') {
    // lazy-require avoids a circular import (the runner depends on this module)
    return require('./campaign.ab.runner').runAbTestPhase(campaignId, opts);
  }
  return processCampaignSend(campaignId, opts);
};

// Called by the BullMQ worker. Processes subscribers in batches so the
// campaign can be paused between batches without mid-send interruption.
const processCampaignSend = async (campaignId, { onProgress } = {}) => {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { mailList: true },
  });
  if (!campaign) throw new Error(`Campaign ${campaignId} not found`);

  const options = await readCampaignOptions(campaignId);
  const subscriberWhere = await buildSubscriberWhere(campaign, options);

  // Resolve the sending server (provider), DKIM signing, and extras (custom
  // headers + attachments) once for the whole run.
  const provider = await resolveProvider(campaign.customer_id);
  const dkim = await resolveDkim(campaign);
  const extras = await resolveExtras(campaign);
  const blacklist = await loadBlacklistSet(campaign.customer_id);

  const total = await prisma.subscriber.count({ where: subscriberWhere });
  let offset = 0;
  let sent = 0;
  let failed = 0;
  let suppressed = 0;

  while (offset < total) {
    // Check if the campaign was paused or cancelled between batches
    const current = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { status: true },
    });
    if (current?.status === 'paused') break;
    if (current?.status === 'cancelled') break;

    const batch = await prisma.subscriber.findMany({
      where: subscriberWhere,
      skip: offset,
      take: BATCH_SIZE,
    });

    await Promise.allSettled(
      batch.map(async (subscriber) => {
        // BUG-14: never send to a blacklisted address.
        if (isSuppressed(subscriber.email, blacklist)) {
          suppressed += 1;
          return;
        }
        try {
          await dispatchCampaignEmail({ campaign, subscriber, provider, dkim, extras });
          sent += 1;
        } catch {
          failed += 1;
        }
      }),
    );

    offset += batch.length;

    if (onProgress) {
      onProgress({ sent, failed, suppressed, total, offset });
    }
  }

  // Only mark done if not paused/cancelled mid-run
  const finalStatus = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { status: true },
  });
  if (finalStatus?.status === 'sending') {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: 'done',
        delivery_at: new Date(),
        real_sent_count: sent,
      },
    });

    require('../../utils/event-log').logEvent({ customerId: campaign.customer_id, type: 'campaign.sent', name: campaign.name, data: JSON.stringify({ sent, failed, suppressed, total }) });

    // Fire per-campaign delivery webhooks (options.webhooks with the 'sent' event).
    const campaignHooks = (Array.isArray(options.webhooks) ? options.webhooks : [])
      .filter((wh) => wh.url && (wh.events || ['sent']).includes('sent'));
    if (campaignHooks.length) {
      const payload = {
        event: 'campaign.sent',
        campaign: { uid: campaign.uid, name: campaign.name, subject: campaign.subject },
        stats: { sent, failed, suppressed, total },
        fired_at: new Date().toISOString(),
      };
      try {
        const { sendOne } = require('../webhooks/webhook.dispatcher');
        await Promise.all(campaignHooks.map((wh) => sendOne(
          { request_url: wh.url, request_method: 'POST', uid: 'campaign', event: 'campaign.sent' },
          payload,
        ).catch(() => {})));
      } catch (err) {
        console.error('[campaign] webhook dispatch failed:', err.message);
      }
    }
  }

  return { sent, failed, suppressed, total };
};

module.exports = {
  processCampaignSend, sendCampaign, loadBlacklistSet, isSuppressed,
  readCampaignOptions, buildSubscriberWhere, sendToSubscriberIds,
};
