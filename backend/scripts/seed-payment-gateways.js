// Seed default payment gateways (Offline, Paymob, PayPal). Run once.
const prisma = require('../src/config/database.config');
const { randomUUID } = require('crypto');
const G = [
  ['offline', 'Offline', 'Receive payments outside of the application', 'inactive'],
  ['paymob', 'Paymob', 'Accept payments via Paymob - cards, mobile wallets, and local payment methods across the Middle East and Africa', 'active'],
  ['paypal', 'Paypal', 'PayPal is the fast/safe way to send money, make an online payment, receive money or set up a merchant account', 'inactive'],
];
(async () => {
  const c = await prisma.$queryRawUnsafe('SELECT COUNT(*) c FROM sendq_payment_gateways');
  if (Number(c[0].c) > 0) { console.log('Payment gateways already exist; skipping.'); process.exit(0); }
  for (const [type, name, desc, status] of G) {
    await prisma.$executeRawUnsafe(
      'INSERT INTO sendq_payment_gateways (uid, type, name, description, status, gateway_data, created_at, updated_at) VALUES (?,?,?,?,?,?,NOW(3),NOW(3))',
      randomUUID(), type, name, desc, status, '{}');
  }
  console.log(`Seeded ${G.length} payment gateways.`);
  process.exit(0);
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
