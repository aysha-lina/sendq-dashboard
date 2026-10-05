const prisma = require('../../config/database.config');
const { verifyEmail } = require('./verify.service');

// Verify a customer's subscribers against a verification server (or the built-in
// verifier when no server is given). Shared by the sync route and the worker.
const processVerification = async ({ customerId, server, listId = null, onlyUnverified = true, onProgress }) => {
  const where = {
    customer_id: customerId,
    ...(listId ? { mail_list_id: listId } : {}),
    ...(onlyUnverified ? { OR: [{ verification_status: null }, { verification_status: 'unverified' }] } : {}),
  };
  const subscribers = await prisma.subscriber.findMany({ where, select: { id: true, email: true } });

  const tally = { total: subscribers.length, deliverable: 0, undeliverable: 0, risky: 0, unknown: 0 };
  for (let i = 0; i < subscribers.length; i += 1) {
    const result = await verifyEmail(subscribers[i].email, server);
    await prisma.subscriber.update({
      where: { id: subscribers[i].id },
      data: { verification_status: result.status },
    });
    tally[result.status] = (tally[result.status] || 0) + 1;
    if (onProgress && (i % 20 === 0 || i === subscribers.length - 1)) {
      onProgress({ processed: i + 1, total: subscribers.length });
    }
  }
  return tally;
};

module.exports = { processVerification };
