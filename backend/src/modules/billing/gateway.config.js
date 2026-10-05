// Loads a payment gateway's saved keys (entered in admin → Payment gateways → Edit),
// stored as JSON in PaymentGateway.gateway_data. Returns {} if not configured.
const prisma = require('../../config/database.config');

const loadGatewayConfig = async (type) => {
  try {
    const g = await prisma.paymentGateway.findFirst({
      where: { type, status: 'active' },
      orderBy: { id: 'desc' },
    });
    if (!g || !g.gateway_data) return {};
    return JSON.parse(g.gateway_data) || {};
  } catch {
    return {};
  }
};

module.exports = { loadGatewayConfig };
