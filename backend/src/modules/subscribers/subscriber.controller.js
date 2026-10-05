const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const prisma = require('../../config/database.config');

const isMissingTableError = (err) => err?.code === 'P2021';

const findListId = async (req) => {
  const uid = req.query.list_uid || req.query.mail_list_uid || req.body.list_uid || req.body.mail_list_uid;
  if (!uid) return undefined;
  const list = await prisma.mailList.findFirst({ where: { uid, customer_id: req.customer.id } });
  return list?.id || null;
};

// Persist custom field values (keyed by ListField.tag) for a subscriber. Accepts
// the `custom_fields` (list page) or `fields` (form) shape. No-op without a list.
const saveFieldValues = async (subscriber, incoming) => {
  if (!subscriber?.mail_list_id || !incoming || typeof incoming !== 'object') return;
  if (!Object.keys(incoming).length) return;
  const fields = await prisma.listField.findMany({ where: { mail_list_id: subscriber.mail_list_id } });
  await Promise.all(fields
    .filter((f) => incoming[f.tag] !== undefined)
    .map((f) => prisma.subscriberFieldValue.upsert({
      where: { subscriber_id_list_field_id: { subscriber_id: subscriber.id, list_field_id: f.id } },
      update: { value: String(incoming[f.tag] ?? '').slice(0, 65535) },
      create: { subscriber_id: subscriber.id, list_field_id: f.id, value: String(incoming[f.tag] ?? '').slice(0, 65535) },
    })));
};

exports.index = async (req, res) => {
  const page = Number(req.query.page || 1);
  const perPage = Number(req.query.per_page || 10);
  const keyword = req.query.keyword || '';
  const listId = await findListId(req);
  if (listId === null) return res.status(404).json({ message: 'List not found.' });

  const where = {
    customer_id: req.customer.id,
    ...(listId ? { mail_list_id: listId } : {}),
    ...(keyword ? { email: { contains: keyword } } : {}),
    ...(req.query.status ? { status: req.query.status } : {}),
  };

  let total = 0;
  let subscribers = [];

  try {
    [total, subscribers] = await Promise.all([
      prisma.subscriber.count({ where }),
      prisma.subscriber.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: perPage,
        skip: (page - 1) * perPage,
        include: {
          mailList: true,
          fieldValues: { include: { listField: { select: { tag: true, label: true } } } },
        },
      }),
    ]);
  } catch (err) {
    if (!isMissingTableError(err)) throw err;
  }

  // Flatten custom field values into a { TAG: value } map so the list page can
  // render custom-field columns (the Columns selector chooses which to show).
  subscribers = subscribers.map((s) => {
    const custom_fields = Object.fromEntries(
      (s.fieldValues || []).map((fv) => [fv.listField?.tag, fv.value]).filter(([k]) => k),
    );
    const { fieldValues, ...rest } = s;
    return { ...rest, custom_fields };
  });

  res.json({
    data: subscribers,
    pagination: {
      total,
      per_page: perPage,
      current_page: page,
      total_pages: Math.ceil(total / perPage),
    },
  });
};

exports.store = [
  body('email').isEmail().withMessage('Valid email is required'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
    const listId = await findListId(req);
    if (listId === null) return res.status(404).json({ message: 'List not found.' });

    const subscriber = await prisma.subscriber.create({
      data: {
        uid: uuidv4(),
        customer_id: req.customer.id,
        ...(listId ? { mail_list_id: listId } : {}),
        email: req.body.email,
        first_name: req.body.first_name,
        last_name: req.body.last_name,
        status: req.body.status || 'subscribed',
        ...(req.body.tags !== undefined ? { tags: req.body.tags } : {}),
      },
    });

    await saveFieldValues(subscriber, req.body.custom_fields || req.body.fields);
    require('../../utils/event-log').logEvent({ customerId: req.customer.id, type: 'subscriber.added', name: subscriber.email });

    res.status(201).json(subscriber);
  },
];

exports.show = async (req, res) => {
  const subscriber = await prisma.subscriber.findFirst({
    where: { uid: req.params.uid, customer_id: req.customer.id },
  });
  if (!subscriber) return res.status(404).json({ message: 'Subscriber not found.' });
  res.json(subscriber);
};

// Subscriber lifecycle states accepted on update (mirrors the PHP enum).
const SUBSCRIBER_STATUSES = ['subscribed', 'unsubscribed', 'unconfirmed', 'blacklisted', 'disabled', 'moved'];

exports.update = [
  body('email').optional().isEmail().withMessage('Valid email is required'),
  body('first_name').optional().isLength({ max: 255 }).withMessage('First name too long'),
  body('last_name').optional().isLength({ max: 255 }).withMessage('Last name too long'),
  body('status').optional().isIn(SUBSCRIBER_STATUSES).withMessage('Invalid status'),
  body('tags').optional().isLength({ max: 65535 }).withMessage('Tags too long'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const subscriber = await prisma.subscriber.findFirst({
      where: { uid: req.params.uid, customer_id: req.customer.id },
    });
    if (!subscriber) return res.status(404).json({ message: 'Subscriber not found.' });

    const data = {};
    ['email', 'first_name', 'last_name', 'status', 'tags'].forEach((field) => {
      if (req.body[field] !== undefined) data[field] = req.body[field];
    });

    const updated = await prisma.subscriber.update({ where: { id: subscriber.id }, data });
    await saveFieldValues(subscriber, req.body.custom_fields || req.body.fields);
    res.json(updated);
  },
];

// ─── Subscriber activity timeline ────────────────────────────────────────────────
exports.timeline = async (req, res) => {
  const subscriber = await prisma.subscriber.findFirst({
    where: { uid: req.params.uid, customer_id: req.customer.id },
    include: { mailList: { select: { name: true } } },
  });
  if (!subscriber) return res.status(404).json({ message: 'Subscriber not found.' });

  const where = { subscriber_id: subscriber.id };
  const safe = async (p) => { try { return await p; } catch (err) { if (err?.code === 'P2021') return []; throw err; } };

  const [sent, opens, clicks, bounces, unsubs, feedback] = await Promise.all([
    safe(prisma.emailLog.findMany({ where, select: { created_at: true, campaign_id: true } })),
    safe(prisma.openLog.findMany({ where, select: { created_at: true } })),
    safe(prisma.clickLog.findMany({ where, select: { created_at: true, url: true } })),
    safe(prisma.bounceLog.findMany({ where, select: { created_at: true, reason: true } })),
    safe(prisma.unsubscribeLog.findMany({ where, select: { created_at: true } })),
    safe(prisma.feedbackLog.findMany({ where, select: { created_at: true, feedback_type: true } })),
  ]);

  const events = [
    { type: 'subscribed', label: 'Subscribed to the list', at: subscriber.created_at },
    ...sent.map((e) => ({ type: 'sent', label: 'Received an email', at: e.created_at })),
    ...opens.map((e) => ({ type: 'open', label: 'Opened an email', at: e.created_at })),
    ...clicks.map((e) => ({ type: 'click', label: `Clicked a link${e.url ? `: ${e.url}` : ''}`, at: e.created_at })),
    ...bounces.map((e) => ({ type: 'bounce', label: `Bounced${e.reason ? `: ${e.reason}` : ''}`, at: e.created_at })),
    ...unsubs.map((e) => ({ type: 'unsubscribe', label: 'Unsubscribed', at: e.created_at })),
    ...feedback.map((e) => ({ type: 'feedback', label: `Reported${e.feedback_type ? ` (${e.feedback_type})` : ''}`, at: e.created_at })),
  ].filter((e) => e.at).sort((a, b) => new Date(b.at) - new Date(a.at));

  res.json({ subscriber: { uid: subscriber.uid, email: subscriber.email, list: subscriber.mailList?.name }, events });
};

exports.destroy = async (req, res) => {
  const subscriber = await prisma.subscriber.findFirst({
    where: { uid: req.params.uid, customer_id: req.customer.id },
  });
  if (!subscriber) return res.status(404).json({ message: 'Subscriber not found.' });
  await prisma.subscriber.delete({ where: { id: subscriber.id } });
  res.json({ message: 'Subscriber deleted successfully.' });
};

// ─── Bulk operations ─────────────────────────────────────────────────────────────
// Resolve the customer's subscribers from a list of uids (or `all: true` + filters).
const resolveBulkSubscribers = async (req) => {
  const { uids, all, list_uid: listUid, keyword, status } = req.body;
  if (all) {
    const list = listUid ? await prisma.mailList.findFirst({ where: { uid: listUid, customer_id: req.customer.id } }) : null;
    if (listUid && !list) return { error: 'List not found.' };
    return {
      where: {
        customer_id: req.customer.id,
        ...(list ? { mail_list_id: list.id } : {}),
        ...(keyword ? { email: { contains: keyword } } : {}),
        ...(status ? { status } : {}),
      },
    };
  }
  if (!Array.isArray(uids) || uids.length === 0) return { error: 'No subscribers selected.' };
  return { where: { customer_id: req.customer.id, uid: { in: uids } } };
};

const resolveTargetList = async (req) => {
  const uid = req.body.target_list_uid;
  if (!uid) return { error: 'Target list is required.' };
  const list = await prisma.mailList.findFirst({ where: { uid, customer_id: req.customer.id } });
  if (!list) return { error: 'Target list not found.' };
  return { list };
};

exports.bulkDelete = async (req, res) => {
  const { where, error } = await resolveBulkSubscribers(req);
  if (error) return res.status(422).json({ message: error });
  const result = await prisma.subscriber.deleteMany({ where });
  res.json({ message: `Deleted ${result.count} subscriber(s).`, count: result.count });
};

exports.bulkUpdateStatus = async (req, res) => {
  const status = req.body.status;
  if (!['subscribed', 'unsubscribed', 'unconfirmed', 'blacklisted'].includes(status)) {
    return res.status(422).json({ message: 'Invalid status.' });
  }
  const { where, error } = await resolveBulkSubscribers(req);
  if (error) return res.status(422).json({ message: error });
  const result = await prisma.subscriber.updateMany({ where, data: { status } });
  res.json({ message: `Updated ${result.count} subscriber(s).`, count: result.count });
};

exports.bulkMove = async (req, res) => {
  const { where, error } = await resolveBulkSubscribers(req);
  if (error) return res.status(422).json({ message: error });
  const { list, error: listError } = await resolveTargetList(req);
  if (listError) return res.status(422).json({ message: listError });

  const updateExisting = req.body.update_existing !== false && req.body.update_existing !== 'no';
  const sources = await prisma.subscriber.findMany({ where });
  // Emails already present in the target list (excluding the sources themselves).
  const targetExisting = new Map(
    (await prisma.subscriber.findMany({
      where: { mail_list_id: list.id, email: { in: sources.map((s) => s.email) } },
      select: { id: true, email: true },
    })).map((s) => [s.email.toLowerCase(), s.id]),
  );

  let moved = 0;
  let updated = 0;
  let skipped = 0;
  for (const s of sources) {
    if (s.mail_list_id === list.id) { skipped += 1; continue; }
    const dupId = targetExisting.get(s.email.toLowerCase());
    if (!dupId) {
      await prisma.subscriber.update({ where: { id: s.id }, data: { mail_list_id: list.id } });
      moved += 1;
    } else if (updateExisting) {
      // Merge source info into the existing target record, then remove the source.
      await prisma.subscriber.update({
        where: { id: dupId },
        data: { first_name: s.first_name, last_name: s.last_name, status: s.status, tags: s.tags },
      });
      await prisma.subscriber.delete({ where: { id: s.id } });
      updated += 1;
    } else {
      skipped += 1;
    }
  }
  res.json({
    message: `Moved ${moved + updated} subscriber(s) to "${list.name}".`
      + (skipped ? ` ${skipped} skipped (already existed).` : ''),
    count: moved + updated,
  });
};

exports.bulkCopy = async (req, res) => {
  const { where, error } = await resolveBulkSubscribers(req);
  if (error) return res.status(422).json({ message: error });
  const { list, error: listError } = await resolveTargetList(req);
  if (listError) return res.status(422).json({ message: listError });

  const updateExisting = req.body.update_existing !== false && req.body.update_existing !== 'no';
  const sources = await prisma.subscriber.findMany({ where });
  // Map existing target addresses → id (no unique constraint in DB).
  const existing = new Map(
    (await prisma.subscriber.findMany({
      where: { mail_list_id: list.id, email: { in: sources.map((s) => s.email) } },
      select: { id: true, email: true },
    })).map((s) => [s.email.toLowerCase(), s.id]),
  );

  const toCreate = sources.filter((s) => !existing.has(s.email.toLowerCase()));
  const toUpdate = updateExisting ? sources.filter((s) => existing.has(s.email.toLowerCase())) : [];

  if (toCreate.length) {
    await prisma.subscriber.createMany({
      data: toCreate.map((s) => ({
        uid: uuidv4(),
        customer_id: req.customer.id,
        mail_list_id: list.id,
        email: s.email,
        first_name: s.first_name,
        last_name: s.last_name,
        status: s.status,
        tags: s.tags,
        source: 'copy',
      })),
    });
  }
  // "Update subscriber information": overwrite the matching target records.
  for (const s of toUpdate) {
    await prisma.subscriber.update({
      where: { id: existing.get(s.email.toLowerCase()) },
      data: { first_name: s.first_name, last_name: s.last_name, status: s.status, tags: s.tags },
    });
  }

  const skipped = sources.length - toCreate.length - toUpdate.length;
  res.json({
    message: `Copied ${toCreate.length} subscriber(s) to "${list.name}".`
      + (toUpdate.length ? ` Updated ${toUpdate.length} existing.` : '')
      + (skipped ? ` ${skipped} already existed.` : ''),
    count: toCreate.length + toUpdate.length,
    skipped,
  });
};

// Send a (double opt-in) confirmation email to the selected subscribers.
exports.bulkSendConfirmation = async (req, res) => {
  const { where, error } = await resolveBulkSubscribers(req);
  if (error) return res.status(422).json({ message: error });

  const subscribers = await prisma.subscriber.findMany({ where });
  if (!subscribers.length) return res.status(422).json({ message: 'No subscribers selected.' });

  const { sendMail } = require('../email-engine/smtp.service');
  const appUrl = (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '');
  const fromAddress = process.env.MAIL_FROM || process.env.SMTP_USER || 'noreply@sendq.io';

  let sent = 0;
  for (const sub of subscribers) {
    const confirmUrl = `${appUrl}/subscribe/confirm/${sub.uid}`;
    try {
      await sendMail({
        provider: {},
        message: {
          from: fromAddress,
          to: sub.email,
          subject: 'Please confirm your subscription',
          html: `<p>Hi ${sub.first_name || ''},</p>
<p>Please confirm your subscription by clicking the link below:</p>
<p><a href="${confirmUrl}" style="display:inline-block;padding:12px 24px;background:#d32f2f;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;">Confirm subscription</a></p>
<p>Or copy this link into your browser:<br />${confirmUrl}</p>
<p>If you didn't request this, you can ignore this email.</p>`,
        },
      });
      sent += 1;
    } catch (err) {
      console.error('[subscribers] Failed to send confirmation email:', err.message);
    }
  }

  res.json({ message: `Confirmation email sent to ${sent} subscriber(s).`, count: sent });
};

// ─── Bulk: add / remove a tag ────────────────────────────────────────────────
const splitTags = (t) => String(t || '').split(',').map((x) => x.trim()).filter(Boolean);

exports.bulkAddTag = async (req, res) => {
  const tag = String(req.body.tag || '').trim();
  if (!tag) return res.status(422).json({ message: 'Tag is required.' });
  const { where, error } = await resolveBulkSubscribers(req);
  if (error) return res.status(422).json({ message: error });
  const subs = await prisma.subscriber.findMany({ where, select: { id: true, tags: true } });
  let count = 0;
  await Promise.all(subs.map((s) => {
    const tags = splitTags(s.tags);
    if (tags.includes(tag)) return null;
    tags.push(tag); count += 1;
    return prisma.subscriber.update({ where: { id: s.id }, data: { tags: tags.join(', ') } });
  }));
  res.json({ message: `Tagged ${count} subscriber(s).`, count });
};

exports.bulkRemoveTag = async (req, res) => {
  const tag = String(req.body.tag || '').trim();
  if (!tag) return res.status(422).json({ message: 'Tag is required.' });
  const { where, error } = await resolveBulkSubscribers(req);
  if (error) return res.status(422).json({ message: error });
  const subs = await prisma.subscriber.findMany({ where, select: { id: true, tags: true } });
  let count = 0;
  await Promise.all(subs.map((s) => {
    const tags = splitTags(s.tags);
    if (!tags.includes(tag)) return null;
    count += 1;
    return prisma.subscriber.update({ where: { id: s.id }, data: { tags: tags.filter((x) => x !== tag).join(', ') } });
  }));
  res.json({ message: `Removed tag from ${count} subscriber(s).`, count });
};

// ─── Bulk: assign custom field values ────────────────────────────────────────
exports.bulkAssignFields = async (req, res) => {
  const fields = req.body.fields || req.body.custom_fields;
  if (!fields || typeof fields !== 'object' || !Object.keys(fields).length) {
    return res.status(422).json({ message: 'No field values provided.' });
  }
  const { where, error } = await resolveBulkSubscribers(req);
  if (error) return res.status(422).json({ message: error });
  const subs = await prisma.subscriber.findMany({ where, select: { id: true, mail_list_id: true } });
  let count = 0;
  for (const s of subs) {
    await saveFieldValues(s, fields);
    count += 1;
  }
  res.json({ message: `Updated field values for ${count} subscriber(s).`, count });
};

// ─── Bulk: move to blacklist (suppress + status) ─────────────────────────────
exports.bulkBlacklist = async (req, res) => {
  const { where, error } = await resolveBulkSubscribers(req);
  if (error) return res.status(422).json({ message: error });
  const subs = await prisma.subscriber.findMany({ where, select: { id: true, email: true } });
  if (!subs.length) return res.status(422).json({ message: 'No subscribers selected.' });
  const reason = String(req.body.reason || 'Manually blacklisted').slice(0, 65535);
  await Promise.all(subs.map((s) => prisma.$executeRawUnsafe(
    'INSERT IGNORE INTO sendq_blacklists (customer_id, email, reason, created_at) VALUES (?, ?, ?, NOW(3))',
    req.customer.id, s.email, reason,
  )));
  const result = await prisma.subscriber.updateMany({ where: { id: { in: subs.map((s) => s.id) } }, data: { status: 'blacklisted' } });
  res.json({ message: `Blacklisted ${result.count} subscriber(s).`, count: result.count });
};
