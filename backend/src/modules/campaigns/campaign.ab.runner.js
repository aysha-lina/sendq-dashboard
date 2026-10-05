// A/B campaign orchestration (runtime side of ab-test.service.js).
//   Phase 1 (runAbTestPhase): send each variant to its test cohort, snapshot the holdout,
//     mark the campaign 'ab-testing', and schedule the winner job after the wait.
//   Phase 2 (runAbWinnerPhase): score each variant by open/click rate among its cohort,
//     send the winning variant to the holdout, mark the campaign 'done'.
const prisma = require('../../config/database.config');
const { resolveProvider, resolveDkim } = require('../email-engine/mail.dispatcher');
const { loadBlacklistSet, buildSubscriberWhere, sendToSubscriberIds, readCampaignOptions } = require('./campaign.sender');
const { splitRecipients, pickWinner, variantCampaign, winnerDelayMs } = require('./ab-test.service');

const persistOptions = (campaignId, options) =>
  prisma.$executeRawUnsafe('UPDATE sendq_campaigns SET options = ? WHERE id = ?', JSON.stringify(options), campaignId);

// Schedule the delayed winner job (best-effort — needs the queue/Redis).
const scheduleWinner = async (campaignId, cfg) => {
  try {
    const { campaignQueue } = require('../../queues/index');
    await campaignQueue().add(
      'ab-winner',
      { campaignId, phase: 'ab-winner' },
      { jobId: `campaign-${campaignId}-winner`, delay: winnerDelayMs(cfg) },
    );
    return true;
  } catch {
    return false;
  }
};

const runAbTestPhase = async (campaignId, { onProgress } = {}) => {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId }, include: { mailList: true } });
  if (!campaign) throw new Error(`Campaign ${campaignId} not found`);
  const options = await readCampaignOptions(campaignId);
  const cfg = options.ab_test;
  const variantKeys = cfg.variants.map((v) => v.key);

  const where = await buildSubscriberWhere(campaign, options);
  const recipients = await prisma.subscriber.findMany({ where, select: { id: true }, orderBy: { id: 'asc' } });
  const ids = recipients.map((r) => r.id);
  const { cohorts, holdout, testTotal } = splitRecipients(ids, { testPercent: cfg.test_percent, variantKeys });

  const provider = await resolveProvider(campaign.customer_id);
  const dkim = await resolveDkim(campaign);
  const blacklist = await loadBlacklistSet(campaign.customer_id);

  const variantStats = {};
  let testSent = 0;
  for (const variant of cfg.variants) {
    const r = await sendToSubscriberIds(variantCampaign(campaign, variant), cohorts[variant.key] || [], { provider, dkim, blacklist });
    variantStats[variant.key] = { sent: r.sent, assigned: (cohorts[variant.key] || []).length };
    testSent += r.sent;
    if (onProgress) onProgress({ phase: 'testing', sent: testSent, total: testTotal });
  }

  cfg.phase = 'testing';
  cfg.assignments = cohorts;
  cfg.holdout = holdout;
  cfg.variant_stats = variantStats;
  cfg.test_sent_at = new Date().toISOString();
  await persistOptions(campaignId, options);
  await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'ab-testing', real_sent_count: testSent } });

  const scheduled = await scheduleWinner(campaignId, cfg);
  return { phase: 'testing', testTotal, holdout: holdout.length, variant_stats: variantStats, winnerScheduled: scheduled };
};

const runAbWinnerPhase = async (campaignId) => {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new Error(`Campaign ${campaignId} not found`);
  const options = await readCampaignOptions(campaignId);
  const cfg = options.ab_test;
  if (!cfg || cfg.phase === 'done') return { skipped: true };

  // Score each variant by distinct openers/clickers among the subscribers it was sent to.
  const stats = {};
  for (const variant of cfg.variants) {
    const ids = (cfg.assignments && cfg.assignments[variant.key]) || [];
    const sent = (cfg.variant_stats && cfg.variant_stats[variant.key]?.sent) || ids.length;
    let opens = 0; let clicks = 0;
    if (ids.length) {
      opens = (await prisma.openLog.findMany({ where: { campaign_id: campaign.id, subscriber_id: { in: ids } }, select: { subscriber_id: true }, distinct: ['subscriber_id'] })).length;
      clicks = (await prisma.clickLog.findMany({ where: { campaign_id: campaign.id, subscriber_id: { in: ids } }, select: { subscriber_id: true }, distinct: ['subscriber_id'] })).length;
    }
    stats[variant.key] = { sent, opens, clicks };
  }

  const winnerKey = pickWinner(stats, cfg.winner_metric) || cfg.variants[0].key;
  const winnerVariant = cfg.variants.find((v) => v.key === winnerKey) || cfg.variants[0];

  const holdout = Array.isArray(cfg.holdout) ? cfg.holdout : [];
  const provider = await resolveProvider(campaign.customer_id);
  const dkim = await resolveDkim(campaign);
  const blacklist = await loadBlacklistSet(campaign.customer_id);
  const winnerRes = await sendToSubscriberIds(variantCampaign(campaign, winnerVariant), holdout, { provider, dkim, blacklist });

  cfg.phase = 'done';
  cfg.winner_key = winnerKey;
  cfg.scores = stats;
  cfg.winner_sent = winnerRes.sent;
  cfg.winner_sent_at = new Date().toISOString();
  await persistOptions(campaignId, options);
  const totalSent = ((campaign.real_sent_count) || 0) + winnerRes.sent;
  await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'done', delivery_at: new Date(), real_sent_count: totalSent } });

  return { winner: winnerKey, scores: stats, holdoutSent: winnerRes.sent };
};

module.exports = { runAbTestPhase, runAbWinnerPhase };
