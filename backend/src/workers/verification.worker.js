const { Worker } = require('bullmq');
const { getConnection } = require('../queues/connection');
const { QUEUES } = require('../queues/index');
const prisma = require('../config/database.config');
const { processVerification } = require('../modules/verification/verification.service');

const createVerificationWorker = () => {
  const worker = new Worker(
    QUEUES.EMAIL_VERIFICATION,
    async (job) => {
      const { customerId, serverId, listId = null } = job.data;
      const server = serverId
        ? await prisma.emailVerificationServer.findUnique({ where: { id: serverId } })
        : null;
      console.log(`[verify-worker] Verifying subscribers for customer ${customerId} (server=${server?.type || 'builtin'}, list=${listId || 'all'})`);
      const result = await processVerification({
        customerId,
        server,
        listId,
        onProgress: ({ processed, total }) => job.updateProgress(total ? Math.round((processed / total) * 100) : 0),
      });
      console.log('[verify-worker] Done', result);
      return result;
    },
    { connection: getConnection(), concurrency: 1 },
  );

  worker.on('failed', (job, err) => console.error(`[verify-worker] job ${job?.id} failed:`, err.message));
  return worker;
};

module.exports = { createVerificationWorker };
