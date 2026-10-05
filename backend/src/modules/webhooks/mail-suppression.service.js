const prisma = require('../../config/database.config');

// Shared bounce/complaint suppression — used by BOTH the inbound webhooks AND the
// IMAP bounce-mailbox poller (BUG-6). When `campaign` is null (mailbox polling has no
// campaign context) the suppression is global (customer_id NULL) and applies to every
// subscriber with that address. Per-tenant when a campaign is known (BUG-5).

// Apply a bounce for one email address. Returns the number of subscribers affected.
const applyBounce = async ({ email, campaign, reason, hard }) => {
  const where = { email, ...(campaign ? { customer_id: campaign.customer_id } : {}) };
  const subscribers = await prisma.subscriber.findMany({ where });

  for (const sub of subscribers) {
    await prisma.subscriber.update({
      where: { id: sub.id },
      data: { status: hard ? 'bounced' : sub.status },
    });
    if (campaign) {
      await prisma.bounceLog.create({
        data: { campaign_id: campaign.id, subscriber_id: sub.id, reason: reason || null },
      });
    }
  }

  if (campaign) {
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { bounce_count: { increment: subscribers.length || 1 } },
    }).catch(() => {});
  }

  // Hard bounces are suppressed (per-tenant when known, else global).
  if (hard) {
    await prisma.$executeRawUnsafe(
      'INSERT INTO sendq_blacklists (customer_id, email, reason, created_at) VALUES (?, ?, ?, NOW(3)) ON DUPLICATE KEY UPDATE reason = VALUES(reason)',
      campaign?.customer_id ?? null, email, reason || 'Hard bounce',
    ).catch(() => {});
  }

  return subscribers.length;
};

// Apply a complaint / feedback-loop report for one email address.
const applyComplaint = async ({ email, campaign, type, raw }) => {
  const where = { email, ...(campaign ? { customer_id: campaign.customer_id } : {}) };
  const subscribers = await prisma.subscriber.findMany({ where });

  for (const sub of subscribers) {
    await prisma.subscriber.update({
      where: { id: sub.id },
      data: { status: 'spam-reported' },
    });
    await prisma.feedbackLog.create({
      data: {
        feedback_type: type || 'abuse',
        customer_id: campaign?.customer_id || sub.customer_id || null,
        subscriber_id: sub.id,
        campaign_id: campaign?.id || null,
        raw_feedback_content: raw || null,
      },
    });
  }

  if (campaign) {
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { feedback_count: { increment: subscribers.length || 1 } },
    }).catch(() => {});
  }

  // Complaints are always suppressed (per-tenant when known, else global).
  await prisma.$executeRawUnsafe(
    'INSERT INTO sendq_blacklists (customer_id, email, reason, created_at) VALUES (?, ?, ?, NOW(3)) ON DUPLICATE KEY UPDATE reason = VALUES(reason)',
    campaign?.customer_id ?? null, email, 'Spam complaint',
  ).catch(() => {});

  return subscribers.length;
};

module.exports = { applyBounce, applyComplaint };
