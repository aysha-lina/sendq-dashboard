const dns = require('dns').promises;
const prisma = require('../../config/database.config');
const { verifyEmail } = require('../verification/verify.service');

// ─── Generic customer-scoped CRUD factory ───────────────────────────────────────
// Mirrors the admin makeCrud factory but scopes every query to the authenticated
// customer (req.customer.id). Used to clone the customer Sending module resources.
const pick = (body, fields, numeric = []) => fields.reduce((data, field) => {
  if (body[field] === undefined) return data;
  if (numeric.includes(field)) {
    const n = Number(body[field]);
    data[field] = Number.isNaN(n) ? null : n;
  } else {
    data[field] = body[field] === '' ? null : body[field];
  }
  return data;
}, {});

const customerCrud = (getModel, {
  label = 'Record',
  fields = [],
  required = [],
  numeric = [],
  defaults = {},
  scoped = true,
  orderBy = { created_at: 'desc' },
} = {}) => {
  const scopeWhere = (req, extra = {}) => (scoped ? { customer_id: req.customer.id, ...extra } : extra);

  return {
    list: async (req, res) => {
      const data = await getModel().findMany({ where: scopeWhere(req), orderBy });
      res.json({ data });
    },

    create: async (req, res) => {
      const missing = required.filter((field) => !String(req.body[field] ?? '').trim());
      if (missing.length) {
        return res.status(422).json({ message: `${missing.join(', ')} ${missing.length > 1 ? 'are' : 'is'} required.` });
      }
      const data = { ...defaults, ...pick(req.body, fields, numeric) };
      if (scoped) data.customer_id = req.customer.id;
      const record = await getModel().create({ data });
      res.status(201).json(record);
    },

    update: async (req, res) => {
      const id = Number(req.params.id);
      const existing = await getModel().findFirst({ where: scopeWhere(req, { id }) });
      if (!existing) return res.status(404).json({ message: `${label} not found.` });
      const record = await getModel().update({ where: { id }, data: pick(req.body, fields, numeric) });
      res.json(record);
    },

    remove: async (req, res) => {
      const id = Number(req.params.id);
      const existing = await getModel().findFirst({ where: scopeWhere(req, { id }) });
      if (!existing) return res.status(404).json({ message: `${label} not found.` });
      await getModel().delete({ where: { id } });
      res.json({ message: `${label} deleted.` });
    },
  };
};

// ─── Sending servers (customer SMTP/SES config) ──────────────────────────────────
const serverFields = [
  'name', 'type', 'host', 'smtp_port', 'smtp_username', 'smtp_password', 'smtp_protocol',
  'aws_access_key_id', 'aws_secret_access_key', 'aws_region', 'status', 'custom_order',
];
const serverCrud = customerCrud(() => prisma.sendingServer, {
  label: 'Sending server',
  fields: serverFields,
  required: ['name', 'type'],
  numeric: ['smtp_port', 'custom_order'],
  defaults: { type: 'smtp', status: 'active', smtp_protocol: 'tls' },
  orderBy: [{ custom_order: 'asc' }, { id: 'asc' }],
});
exports.sendingServers = serverCrud.list;
exports.createSendingServer = serverCrud.create;
exports.updateSendingServer = serverCrud.update;
exports.deleteSendingServer = serverCrud.remove;

// Verify an SMTP/SES server can connect + authenticate.
exports.testSendingServer = async (req, res) => {
  const id = Number(req.params.id);
  const server = await prisma.sendingServer.findFirst({ where: { id, customer_id: req.customer.id } });
  if (!server) return res.status(404).json({ message: 'Sending server not found.' });
  const { providerFromServer } = require('../email-engine/mail.dispatcher');
  const { createTransport } = require('../email-engine/smtp.factory');
  try {
    const transport = createTransport(providerFromServer(server));
    await transport.verify();
    res.json({ ok: true, message: 'Connection successful.' });
  } catch (err) {
    res.status(422).json({ ok: false, message: err.message || 'Connection failed.' });
  }
};

// ─── Tracking domains (clone of TrackingDomainController) ─────────────────────────
const trackingCrud = customerCrud(() => prisma.trackingDomain, {
  label: 'Tracking domain',
  fields: ['name', 'scheme', 'verification_method', 'status'],
  required: ['name'],
  defaults: { status: 'unverified', scheme: 'http', verification_method: 'dns' },
});
exports.trackingDomains = trackingCrud.list;
exports.createTrackingDomain = async (req, res) => {
  const name = String(req.body.name || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!name) return res.status(422).json({ message: 'Domain name is required.' });
  const existing = await prisma.trackingDomain.findFirst({ where: { name, customer_id: req.customer.id } });
  if (existing) return res.status(409).json({ message: 'This tracking domain has already been added.' });
  const record = await prisma.trackingDomain.create({
    data: {
      customer_id: req.customer.id,
      name,
      scheme: req.body.scheme || 'http',
      verification_method: req.body.verification_method || 'host_redirect',
      status: 'unverified',
    },
  });
  res.status(201).json(record);
};
exports.deleteTrackingDomain = trackingCrud.remove;
exports.verifyTrackingDomain = async (req, res) => {
  const id = Number(req.params.id);
  const domain = await prisma.trackingDomain.findFirst({ where: { id, customer_id: req.customer.id } });
  if (!domain) return res.status(404).json({ message: 'Tracking domain not found.' });
  let verified = false;
  try {
    // A tracking domain is verified when it CNAMEs to our tracking host.
    const records = await dns.resolveCname(domain.name);
    verified = records.length > 0;
  } catch {
    try {
      // Fall back to any A record so a manually-pointed host still verifies.
      const a = await dns.resolve4(domain.name);
      verified = a.length > 0;
    } catch {}
  }
  const updated = await prisma.trackingDomain.update({
    where: { id },
    data: { status: verified ? 'verified' : 'unverified' },
  });
  res.json(updated);
};

// ─── Signatures (clone of SignatureController) ───────────────────────────────────
const signatureCrud = customerCrud(() => prisma.signature, {
  label: 'Signature',
  fields: ['name', 'content', 'status', 'is_default'],
  required: ['name', 'content'],
  defaults: { status: 'active', is_default: false },
});
exports.signatures = signatureCrud.list;
exports.createSignature = async (req, res) => {
  if (!String(req.body.name || '').trim()) return res.status(422).json({ message: 'Name is required.' });
  if (!String(req.body.content || '').trim()) return res.status(422).json({ message: 'Content is required.' });
  const isDefault = req.body.is_default === true || req.body.is_default === 'true';
  if (isDefault) {
    await prisma.signature.updateMany({ where: { customer_id: req.customer.id }, data: { is_default: false } });
  }
  const record = await prisma.signature.create({
    data: {
      customer_id: req.customer.id,
      name: req.body.name.trim(),
      content: req.body.content,
      status: req.body.status || 'active',
      is_default: isDefault,
    },
  });
  res.status(201).json(record);
};
exports.updateSignature = async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.signature.findFirst({ where: { id, customer_id: req.customer.id } });
  if (!existing) return res.status(404).json({ message: 'Signature not found.' });
  const isDefault = req.body.is_default === true || req.body.is_default === 'true';
  if (isDefault) {
    await prisma.signature.updateMany({ where: { customer_id: req.customer.id, NOT: { id } }, data: { is_default: false } });
  }
  const data = {};
  if (req.body.name !== undefined) data.name = String(req.body.name).trim();
  if (req.body.content !== undefined) data.content = req.body.content;
  if (req.body.status !== undefined) data.status = req.body.status;
  if (req.body.is_default !== undefined) data.is_default = isDefault;
  const record = await prisma.signature.update({ where: { id }, data });
  res.json(record);
};
exports.deleteSignature = signatureCrud.remove;

// ─── Email verification servers (clone of EmailVerificationServerController) ──────
const evsCrud = customerCrud(() => prisma.emailVerificationServer, {
  label: 'Verification server',
  fields: ['name', 'type', 'options', 'status'],
  required: ['name', 'type'],
  defaults: { status: 'active' },
});
exports.verificationServers = evsCrud.list;
exports.deleteVerificationServer = evsCrud.remove;

// The PHP form stores api_key + checking-limit settings inside an `options` JSON blob.
const buildEvsOptions = (body, prev = {}) => JSON.stringify({
  api_key: body.api_key ?? prev.api_key ?? '',
  limit_value: body.limit_value ?? prev.limit_value ?? '',
  limit_base: body.limit_base ?? prev.limit_base ?? '',
  limit_unit: body.limit_unit ?? prev.limit_unit ?? '',
});

exports.verificationServerDetail = async (req, res) => {
  const id = Number(req.params.id);
  const s = await prisma.emailVerificationServer.findFirst({ where: { id, customer_id: req.customer.id } });
  if (!s) return res.status(404).json({ message: 'Verification server not found.' });
  let options = {};
  try { options = s.options ? JSON.parse(s.options) : {}; } catch { options = {}; }
  res.json({ ...s, options });
};

exports.createVerificationServer = async (req, res) => {
  const name = String(req.body.name || '').trim();
  const type = String(req.body.type || '').trim();
  if (!name) return res.status(422).json({ message: 'Name is required.' });
  if (!type) return res.status(422).json({ message: 'Service type is required.' });
  const record = await prisma.emailVerificationServer.create({
    data: { name, type, options: buildEvsOptions(req.body), status: req.body.status || 'active', customer_id: req.customer.id },
  });
  res.status(201).json(record);
};

exports.updateVerificationServer = async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.emailVerificationServer.findFirst({ where: { id, customer_id: req.customer.id } });
  if (!existing) return res.status(404).json({ message: 'Verification server not found.' });
  let prev = {};
  try { prev = existing.options ? JSON.parse(existing.options) : {}; } catch { prev = {}; }
  const data = { options: buildEvsOptions(req.body, prev) };
  if (req.body.name !== undefined) data.name = String(req.body.name).trim();
  if (req.body.type !== undefined) data.type = String(req.body.type).trim();
  if (req.body.status !== undefined) data.status = req.body.status;
  const record = await prisma.emailVerificationServer.update({ where: { id }, data });
  res.json(record);
};

// Verify a single email immediately (built-in verifier or a chosen server).
exports.verifyEmailNow = async (req, res) => {
  const email = String(req.body.email || '').trim();
  if (!email) return res.status(422).json({ message: 'Email is required.' });
  let server = null;
  if (req.body.server_id) {
    server = await prisma.emailVerificationServer.findFirst({
      where: { id: Number(req.body.server_id), customer_id: req.customer.id },
    });
  }
  res.json(await verifyEmail(email, server));
};

// Resolve an optional list_uid in the body to a customer-scoped list id.
const resolveVerifyListId = async (req) => {
  const uid = req.body.list_uid || req.query.list_uid;
  if (!uid) return { listId: null };
  const list = await prisma.mailList.findFirst({ where: { uid, customer_id: req.customer.id } });
  if (!list) return { error: 'List not found.' };
  return { listId: list.id };
};

// Start a background verification run over the customer's (unverified) subscribers,
// optionally scoped to a single list (list_uid).
exports.verifyRun = async (req, res) => {
  let server = null;
  if (req.body.server_id) {
    server = await prisma.emailVerificationServer.findFirst({
      where: { id: Number(req.body.server_id), customer_id: req.customer.id },
    });
    if (!server) return res.status(404).json({ message: 'Verification server not found.' });
  }
  const { listId, error } = await resolveVerifyListId(req);
  if (error) return res.status(404).json({ message: error });
  try {
    const { verificationQueue } = require('../../queues/index');
    const job = await verificationQueue().add('verify', { customerId: req.customer.id, serverId: server?.id || null, listId });
    res.status(202).json({ queued: true, jobId: job.id, queue: 'email-verification' });
  } catch {
    res.status(503).json({ message: 'Verification queue unavailable (is Redis running?).' });
  }
};

// Reset verification results for the customer's subscribers (optionally one list).
exports.verifyReset = async (req, res) => {
  const { listId, error } = await resolveVerifyListId(req);
  if (error) return res.status(404).json({ message: error });
  const result = await prisma.subscriber.updateMany({
    where: { customer_id: req.customer.id, ...(listId ? { mail_list_id: listId } : {}) },
    data: { verification_status: null },
  });
  res.json({ message: `Reset verification for ${result.count} subscriber(s).`, count: result.count });
};

// Verification progress/stats for the customer (optionally one list).
exports.verifyStats = async (req, res) => {
  const { listId, error } = await resolveVerifyListId(req);
  if (error) return res.status(404).json({ message: error });
  const where = { customer_id: req.customer.id, ...(listId ? { mail_list_id: listId } : {}) };
  const [total, deliverable, undeliverable, risky, unknown, pending] = await Promise.all([
    prisma.subscriber.count({ where }),
    prisma.subscriber.count({ where: { ...where, verification_status: 'deliverable' } }),
    prisma.subscriber.count({ where: { ...where, verification_status: 'undeliverable' } }),
    prisma.subscriber.count({ where: { ...where, verification_status: 'risky' } }),
    prisma.subscriber.count({ where: { ...where, verification_status: 'unknown' } }),
    prisma.subscriber.count({ where: { ...where, OR: [{ verification_status: null }, { verification_status: 'unverified' }] } }),
  ]);
  const verified = deliverable + undeliverable + risky + unknown;
  res.json({
    total, deliverable, undeliverable, risky, unknown, pending, verified,
    percent: total ? Math.round((verified / total) * 100) : 0,
  });
};

// ─── Blacklist (per-customer suppression list — scoped by customer_id, BUG-5) ─────
// Raw SQL: the live client predates the customer_id column (Prisma regen is blocked
// while nodemon holds the engine DLL), so we scope explicitly here.
exports.blacklist = async (req, res) => {
  const data = await prisma.$queryRawUnsafe(
    'SELECT id, email, reason, created_at FROM sendq_blacklists WHERE customer_id = ? ORDER BY created_at DESC LIMIT 500',
    req.customer.id,
  );
  res.json({ data });
};
exports.createBlacklist = async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!email) return res.status(422).json({ message: 'Email is required.' });
  const existing = await prisma.$queryRawUnsafe(
    'SELECT id FROM sendq_blacklists WHERE customer_id = ? AND email = ? LIMIT 1', req.customer.id, email,
  );
  if (existing.length) return res.status(409).json({ message: 'This email is already blacklisted.' });
  await prisma.$executeRawUnsafe(
    'INSERT INTO sendq_blacklists (customer_id, email, reason, created_at) VALUES (?, ?, ?, NOW(3))',
    req.customer.id, email, req.body.reason || null,
  );
  res.status(201).json({ email, reason: req.body.reason || null });
};
exports.deleteBlacklist = async (req, res) => {
  const id = Number(req.params.id);
  // Scoped delete: a customer can only remove their OWN entries.
  const affected = await prisma.$executeRawUnsafe(
    'DELETE FROM sendq_blacklists WHERE id = ? AND customer_id = ?', id, req.customer.id,
  );
  if (!affected) return res.status(404).json({ message: 'Blacklist entry not found.' });
  res.json({ message: 'Blacklist entry deleted.' });
};
exports.importBlacklist = async (req, res) => {
  // Accept newline/comma separated emails in req.body.emails (string) or array.
  const raw = req.body.emails;
  const list = Array.isArray(raw) ? raw : String(raw || '').split(/[\s,;]+/);
  const emails = [...new Set(list.map((e) => String(e).trim().toLowerCase()).filter(Boolean))];
  if (!emails.length) return res.status(422).json({ message: 'No emails to import.' });
  let imported = 0;
  for (const email of emails) {
    // INSERT IGNORE de-dupes against the (customer_id, email) unique key.
    const r = await prisma.$executeRawUnsafe(
      'INSERT IGNORE INTO sendq_blacklists (customer_id, email, reason, created_at) VALUES (?, ?, ?, NOW(3))',
      req.customer.id, email, req.body.reason || 'Imported',
    );
    imported += Number(r) || 0;
  }
  res.json({ message: `Imported ${imported} of ${emails.length} addresses.`, imported, total: emails.length });
};

// ─── Sending-domain authentication check (SPF / DKIM / DMARC) ─────────────────────
// Live DNS lookup so the campaign wizard can warn before a user sends from an
// unauthenticated domain (which Gmail/Outlook spam-file). Falls back to public
// resolvers if the OS resolver refuses (restricted networks).
const RESTRICTED = ['ECONNREFUSED', 'ESERVFAIL', 'ETIMEOUT', 'EREFUSED'];
const withFallback = (method) => async (name) => {
  try { return await dns[method](name); }
  catch (e) {
    if (RESTRICTED.includes(e.code)) {
      try {
        const r = new (require('dns').promises.Resolver)();
        r.setServers(['8.8.8.8', '1.1.1.1']);
        return await r[method](name);
      } catch { return []; }
    }
    return [];
  }
};
const txtLookup = async (name) => (await withFallback('resolveTxt')(name)).map((a) => (Array.isArray(a) ? a.join('') : a));
const cnameLookup = withFallback('resolveCname');
const DKIM_SELECTORS = ['hostingermail1', 'hostingermail2', 'hostingermail3', 'default', 'google', 'selector1', 'selector2', 's1', 's2', 'k1', 'dkim', 'mail', 'smtp'];

exports.checkDomainAuth = async (req, res) => {
  const raw = String(req.query.email || req.query.domain || '').trim();
  const domain = (raw.includes('@') ? raw.split('@')[1] : raw).toLowerCase();
  if (!domain || !domain.includes('.')) return res.status(422).json({ message: 'Provide a valid email or domain.' });

  const [spfRecords, dmarcRecords, dkimHits] = await Promise.all([
    txtLookup(domain),
    txtLookup(`_dmarc.${domain}`),
    Promise.all(DKIM_SELECTORS.map(async (sel) => {
      const base = `${sel}._domainkey.${domain}`;
      const c = await cnameLookup(base);
      if (Array.isArray(c) && c.length) return sel;
      const t = await txtLookup(base);
      return t.some((r) => /v=dkim1|p=[A-Za-z0-9]/i.test(r)) ? sel : null;
    })),
  ]);

  const spf = spfRecords.find((r) => /^v=spf1/i.test(r)) || null;
  const dmarc = dmarcRecords.find((r) => /^v=dmarc1/i.test(r)) || null;
  const dkimSelector = dkimHits.find(Boolean) || null;

  const spfOk = Boolean(spf);
  const dkimOk = Boolean(dkimSelector);
  const dmarcOk = Boolean(dmarc);
  const level = spfOk && dkimOk ? 'good' : spfOk ? 'warn' : 'bad';

  res.json({
    domain,
    spf: { ok: spfOk, value: spf },
    dkim: { ok: dkimOk, selector: dkimSelector },
    dmarc: { ok: dmarcOk, value: dmarc },
    level,
    ok: spfOk && dkimOk,
  });
};
