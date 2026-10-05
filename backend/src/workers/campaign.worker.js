const { Worker } = require('bullmq');
const { getConnection } = require('../queues/connection');
const { QUEUES } = require('../queues/index');
const prisma = require('../config/database.config');
const { sendCampaign } = require('../modules/campaigns/campaign.sender');
const { runAbWinnerPhase } = require('../modules/campaigns/campaign.ab.runner');

const createCampaignWorker = () => {
  const worker = new Worker(
    QUEUES.CAMPAIGN_SEND,
    async (job) => {
      const { campaignId } = job.data;

      // Delayed A/B winner job: score variants + send the winner to the holdout.
      if (job.name === 'ab-winner') {
        console.log(`[campaign-worker] A/B winner selection for campaign ${campaignId}`);
        return runAbWinnerPhase(campaignId);
      }

      console.log(`[campaign-worker] Starting campaign ${campaignId}`);

      const campaignCheck = await prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { status: true },
      });
      if (!campaignCheck || !['queued', 'scheduled'].includes(campaignCheck.status)) {
        console.log(`[campaign-worker] Skipping campaign ${campaignId} – status=${campaignCheck?.status}`);
        return { skipped: true };
      }

      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'sending' },
      });

      // sendCampaign routes A/B campaigns to the A/B test phase, else a regular send.
      const result = await sendCampaign(campaignId, {
        onProgress: ({ sent, failed, total }) => {
          const pct = total ? Math.round((sent / total) * 100) : 0;
          job.updateProgress(pct);
          console.log(`[campaign-worker] campaign=${campaignId} sent=${sent} failed=${failed} total=${total}`);
        },
      });

      console.log(`[campaign-worker] Done campaign=${campaignId}`, result);
      return result;
    },
    {
      connection: getConnection(),
      concurrency: 2, // process up to 2 campaigns at once
    },
  );

  worker.on('failed', async (job, err) => {
    console.error(`[campaign-worker] Job ${job?.id} failed:`, err.message);
    if (job?.data?.campaignId) {
      await prisma.campaign.update({
        where: { id: job.data.campaignId },
        data: { status: 'error', last_error: err.message },
      }).catch(() => {});
    }
  });

  worker.on('error', (err) => {
    console.error('[campaign-worker] Worker error:', err.message);
  });

  return worker;
};

module.exports = { createCampaignWorker };
