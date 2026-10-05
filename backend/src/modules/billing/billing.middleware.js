const prisma = require('../../config/database.config');

const defaultPlans = {
  free: { dailyEmailLimit: 100, features: ['campaigns', 'subscribers', 'analytics'] },
  pro: { dailyEmailLimit: 10000, features: ['campaigns', 'subscribers', 'analytics'] },
  enterprise: { dailyEmailLimit: -1, features: ['campaigns', 'subscribers', 'analytics', 'billing'] },
};

const isMissingTableError = (err) => err?.code === 'P2021';

const getActivePlan = async (customerId) => {
  let subscription = null;

  try {
    subscription = await prisma.subscription.findFirst({
      where: { customer_id: customerId, status: 'active' },
      include: { plan: true },
      orderBy: { created_at: 'desc' },
    });
  } catch (err) {
    if (!isMissingTableError(err)) throw err;
  }

  if (subscription?.plan) {
    return {
      name: subscription.plan.name,
      dailyEmailLimit: subscription.plan.daily_email_limit,
      features: subscription.plan.features || [],
    };
  }

  return defaultPlans.free;
};

const requireFeature = (feature) => async (req, res, next) => {
  try {
    const plan = await getActivePlan(req.customer.id);
    if (!plan.features.includes(feature)) {
      return res.status(403).json({ message: 'Your plan does not allow this feature.' });
    }
    req.plan = plan;
    next();
  } catch (err) {
    next(err);
  }
};

// Absolute per-customer daily send ceiling (anti-abuse). Applies even to
// "unlimited" (-1) plans so a malicious or misconfigured account can't blast an
// unbounded volume. Override via MAX_DAILY_EMAILS_PER_CUSTOMER.
const ABSOLUTE_DAILY_CAP = Number(process.env.MAX_DAILY_EMAILS_PER_CUSTOMER) || 100000;

const enforceDailyEmailLimit = async (req, res, next) => {
  try {
    const plan = await getActivePlan(req.customer.id);
    // Effective cap = the plan limit, but never above the absolute safety ceiling.
    const effectiveLimit = plan.dailyEmailLimit === -1
      ? ABSOLUTE_DAILY_CAP
      : Math.min(plan.dailyEmailLimit, ABSOLUTE_DAILY_CAP);

    const start = new Date();
    start.setHours(0, 0, 0, 0);

    let totalSent = 0;
    try {
      totalSent = await prisma.emailLog.count({
        where: {
          customer_id: req.customer.id,
          status: 'sent',
          sent_at: { gte: start },
        },
      });
    } catch (err) {
      if (!isMissingTableError(err)) throw err;
    }

    if (totalSent >= effectiveLimit) {
      const capped = plan.dailyEmailLimit === -1 || plan.dailyEmailLimit > ABSOLUTE_DAILY_CAP;
      return res.status(403).json({
        message: capped
          ? 'Daily sending ceiling reached. Please contact support to raise it.'
          : 'Daily email limit reached for this plan.',
      });
    }

    req.plan = plan;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { defaultPlans, enforceDailyEmailLimit, getActivePlan, requireFeature };
