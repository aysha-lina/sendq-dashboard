const prisma = require('../config/database.config');

// Append-only activity/audit event, stored in sendq_logs (AuditLog). Best-effort:
// it never throws into the caller, so logging can't break the action that fired it.
const logEvent = async ({ customerId, type, name, data = null }) => {
  if (!customerId) return;
  try {
    await prisma.auditLog.create({
      data: {
        customer_id: customerId,
        type: String(type || 'event').slice(0, 255),
        name: String(name || '').slice(0, 255),
        data: data ? String(data).slice(0, 65535) : null,
      },
    });
  } catch { /* logging is best-effort */ }
};

// Human-readable label for an event type, used by the dashboard activity feed.
const EVENT_LABELS = {
  'campaign.created': 'Campaign created',
  'campaign.sent': 'Campaign sent',
  'campaign.scheduled': 'Campaign scheduled',
  'list.created': 'List created',
  'subscriber.added': 'Subscriber added',
  'subscribers.imported': 'Subscribers imported',
  'template.created': 'Template created',
  site_event: 'Website event',
};
const labelForEvent = (type) => EVENT_LABELS[type] || String(type || 'Activity').replace(/[._]/g, ' ');

module.exports = { logEvent, labelForEvent };
