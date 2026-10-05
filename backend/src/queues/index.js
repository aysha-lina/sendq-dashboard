const { Queue } = require('bullmq');
const { getConnection } = require('./connection');

const QUEUES = {
  CAMPAIGN_SEND: 'campaign-send',
  SUBSCRIBER_IMPORT: 'subscriber-import',
  SUBSCRIBER_EXPORT: 'subscriber-export',
  EMAIL_VERIFICATION: 'email-verification',
  BOUNCE_POLL: 'bounce-poll',
};

const queues = {};

const getQueue = (name) => {
  if (!queues[name]) {
    queues[name] = new Queue(name, {
      connection: getConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { age: 60 * 60 * 24 }, // keep 24h
        removeOnFail: { age: 60 * 60 * 24 * 7 }, // keep 7 days
      },
    });
  }
  return queues[name];
};

const campaignQueue = () => getQueue(QUEUES.CAMPAIGN_SEND);
const importQueue = () => getQueue(QUEUES.SUBSCRIBER_IMPORT);
const exportQueue = () => getQueue(QUEUES.SUBSCRIBER_EXPORT);
const verificationQueue = () => getQueue(QUEUES.EMAIL_VERIFICATION);
const bouncePollQueue = () => getQueue(QUEUES.BOUNCE_POLL);

// Register the repeatable bounce-mailbox poll (BUG-6). Off unless BOUNCE_POLL_ENABLED=1.
const scheduleBouncePolling = async () => {
  const enabled = ['1', 'true', 'yes'].includes(String(process.env.BOUNCE_POLL_ENABLED || '').toLowerCase());
  if (!enabled) return false;
  const every = Number(process.env.BOUNCE_POLL_INTERVAL_MS) || 5 * 60 * 1000; // default 5 min
  await bouncePollQueue().add('poll', {}, {
    repeat: { every },
    jobId: 'bounce-poll-repeat',
    removeOnComplete: true,
    removeOnFail: 50,
  });
  return every;
};

module.exports = {
  QUEUES,
  campaignQueue,
  importQueue,
  exportQueue,
  verificationQueue,
  bouncePollQueue,
  scheduleBouncePolling,
};
