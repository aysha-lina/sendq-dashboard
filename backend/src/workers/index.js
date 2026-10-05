const { createCampaignWorker } = require('./campaign.worker');
const { createImportWorker } = require('./import.worker');
const { createVerificationWorker } = require('./verification.worker');
const { createBouncePoller } = require('./bounce-poller');
const { scheduleBouncePolling } = require('../queues/index');

let workers = [];

const startWorkers = () => {
  workers = [
    createCampaignWorker(),
    createImportWorker(),
    createVerificationWorker(),
  ];
  // BUG-6: bounce/FBL mailbox polling — only when explicitly enabled (BOUNCE_POLL_ENABLED=1).
  scheduleBouncePolling()
    .then((every) => {
      if (every) {
        workers.push(createBouncePoller());
        console.log(`[workers] Bounce-mailbox poller enabled (every ${Math.round(every / 1000)}s)`);
      }
    })
    .catch((err) => console.error('[workers] Bounce poller schedule failed:', err.message));
  console.log(`[workers] Started ${workers.length} worker(s)`);
};

const stopWorkers = async () => {
  await Promise.all(workers.map((w) => w.close()));
  workers = [];
};

module.exports = { startWorkers, stopWorkers };
