const { Worker } = require('bullmq');
const { getConnection } = require('../queues/connection');
const { QUEUES } = require('../queues/index');
const prisma = require('../config/database.config');
const { applyBounce, applyComplaint } = require('../modules/webhooks/mail-suppression.service');
const { parseDeliveryEvent } = require('../modules/webhooks/bounce-parser');

const MAX_PER_RUN = Number(process.env.BOUNCE_POLL_MAX) || 200;

// Poll one mailbox handler over IMAP: fetch UNSEEN messages, parse bounce/complaint,
// suppress, mark seen. Mailbox bounces have no campaign context → global suppression.
const pollMailbox = async (handler) => {
  const protocol = String(handler.protocol || 'imap').toLowerCase();
  if (protocol.includes('pop')) {
    return { processed: 0, suppressed: 0, skipped: 'pop3-unsupported' };
  }
  // Lazy-require so the module still loads if imapflow is unavailable.
  const { ImapFlow } = require('imapflow');
  const secure = /ssl/i.test(handler.encryption) || String(handler.port) === '993';
  const client = new ImapFlow({
    host: handler.host,
    port: Number(handler.port) || (secure ? 993 : 143),
    secure,
    auth: { user: handler.username, pass: handler.password },
    logger: false,
    socketTimeout: 20000,
    greetingTimeout: 12000,
  });

  let processed = 0;
  let suppressed = 0;
  await client.connect();
  try {
    const lock = await client.getMailboxLock('INBOX');
    try {
      const uids = await client.search({ seen: false }, { uid: true });
      const slice = (uids || []).slice(0, MAX_PER_RUN);
      for (const uid of slice) {
         
        const msg = await client.fetchOne(uid, { source: true }, { uid: true });
        const raw = msg?.source ? msg.source.toString('utf8') : '';
        const ev = parseDeliveryEvent(raw);
        if (ev) {
           
          suppressed += ev.kind === 'complaint'
            ? await applyComplaint({ email: ev.email, campaign: null, type: ev.type, raw })
            : await applyBounce({ email: ev.email, campaign: null, reason: ev.reason, hard: ev.hard });
        }
         
        await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
        processed += 1;
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
  return { processed, suppressed };
};

// Poll every active bounce + feedback-loop handler. One bad mailbox never aborts the rest.
const pollAllHandlers = async () => {
  const [bounce, feedback] = await Promise.all([
    prisma.bounceHandler.findMany({ where: { status: 'active' } }).catch(() => []),
    prisma.feedbackLoopHandler.findMany({ where: { status: 'active' } }).catch(() => []),
  ]);
  const handlers = [...bounce, ...feedback];
  let processed = 0;
  let suppressed = 0;
  for (const h of handlers) {
    try {
       
      const r = await pollMailbox(h);
      processed += r.processed;
      suppressed += r.suppressed;
      if (r.processed) console.log(`[bounce-poller] handler ${h.id} (${h.host}): processed=${r.processed} suppressed=${r.suppressed}`);
    } catch (err) {
      console.error(`[bounce-poller] handler ${h.id} (${h.host}) failed:`, err.message);
    }
  }
  return { handlers: handlers.length, processed, suppressed };
};

const createBouncePoller = () => {
  const worker = new Worker(QUEUES.BOUNCE_POLL, async () => pollAllHandlers(), {
    connection: getConnection(),
    concurrency: 1,
  });
  worker.on('failed', (job, err) => console.error(`[bounce-poller] job ${job?.id} failed:`, err.message));
  worker.on('error', (err) => console.error('[bounce-poller] worker error:', err.message));
  return worker;
};

module.exports = { createBouncePoller, pollAllHandlers, pollMailbox };
