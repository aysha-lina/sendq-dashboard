// Idempotent: seed the admin service plans (Manage Plans). Run:
//   node scripts/seed-plans.js
// Safe to re-run — existing plans (matched by name) are left untouched.
const prisma = require('../src/config/database.config');

// In display order (top → bottom as shown in admin Manage Plans).
// delivery: 'smtp' = Use SMTP for email delivery, 'customer' = Use customer's
// delivery servers, 'none' = No delivery server selected.
const PLANS = [
  { name: 'Free', description: 'All the basics for businesses or individual to get started with email marketing', price: 0, amount: '1', unit: 'year', credits: 'unlimited', delivery: 'customer', subs: 1, daily: 0 },
  { name: 'For Tamimah Digital', description: 'Using Tamimahs Mail System', price: 0, amount: '1', unit: 'year', credits: 'unlimited', delivery: 'smtp', subs: 1, daily: 0 },
  { name: 'Starter', description: 'For small businesses & first-time senders', price: 9, amount: '1', unit: 'month', credits: 10000, delivery: 'smtp', subs: 0, daily: 10000 },
  { name: 'Pro', description: 'For marketing-focused businesses', price: 89, amount: '1', unit: 'month', credits: 150000, delivery: 'smtp', subs: 0, daily: 150000 },
  { name: 'Enterprise', description: 'For high-volume campaigns and large-scale outreach', price: 179, amount: '1', unit: 'month', credits: 300000, delivery: 'smtp', subs: 0, daily: 300000 },
  { name: 'Bawwaba', description: 'For Bawwaba Marketing', price: 0, amount: '1', unit: 'month', credits: 'unlimited', delivery: 'customer', subs: 0, daily: 0 },
  { name: 'Demo Plan', description: 'This Plan is for demo puropose in sales pitch', price: 10, amount: '1', unit: 'day', credits: 10000, delivery: 'none', subs: 0, daily: 10000 },
];

(async () => {
  const currency = await prisma.currency.findFirst({ where: { code: 'OMR' } }) || await prisma.currency.findFirst();
  const now = Date.now();
  let created = 0;
  for (let i = 0; i < PLANS.length; i += 1) {
    const p = PLANS[i];
    const existing = await prisma.plan.findFirst({ where: { name: p.name } });
    if (existing) { console.log(`= skip "${p.name}" (already exists)`); continue; }
    // Space created_at so the default "Created at desc" ordering keeps display order
    // (Free newest → shown first, Demo Plan oldest → shown last).
    const createdAt = new Date(now - i * 60000);
    await prisma.plan.create({
      data: {
        name: p.name,
        description: p.description,
        price: p.price,
        currency_id: currency?.id || null,
        frequency_amount: p.amount,
        frequency_unit: p.unit,
        daily_email_limit: p.daily,
        status: 'active',
        type: 'subscription',
        custom_order: i,
        features: { sending_credits: p.credits, subscriber_limit: p.subs, delivery: p.delivery },
        created_at: createdAt,
        updated_at: createdAt,
      },
    });
    created += 1;
    console.log(`+ created "${p.name}"`);
  }
  console.log(`Done. ${created} plan(s) created.`);
  await prisma.$disconnect();
  process.exit(0);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
