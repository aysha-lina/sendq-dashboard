require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
const prisma = require('../src/config/database.config');
const { campaignQueue } = require('../src/queues/index');
const { processCampaignSend } = require('../src/modules/campaigns/campaign.sender');

const TO = 'ayshalinahussain@gmail.com';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const customer = await prisma.customer.findFirst({ select: { id: true } });
  if (!customer) throw new Error('no customer');
  console.log('customer_id =', customer.id);

  // 1) test list
  const list = await prisma.mailList.create({ data: {
    uid: uuidv4(), customer_id: customer.id, name: '__pipeline_test_list',
    from_email: 'aysha@om.tamimahdigital.com', from_name: 'SendQ Test', status: 'active', custom_order: 0,
  }});
  // 2) subscriber = target inbox
  const sub = await prisma.subscriber.create({ data: {
    uid: uuidv4(), customer_id: customer.id, mail_list_id: list.id, email: TO, status: 'subscribed',
  }});
  // 3) campaign
  const camp = await prisma.campaign.create({ data: {
    uid: uuidv4(), customer_id: customer.id, mail_list_id: list.id,
    name: '__pipeline_test_campaign', subject: 'SendQ pipeline test — please ignore',
    from_email: 'aysha@om.tamimahdigital.com', from_name: 'SendQ Test',
    reply_to: 'aysha@om.tamimahdigital.com',
    html: '<h2>SendQ pipeline test</h2><p>If you received this in your inbox, the full campaign pipeline (queue → worker → Hostinger → inbox) works. You can ignore this message.</p>',
    plain: 'SendQ pipeline test — the full campaign pipeline works.',
    status: 'queued', track_open: true, track_click: true,
  }});
  console.log('created list', list.id, 'subscriber', sub.id, 'campaign', camp.id, '-> sending to', TO);

  // 4) enqueue via live queue; running worker will process it
  let usedQueue = false;
  try {
    const q = campaignQueue();
    const job = await Promise.race([
      q.add('send-campaign', { campaignId: camp.id }, { jobId: `campaign-${camp.id}` }),
      sleep(5000).then(() => { throw new Error('queue add timeout'); }),
    ]);
    usedQueue = true;
    console.log('ENQUEUED jobId =', job.id, '(waiting for live worker to process…)');
  } catch (e) {
    console.log('Queue unavailable (%s) — running inline instead.', e.message);
    await prisma.campaign.update({ where: { id: camp.id }, data: { status: 'sending' } });
    await processCampaignSend(camp.id);
  }

  // 5) poll for completion
  let log = null;
  for (let i = 0; i < 40; i++) {
    await sleep(1500);
    const c = await prisma.campaign.findUnique({ where: { id: camp.id }, select: { status: true, real_sent_count: true } });
    log = await prisma.emailLog.findFirst({ where: { campaign_id: camp.id }, orderBy: { id: 'desc' } });
    if (log && ['sent', 'failed'].includes(log.status)) { console.log(`campaign.status=${c.status} sent_count=${c.real_sent_count}`); break; }
    if (i % 4 === 0) console.log(`…polling (campaign.status=${c?.status}, emailLog=${log?.status || 'none'})`);
  }

  console.log('=== RESULT ===');
  console.log('used live queue:', usedQueue);
  if (log) console.log(`emailLog: status=${log.status} message_id=${log.message_id || '-'} error=${log.error || '-'}`);
  else console.log('no emailLog row produced');

  // 6) cleanup
  await prisma.emailLog.deleteMany({ where: { campaign_id: camp.id } });
  await prisma.campaign.delete({ where: { id: camp.id } });
  await prisma.subscriber.delete({ where: { id: sub.id } });
  await prisma.mailList.delete({ where: { id: list.id } });
  console.log('cleanup done (test list/subscriber/campaign removed)');
  await prisma.$disconnect();
})().catch((e) => { console.error('PIPELINE TEST FAILED:', e.message); process.exit(1); });
