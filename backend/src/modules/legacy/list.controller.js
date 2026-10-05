const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const prisma = require('../../config/database.config');
const { parseCsv, parseCsvTable, suggestMapping, buildMappedRows, processImport, STD_FIELDS } = require('../subscribers/import.service');

const defaultFields = [
  { key: 'email', label: 'Email', type: 'email', required: true },
  { key: 'first_name', label: 'First name', type: 'text', required: false },
  { key: 'last_name', label: 'Last name', type: 'text', required: false },
];

const isMissingSchemaError = (err) => (
  err?.code === 'P2021' ||
  err?.code === 'P2022' ||
  err?.message?.includes('does not exist') ||
  err?.message?.includes("doesn't exist")
);

const safeCount = async (query) => {
  try {
    return await query();
  } catch (err) {
    if (isMissingSchemaError(err)) return 0;
    throw err;
  }
};

const safeFindMany = async (query) => {
  try {
    return await query();
  } catch (err) {
    if (isMissingSchemaError(err)) return [];
    throw err;
  }
};

const findList = (req, uid) => prisma.mailList.findFirst({
  where: { uid, customer_id: req.customer.id },
});

const cleanTag = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9_]+/g, '_')
  .replace(/^_+|_+$/g, '');

// CSV parsing now lives in subscribers/import.service (robust: BOM, ; / tab
// delimiters, quoted fields, header aliases) and is imported at the top.

exports.index = async (req, res) => {
  const page = Number(req.query.page || 1);
  const perPage = Number(req.query.per_page || 10);
  const keyword = req.query.keyword || '';
  const where = {
    customer_id: req.customer.id,
    ...(keyword ? { name: { contains: keyword } } : {}),
  };

  const [total, lists] = await Promise.all([
    prisma.mailList.count({ where }),
    prisma.mailList.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: perPage,
      skip: (page - 1) * perPage,
    }),
  ]);

  const decoratedLists = await Promise.all(lists.map(async (list) => ({
    ...list,
    subscriber_count: await safeCount(() => prisma.subscriber.count({ where: { mail_list_id: list.id } })),
    segment_count: await safeCount(() => prisma.segment.count({ where: { mail_list_id: list.id } })),
    form_count: await safeCount(() => prisma.listForm.count({ where: { mail_list_id: list.id } })),
  })));

  res.json({
    data: decoratedLists,
    pagination: { total, per_page: perPage, current_page: page, total_pages: Math.ceil(total / perPage) },
  });
};

exports.show = async (req, res) => {
  const list = await prisma.mailList.findFirst({
    where: { uid: req.params.uid, customer_id: req.customer.id },
  });
  if (!list) return res.status(404).json({ message: 'List not found.' });

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const [
    subscriber_count,
    unsubscribed_count,
    unconfirmed_count,
    segment_count,
    form_count,
    recentSubscribers,
    listCampaigns,
  ] = await Promise.all([
    safeCount(() => prisma.subscriber.count({ where: { mail_list_id: list.id } })),
    safeCount(() => prisma.subscriber.count({ where: { mail_list_id: list.id, status: 'unsubscribed' } })),
    safeCount(() => prisma.subscriber.count({ where: { mail_list_id: list.id, status: 'unconfirmed' } })),
    safeCount(() => prisma.segment.count({ where: { mail_list_id: list.id } })),
    safeCount(() => prisma.listForm.count({ where: { mail_list_id: list.id } })),
    safeFindMany(() => prisma.subscriber.findMany({
      where: { mail_list_id: list.id, created_at: { gte: sixMonthsAgo } },
      select: { created_at: true },
    })),
    safeFindMany(() => prisma.campaign.findMany({
      where: { mail_list_id: list.id },
      select: { id: true },
    })),
  ]);

  // Monthly growth for last 6 months
  const monthCounts = {};
  recentSubscribers.forEach(({ created_at }) => {
    const d = new Date(created_at);
    const key = `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    monthCounts[key] = (monthCounts[key] || 0) + 1;
  });
  const growth_data = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    const key = `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    return { label: key, subscribers: monthCounts[key] || 0 };
  });

  // Open/click rates across all campaigns for this list
  let average_open_rate = 0;
  let average_click_rate = 0;
  if (listCampaigns.length > 0) {
    const campaignIds = listCampaigns.map((c) => c.id);
    const [totalSent, totalOpens, totalClicks] = await Promise.all([
      safeCount(() => prisma.emailLog.count({ where: { campaign_id: { in: campaignIds }, status: 'sent' } })),
      safeCount(() => prisma.openLog.count({ where: { campaign_id: { in: campaignIds } } })),
      safeCount(() => prisma.clickLog.count({ where: { campaign_id: { in: campaignIds } } })),
    ]);
    if (totalSent > 0) {
      average_open_rate = Number(((totalOpens / totalSent) * 100).toFixed(2));
      average_click_rate = Number(((totalClicks / totalSent) * 100).toFixed(2));
    }
  }

  const avg_unsubscribe_rate = subscriber_count > 0
    ? Number(((unsubscribed_count / subscriber_count) * 100).toFixed(2))
    : 0;

  res.json({
    ...list,
    subscriber_count,
    unsubscribed_count,
    unconfirmed_count,
    segment_count,
    form_count,
    average_open_rate,
    average_click_rate,
    avg_unsubscribe_rate,
    total_unsubscribers: unsubscribed_count,
    total_unconfirmed: unconfirmed_count,
    growth_data,
  });
};

exports.store = [
  body('name').notEmpty().withMessage('List name is required'),
  body('from_email').isEmail().withMessage('Valid from email is required'),
  body('from_name').notEmpty().withMessage('From name is required'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const list = await prisma.mailList.create({
      data: {
        uid: uuidv4(),
        customer_id: req.customer.id,
        name: req.body.name,
        from_email: req.body.from_email,
        from_name: req.body.from_name,
        default_subject: req.body.default_subject,
        remind_message: req.body.remind_message,
        subscribe_confirmation: req.body.subscribe_confirmation ?? true,
        send_welcome_email: req.body.send_welcome_email ?? false,
        unsubscribe_notification: req.body.unsubscribe_notification ?? false,
        status: 'active',
        custom_order: 0,
      },
    });

    require('../../utils/event-log').logEvent({ customerId: req.customer.id, type: 'list.created', name: list.name });
    res.status(201).json(list);
  },
];

exports.update = async (req, res) => {
  const list = await findList(req, req.params.uid);
  if (!list) return res.status(404).json({ message: 'List not found.' });

  const allowed = [
    'name', 'from_email', 'from_name', 'default_subject',
    'remind_message', 'subscribe_confirmation',
    'send_welcome_email', 'unsubscribe_notification', 'status',
  ];
  const data = {};
  allowed.forEach((field) => {
    if (req.body[field] !== undefined) data[field] = req.body[field];
  });

  res.json(await prisma.mailList.update({ where: { id: list.id }, data }));
};

exports.destroy = async (req, res) => {
  const list = await findList(req, req.params.uid);
  if (!list) return res.status(404).json({ message: 'List not found.' });
  await prisma.mailList.delete({ where: { id: list.id } });
  res.json({ message: 'List deleted successfully.' });
};

// Duplicate a list's structure + custom fields (not its subscribers) — mirrors PHP MailList::copy().
exports.copy = async (req, res) => {
  const src = await findList(req, req.params.uid);
  if (!src) return res.status(404).json({ message: 'List not found.' });
  const name = (req.body && req.body.name && String(req.body.name).trim()) || `${src.name} (copy)`;

  const copy = await prisma.mailList.create({
    data: {
      uid: uuidv4(),
      customer_id: req.customer.id,
      name,
      from_email: src.from_email,
      from_name: src.from_name,
      default_subject: src.default_subject,
      remind_message: src.remind_message,
      subscribe_confirmation: src.subscribe_confirmation,
      send_welcome_email: src.send_welcome_email,
      unsubscribe_notification: src.unsubscribe_notification,
      status: 'active',
      custom_order: 0,
    },
  });

  const fields = await prisma.listField.findMany({ where: { mail_list_id: src.id } });
  if (fields.length) {
    await prisma.listField.createMany({
      data: fields.map((f) => ({
        uid: uuidv4(),
        mail_list_id: copy.id,
        label: f.label,
        tag: f.tag,
        type: f.type,
        required: f.required,
        default_value: f.default_value,
        options: f.options ?? undefined,
        sort_order: f.sort_order,
      })),
    });
  }

  res.status(201).json(copy);
};

exports.settings = async (req, res) => {
  const list = await findList(req, req.params.uid);
  if (!list) return res.status(404).json({ message: 'List not found.' });
  res.json({ list });
};

exports.updateSettings = exports.update;

// Like Acelle, EMAIL/FIRST_NAME/LAST_NAME are real field records (so they can be
// toggled and — for first/last — deleted). Seeded lazily + idempotently per list.
const DEFAULT_FIELD_SEED = [
  { label: 'Email', tag: 'EMAIL', type: 'text', required: true, sort_order: 0 },
  { label: 'First name', tag: 'FIRST_NAME', type: 'text', required: false, sort_order: 1 },
  { label: 'Last name', tag: 'LAST_NAME', type: 'text', required: false, sort_order: 2 },
];
const ensureDefaultFields = async (listId) => {
  let existing = [];
  try { existing = await prisma.listField.findMany({ where: { mail_list_id: listId }, select: { tag: true } }); } catch { return; }
  const have = new Set(existing.map((e) => e.tag));
  for (const d of DEFAULT_FIELD_SEED) {
    if (have.has(d.tag)) continue;
    try {
      await prisma.listField.create({
        data: { uid: uuidv4(), mail_list_id: listId, label: d.label, tag: d.tag, type: d.type, required: d.required, default_value: null, options: { visible: true, choices: [] }, sort_order: d.sort_order },
      });
    } catch { /* unique race — ignore */ }
  }
};

exports.fields = async (req, res) => {
  const list = await findList(req, req.params.uid);
  if (!list) return res.status(404).json({ message: 'List not found.' });

  await ensureDefaultFields(list.id);

  const fields = await safeFindMany(() => prisma.listField.findMany({
    where: { mail_list_id: list.id },
    orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
  }));

  res.json({ list, fields, default_fields: defaultFields });
};

exports.storeField = [
  body('label').notEmpty().withMessage('Field label is required'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const list = await findList(req, req.params.uid);
    if (!list) return res.status(404).json({ message: 'List not found.' });

    const tag = cleanTag(req.body.tag || req.body.label);
    if (!tag) return res.status(422).json({ message: 'Field tag is required.' });

    const field = await prisma.listField.create({
      data: {
        uid: uuidv4(),
        mail_list_id: list.id,
        label: req.body.label,
        tag,
        type: req.body.type || 'text',
        required: Boolean(req.body.required),
        default_value: req.body.default_value,
        options: req.body.options,
        sort_order: Number(req.body.sort_order || 0),
      },
    });

    res.status(201).json(field);
  },
];

exports.updateField = async (req, res) => {
  const list = await findList(req, req.params.uid);
  if (!list) return res.status(404).json({ message: 'List not found.' });
  const field = await prisma.listField.findFirst({ where: { uid: req.params.fieldUid, mail_list_id: list.id } });
  if (!field) return res.status(404).json({ message: 'Field not found.' });

  const data = {};
  ['label', 'type', 'required', 'default_value', 'options', 'sort_order'].forEach((key) => {
    if (req.body[key] !== undefined) data[key] = key === 'sort_order' ? Number(req.body[key]) : req.body[key];
  });
  if (req.body.tag !== undefined) data.tag = cleanTag(req.body.tag);

  res.json(await prisma.listField.update({ where: { id: field.id }, data }));
};

exports.destroyField = async (req, res) => {
  const list = await findList(req, req.params.uid);
  if (!list) return res.status(404).json({ message: 'List not found.' });
  const field = await prisma.listField.findFirst({ where: { uid: req.params.fieldUid, mail_list_id: list.id } });
  if (!field) return res.status(404).json({ message: 'Field not found.' });
  if (field.tag === 'EMAIL') return res.status(422).json({ message: 'The email field cannot be deleted.' });
  await prisma.listField.delete({ where: { id: field.id } });
  res.json({ message: 'Field deleted successfully.' });
};

exports.segments = async (req, res) => {
  const list = await findList(req, req.params.uid);
  if (!list) return res.status(404).json({ message: 'List not found.' });
  const data = await safeFindMany(() => prisma.segment.findMany({ where: { mail_list_id: list.id }, orderBy: { created_at: 'desc' } }));
  res.json({ list, data });
};

exports.storeSegment = [
  body('name').notEmpty().withMessage('Segment name is required'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const list = await findList(req, req.params.uid);
    if (!list) return res.status(404).json({ message: 'List not found.' });

    const segment = await prisma.segment.create({
      data: {
        uid: uuidv4(),
        mail_list_id: list.id,
        name: req.body.name,
        matching: req.body.matching || 'all',
        conditions: req.body.conditions || [],
      },
    });

    res.status(201).json(segment);
  },
];

exports.updateSegment = async (req, res) => {
  const list = await findList(req, req.params.uid);
  if (!list) return res.status(404).json({ message: 'List not found.' });
  const segment = await prisma.segment.findFirst({ where: { uid: req.params.segmentUid, mail_list_id: list.id } });
  if (!segment) return res.status(404).json({ message: 'Segment not found.' });

  const data = {};
  ['name', 'matching', 'conditions'].forEach((key) => {
    if (req.body[key] !== undefined) data[key] = req.body[key];
  });

  res.json(await prisma.segment.update({ where: { id: segment.id }, data }));
};

exports.destroySegment = async (req, res) => {
  const list = await findList(req, req.params.uid);
  if (!list) return res.status(404).json({ message: 'List not found.' });
  const segment = await prisma.segment.findFirst({ where: { uid: req.params.segmentUid, mail_list_id: list.id } });
  if (!segment) return res.status(404).json({ message: 'Segment not found.' });
  await prisma.segment.delete({ where: { id: segment.id } });
  res.json({ message: 'Segment deleted successfully.' });
};

// Duplicate a segment (name + matching + conditions) within the same list.
exports.copySegment = async (req, res) => {
  const list = await findList(req, req.params.uid);
  if (!list) return res.status(404).json({ message: 'List not found.' });
  const src = await prisma.segment.findFirst({ where: { uid: req.params.segmentUid, mail_list_id: list.id } });
  if (!src) return res.status(404).json({ message: 'Segment not found.' });
  const copy = await prisma.segment.create({
    data: {
      uid: uuidv4(),
      mail_list_id: list.id,
      name: `${src.name} (copy)`,
      matching: src.matching || 'all',
      conditions: src.conditions ?? [],
    },
  });
  res.status(201).json(copy);
};

// Count how many of the list's subscribers match a segment's conditions.
// Accepts a saved segment (by uid) OR an unsaved {matching, conditions} body for live preview.
exports.countSegment = async (req, res) => {
  const { buildSegmentWhere } = require('../subscribers/segment.evaluator');
  const list = await findList(req, req.params.uid);
  if (!list) return res.status(404).json({ message: 'List not found.' });

  let segment;
  if (req.params.segmentUid) {
    segment = await prisma.segment.findFirst({ where: { uid: req.params.segmentUid, mail_list_id: list.id } });
    if (!segment) return res.status(404).json({ message: 'Segment not found.' });
  } else {
    segment = { matching: req.body.matching || 'all', conditions: req.body.conditions || [] };
  }

  const listFields = await prisma.listField.findMany({
    where: { mail_list_id: list.id }, select: { id: true, tag: true, uid: true },
  });
  const segWhere = buildSegmentWhere(segment, listFields);
  const count = await prisma.subscriber.count({
    where: { customer_id: list.customer_id, mail_list_id: list.id, ...(Object.keys(segWhere).length ? { AND: [segWhere] } : {}) },
  });
  res.json({ count });
};

exports.forms = async (req, res) => {
  const list = await findList(req, req.params.uid);
  if (!list) return res.status(404).json({ message: 'List not found.' });
  const data = await safeFindMany(() => prisma.listForm.findMany({ where: { mail_list_id: list.id }, orderBy: { created_at: 'desc' } }));
  res.json({ list, data });
};

exports.storeForm = [
  body('name').notEmpty().withMessage('Form name is required'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const list = await findList(req, req.params.uid);
    if (!list) return res.status(404).json({ message: 'List not found.' });

    const form = await prisma.listForm.create({
      data: {
        uid: uuidv4(),
        mail_list_id: list.id,
        name: req.body.name,
        type: req.body.type || 'embedded_form',
        content: req.body.content || {},
        status: req.body.status || 'active',
      },
    });

    res.status(201).json(form);
  },
];

exports.updateForm = async (req, res) => {
  const list = await findList(req, req.params.uid);
  if (!list) return res.status(404).json({ message: 'List not found.' });
  const form = await prisma.listForm.findFirst({ where: { uid: req.params.formUid, mail_list_id: list.id } });
  if (!form) return res.status(404).json({ message: 'Form not found.' });

  const data = {};
  ['name', 'type', 'content', 'status'].forEach((key) => {
    if (req.body[key] !== undefined) data[key] = req.body[key];
  });

  res.json(await prisma.listForm.update({ where: { id: form.id }, data }));
};

exports.destroyForm = async (req, res) => {
  const list = await findList(req, req.params.uid);
  if (!list) return res.status(404).json({ message: 'List not found.' });
  const form = await prisma.listForm.findFirst({ where: { uid: req.params.formUid, mail_list_id: list.id } });
  if (!form) return res.status(404).json({ message: 'Form not found.' });
  await prisma.listForm.delete({ where: { id: form.id } });
  res.json({ message: 'Form deleted successfully.' });
};

// ─── Public subscriber pages (no auth): profile update + double opt-in confirm ────
exports.getPublicProfile = async (req, res) => {
  const subscriber = await prisma.subscriber.findFirst({ where: { uid: req.params.subscriberUid } });
  if (!subscriber) return res.status(404).json({ message: 'Subscriber not found.' });
  const list = subscriber.mail_list_id ? await prisma.mailList.findUnique({ where: { id: subscriber.mail_list_id } }) : null;

  const fields = list
    ? await prisma.listField.findMany({ where: { mail_list_id: list.id }, orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }] })
    : [];
  const values = await prisma.subscriberFieldValue.findMany({ where: { subscriber_id: subscriber.id } });
  const valueMap = new Map(values.map((v) => [v.list_field_id, v.value]));

  res.json({
    subscriber: { uid: subscriber.uid, email: subscriber.email, first_name: subscriber.first_name, last_name: subscriber.last_name, status: subscriber.status },
    list: list ? { uid: list.uid, name: list.name } : null,
    fields: fields.map((f) => ({
      uid: f.uid, label: f.label, tag: f.tag, type: f.type, required: f.required,
      options: f.options, value: valueMap.get(f.id) ?? f.default_value ?? '',
    })),
  });
};

exports.updatePublicProfile = [
  // Public (unauthenticated) endpoint — validate the free-text inputs to bound
  // payload size and reject malformed custom-field maps (S5).
  body('first_name').optional().isLength({ max: 255 }).withMessage('First name too long'),
  body('last_name').optional().isLength({ max: 255 }).withMessage('Last name too long'),
  body('fields').optional().isObject().withMessage('Invalid fields payload'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const subscriber = await prisma.subscriber.findFirst({ where: { uid: req.params.subscriberUid } });
    if (!subscriber) return res.status(404).json({ message: 'Subscriber not found.' });

    const data = {};
    if (req.body.first_name !== undefined) data.first_name = req.body.first_name;
    if (req.body.last_name !== undefined) data.last_name = req.body.last_name;
    if (Object.keys(data).length) await prisma.subscriber.update({ where: { id: subscriber.id }, data });

    // Upsert custom field values by tag (each value capped to a TEXT-safe length).
    const incoming = req.body.fields || {};
    if (subscriber.mail_list_id && Object.keys(incoming).length) {
      const fields = await prisma.listField.findMany({ where: { mail_list_id: subscriber.mail_list_id } });
      await Promise.all(fields
        .filter((f) => incoming[f.tag] !== undefined)
        .map((f) => prisma.subscriberFieldValue.upsert({
          where: { subscriber_id_list_field_id: { subscriber_id: subscriber.id, list_field_id: f.id } },
          update: { value: String(incoming[f.tag] ?? '').slice(0, 65535) },
          create: { subscriber_id: subscriber.id, list_field_id: f.id, value: String(incoming[f.tag] ?? '').slice(0, 65535) },
        })));
    }

    res.json({ message: 'Your preferences have been updated.' });
  },
];

exports.confirmSubscriber = async (req, res) => {
  const subscriber = await prisma.subscriber.findFirst({ where: { uid: req.params.token } });
  if (!subscriber) return res.status(404).json({ message: 'Subscriber not found.' });
  if (subscriber.status === 'unconfirmed') {
    await prisma.subscriber.update({ where: { id: subscriber.id }, data: { status: 'subscribed' } });
  }
  res.json({ message: 'Your subscription is confirmed.', email: subscriber.email });
};

// ─── Public UI translation overrides (no auth) — consumed by the frontend i18n layer ──
exports.publicTranslations = async (req, res) => {
  const rows = await prisma
    .$queryRawUnsafe('SELECT tkey, value FROM sendq_translations WHERE locale = ?', req.params.locale)
    .catch(() => []);
  const map = {};
  rows.forEach((r) => { map[r.tkey] = r.value; });
  res.set('Cache-Control', 'public, max-age=60');
  res.json({ translations: map });
};

// ─── Public form fetch (no auth) — powers the hosted/embedded subscribe form ──────
exports.getPublicForm = async (req, res) => {
  const form = await prisma.listForm.findFirst({ where: { uid: req.params.formUid } });
  if (!form || form.status !== 'active') return res.status(404).json({ message: 'Form not found.' });
  const list = await prisma.mailList.findUnique({ where: { id: form.mail_list_id } });
  if (!list) return res.status(404).json({ message: 'List not found.' });
  res.json({
    form: { uid: form.uid, name: form.name, type: form.type, content: form.content || {} },
    list: { uid: list.uid, name: list.name },
  });
};

// POST /api/v1/lists/:uid/subscribers/import/preview — parse a CSV's columns + sample
// rows and return them alongside the list's fields + a suggested column→field mapping,
// so the frontend wizard can let the user confirm/adjust before importing.
exports.importPreview = async (req, res) => {
  const list = await findList(req, req.params.uid);
  if (!list) return res.status(404).json({ message: 'List not found.' });

  const table = parseCsvTable(req.body.csv);
  if (table.columns.length === 0) return res.status(422).json({ message: 'No data found in the file.' });

  const customFields = await prisma.listField.findMany({
    where: { mail_list_id: list.id },
    orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
    select: { tag: true, label: true },
  }).catch(() => []);

  res.json({
    columns: table.columns,
    sample: table.rows.slice(0, 5),
    rowCount: table.rows.length,
    hasHeader: table.hasHeader,
    standardFields: STD_FIELDS,
    customFields, // [{ tag, label }]
    suggested: suggestMapping(table.columns, customFields),
  });
};

exports.importSubscribers = async (req, res) => {
  const list = await findList(req, req.params.uid);
  if (!list) return res.status(404).json({ message: 'List not found.' });

  // Three input shapes: pre-built `subscribers[]`, a `csv` + explicit `mapping[]`
  // (column-mapping wizard), or a `csv` alone (legacy auto-map by header alias).
  let rows;
  if (Array.isArray(req.body.subscribers)) {
    rows = req.body.subscribers;
  } else if (Array.isArray(req.body.mapping)) {
    const table = parseCsvTable(req.body.csv);
    rows = buildMappedRows(table, req.body.mapping);
  } else {
    rows = parseCsv(req.body.csv);
  }
  if (rows.length === 0) return res.status(422).json({ message: 'No subscribers found to import.' });

  const LARGE = 200;
  // Large imports run in the background via BullMQ; small ones stay synchronous
  // so the UI gets an immediate created/updated summary.
  if (rows.length > LARGE) {
    try {
      const { importQueue } = require('../../queues/index');
      const job = await importQueue().add('import', {
        customerId: req.customer.id, listId: list.id, rows,
      });
      return res.status(202).json({ queued: true, jobId: job.id, queue: 'subscriber-import', total: rows.length });
    } catch (err) {
      // Redis/queue unavailable → fall through to synchronous processing.
      console.warn('[import] queue unavailable, importing synchronously:', err.message);
    }
  }

  const result = await processImport({ customerId: req.customer.id, listId: list.id, rows });
  res.json(result);
};

// GET /api/v1/jobs/:queue/:jobId — poll a background job's status/progress.
exports.jobStatus = async (req, res) => {
  const queueMap = {
    'subscriber-import': 'importQueue',
    'campaign-send': 'campaignQueue',
    'email-verification': 'verificationQueue',
  };
  const getter = queueMap[req.params.queue];
  if (!getter) return res.status(404).json({ message: 'Unknown queue.' });
  try {
    const queues = require('../../queues/index');
    const job = await queues[getter]().getJob(req.params.jobId);
    if (!job) return res.status(404).json({ message: 'Job not found.' });
    const state = await job.getState();
    res.json({ id: job.id, state, progress: job.progress || 0, result: job.returnvalue || null, failedReason: job.failedReason || null });
  } catch {
    res.status(503).json({ message: 'Job queue unavailable.' });
  }
};

exports.exportSubscribers = async (req, res) => {
  const list = await findList(req, req.params.uid);
  if (!list) return res.status(404).json({ message: 'List not found.' });

  const subscribers = await safeFindMany(() => prisma.subscriber.findMany({
    where: { customer_id: req.customer.id, mail_list_id: list.id },
    orderBy: { created_at: 'desc' },
  }));

  const escapeCsv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const rows = [
    ['email', 'first_name', 'last_name', 'status', 'created_at'].join(','),
    ...subscribers.map((subscriber) => [
      subscriber.email,
      subscriber.first_name,
      subscriber.last_name,
      subscriber.status,
      subscriber.created_at?.toISOString?.() || '',
    ].map(escapeCsv).join(',')),
  ];

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${list.uid}-subscribers.csv"`);
  res.send(rows.join('\n'));
};

exports.publicSubscribe = [
  body('list_uid').notEmpty().withMessage('List UID is required'),
  body('EMAIL').optional().isEmail().withMessage('Valid email is required'),
  body('email').optional().isEmail().withMessage('Valid email is required'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const email = req.body.EMAIL || req.body.email;
    if (!email) return res.status(422).json({ message: 'Email is required.' });

    const list = await prisma.mailList.findFirst({ where: { uid: req.body.list_uid } });
    if (!list) return res.status(404).json({ message: 'List not found.' });

    const existing = await prisma.subscriber.findFirst({
      where: { customer_id: list.customer_id, mail_list_id: list.id, email },
    });

    const subscriber = existing || await prisma.subscriber.create({
      data: {
        uid: uuidv4(),
        customer_id: list.customer_id,
        mail_list_id: list.id,
        email,
        first_name: req.body.FIRST_NAME || req.body.first_name,
        last_name: req.body.LAST_NAME || req.body.last_name,
        status: 'subscribed',
      },
    });

    // Persist any custom list-field values submitted by the form (matched by tag).
    // EMAIL/FIRST_NAME/LAST_NAME map to subscriber columns and are skipped here.
    const SYSTEM_TAGS = new Set(['EMAIL', 'FIRST_NAME', 'LAST_NAME', 'email', 'first_name', 'last_name', 'list_uid']);
    const fields = await prisma.listField.findMany({ where: { mail_list_id: list.id } });
    await Promise.all(fields
      .filter((f) => !SYSTEM_TAGS.has(f.tag) && req.body[f.tag] !== undefined)
      .map((f) => prisma.subscriberFieldValue.upsert({
        where: { subscriber_id_list_field_id: { subscriber_id: subscriber.id, list_field_id: f.id } },
        update: { value: String(req.body[f.tag] ?? '') },
        create: { subscriber_id: subscriber.id, list_field_id: f.id, value: String(req.body[f.tag] ?? '') },
      })));

    if (existing) return res.json({ subscriber, message: 'Subscriber already exists.' });
    res.status(201).json({ subscriber, message: 'Subscriber created.' });
  },
];
