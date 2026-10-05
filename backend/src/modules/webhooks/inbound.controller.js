const prisma = require('../../config/database.config');
const { applyBounce, applyComplaint } = require('./mail-suppression.service');

// Inbound deliverability webhooks (bounces + complaints/FBL). Provider webhooks
// (SES/SNS, Mailgun, SendGrid, or a generic shape). Mailbox-based handlers are drained
// by the IMAP bounce-poller (workers/bounce-poller.js); both share mail-suppression.service.
// Secured by an optional shared secret: ?token=INBOUND_WEBHOOK_TOKEN.

const tokenOk = (req) => {
  const expected = process.env.INBOUND_WEBHOOK_TOKEN;
  // Fail CLOSED in production: if no token is configured, reject (these endpoints mutate
  // subscriber status). In non-production allow unconfigured for local testing.
  if (!expected) return process.env.NODE_ENV !== 'production';
  return req.query.token === expected || req.headers['x-webhook-token'] === expected;
};

// Exported for unit testing the fail-closed behaviour.
exports.tokenOk = tokenOk;

const resolveCampaign = async (uid) => {
  if (!uid) return null;
  return prisma.campaign.findFirst({ where: { uid } });
};

// Normalize the various provider payloads into a list of events.
const parseEvents = (body) => {
  const events = [];

  // Amazon SNS envelope (SES bounces/complaints)
  if (body?.Type === 'Notification' && body?.Message) {
    let msg = body.Message;
    try { msg = JSON.parse(body.Message); } catch { /* leave as-is */ }
    if (msg.notificationType === 'Bounce' && msg.bounce) {
      const hard = msg.bounce.bounceType === 'Permanent';
      (msg.bounce.bouncedRecipients || []).forEach((r) => events.push({
        kind: 'bounce', email: r.emailAddress, hard, reason: r.diagnosticCode || msg.bounce.bounceSubType,
      }));
    } else if (msg.notificationType === 'Complaint' && msg.complaint) {
      (msg.complaint.complainedRecipients || []).forEach((r) => events.push({
        kind: 'complaint', email: r.emailAddress, type: 'abuse', raw: JSON.stringify(msg.complaint),
      }));
    }
    return events;
  }

  // Generic / Mailgun / SendGrid-ish single or array payloads
  const items = Array.isArray(body) ? body : [body];
  items.forEach((it) => {
    const email = it.email || it.recipient || it['recipient-email'];
    if (!email) return;
    const ev = (it.event || it.type || it.kind || '').toLowerCase();
    if (ev.includes('complaint') || ev.includes('spam') || ev.includes('abuse')) {
      events.push({ kind: 'complaint', email, type: 'abuse', raw: JSON.stringify(it) });
    } else if (ev.includes('bounce') || ev.includes('drop') || ev.includes('fail')) {
      events.push({ kind: 'bounce', email, hard: it.severity ? it.severity === 'permanent' : ev.includes('hard'), reason: it.reason || it.error || ev });
    }
  });
  return events;
};

// POST /api/inbound/bounce  and  /api/inbound/complaint  and  /api/inbound/events
exports.handle = (defaultKind) => async (req, res) => {
  if (!tokenOk(req)) return res.status(401).json({ message: 'Invalid webhook token.' });

  // SNS subscription confirmation handshake
  if (req.body?.Type === 'SubscriptionConfirmation') {
    return res.status(200).json({ message: 'Confirm via SubscribeURL.', subscribeUrl: req.body.SubscribeURL });
  }

  let events = parseEvents(req.body);
  // Fall back to a simple { email, campaign_uid, reason } body using the route's default kind.
  if (events.length === 0 && req.body?.email) {
    events = [{ kind: defaultKind, email: req.body.email, hard: req.body.hard !== false, reason: req.body.reason, type: req.body.type, raw: req.body.raw }];
  }
  if (events.length === 0) return res.status(422).json({ message: 'No processable bounce/complaint events found.' });

  const campaign = await resolveCampaign(req.body?.campaign_uid || req.query.campaign_uid);
  let affected = 0;
  for (const ev of events) {
    if (ev.kind === 'complaint') {
      affected += await applyComplaint({ email: ev.email, campaign, type: ev.type, raw: ev.raw });
    } else {
      affected += await applyBounce({ email: ev.email, campaign, reason: ev.reason, hard: ev.hard !== false });
    }
  }

  res.json({ message: `Processed ${events.length} event(s).`, events: events.length, subscribersAffected: affected });
};
