const { Worker } = require('bullmq');
const { getConnection } = require('../queues/connection');
const { QUEUES } = require('../queues/index');
const { processImport } = require('../modules/subscribers/import.service');

const createImportWorker = () => {
  const worker = new Worker(
    QUEUES.SUBSCRIBER_IMPORT,
    async (job) => {
      const { customerId, listId, rows } = job.data;
      console.log(`[import-worker] Importing ${rows?.length || 0} rows into list ${listId}`);
      const result = await processImport({
        customerId,
        listId,
        rows: rows || [],
        onProgress: ({ processed, total }) => {
          job.updateProgress(total ? Math.round((processed / total) * 100) : 0);
        },
      });
      console.log(`[import-worker] Done list=${listId}`, { created: result.created, updated: result.updated, failed: result.errors.length });
      return { created: result.created, updated: result.updated, failed: result.errors.length, total: result.total };
    },
    { connection: getConnection(), concurrency: 2 },
  );

  worker.on('failed', (job, err) => console.error(`[import-worker] job ${job?.id} failed:`, err.message));
  return worker;
};

module.exports = { createImportWorker };
