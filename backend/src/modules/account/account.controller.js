const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const prisma = require('../../config/database.config');
const { attachAccess } = require('../auth/rbac');
const { sanitizeUser } = require('../auth/auth.middleware');
const { getTokenVersion, bumpTokenVersion } = require('../auth/token-version');
const twofa = require('../auth/twofa.service');

// Issue a fresh JWT embedding the current token_version (used after a password
// change so the current session keeps working while older tokens are revoked).
const freshToken = async (userId) =>
  jwt.sign({ id: userId, tv: await getTokenVersion(userId) }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

const isMissingTableError = (err) => (
  err?.code === 'P2021' ||
  err?.original?.code === 'ER_NO_SUCH_TABLE' ||
  err?.message?.includes('does not exist') ||
  err?.message?.includes("doesn't exist")
);

const baseUserSelect = {
  id: true,
  uid: true,
  email: true,
  status: true,
  first_name: true,
  last_name: true,
  image: true,
  created_at: true,
  updated_at: true,
  customer: true,
};

const userSelect = {
  ...baseUserSelect,
  roles: {
    include: {
      role: {
        include: {
          rolePermissions: true,
        },
      },
    },
  },
  admins: {
    include: {
      adminGroup: true,
    },
  },
};

const normalizeUser = async (user) => attachAccess(sanitizeUser(user));

const getCustomerId = (req) => req.customer?.id || req.user?.customer?.id || null;

const findUserForAccount = async (id) => {
  try {
    return await prisma.user.findUnique({
      where: { id },
      select: userSelect,
    });
  } catch (err) {
    if (!isMissingTableError(err)) throw err;
    return prisma.user.findUnique({
      where: { id },
      select: baseUserSelect,
    });
  }
};

const listUsersForAccount = async (where, fallbackUserId) => {
  try {
    return await prisma.user.findMany({
      where,
      select: userSelect,
      orderBy: { created_at: 'asc' },
    });
  } catch (err) {
    if (!isMissingTableError(err)) throw err;
    return prisma.user.findMany({
      where: { id: fallbackUserId },
      select: baseUserSelect,
      orderBy: { created_at: 'asc' },
    });
  }
};

const safeCount = async (delegate) => {
  try {
    return await delegate.count();
  } catch (err) {
    if (isMissingTableError(err)) return 0;
    throw err;
  }
};

const safeCountQuery = async (query) => {
  try {
    return await query();
  } catch (err) {
    if (isMissingTableError(err)) return 0;
    throw err;
  }
};

const safeFindMany = async (query) => {
  try {
    return await query();
  } catch (err) {
    if (isMissingTableError(err)) return [];
    throw err;
  }
};

exports.overview = async (req, res, next) => {
  try {
    const user = await findUserForAccount(req.user.id);

    const customerId = getCustomerId(req);
    const [campaigns, lists, subscribers, subscriptions] = await Promise.all([
      customerId ? safeCountQuery(() => prisma.campaign.count({ where: { customer_id: customerId } })) : 0,
      customerId ? safeCountQuery(() => prisma.mailList.count({ where: { customer_id: customerId } })) : 0,
      customerId ? safeCountQuery(() => prisma.subscriber.count({ where: { customer_id: customerId } })) : 0,
      customerId
        ? safeFindMany(() => prisma.subscription.findMany({
            where: { customer_id: customerId },
            include: { plan: true },
            orderBy: { created_at: 'desc' },
          }))
        : [],
    ]);

    res.json({
      user: await normalizeUser(user),
      usage: {
        campaigns,
        lists,
        subscribers,
      },
      subscriptions,
    });
  } catch (err) {
    next(err);
  }
};

exports.updateProfile = [
  body('first_name').trim().notEmpty().withMessage('First name required'),
  body('last_name').trim().notEmpty().withMessage('Last name required'),
  body('timezone').optional().trim(),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    try {
      const { first_name, last_name, timezone } = req.body;
      const customerData = { first_name, last_name };
      if (timezone) customerData.timezone = timezone;

      const user = await prisma.user.update({
        where: { id: req.user.id },
        data: {
          first_name,
          last_name,
          customer: req.customer
            ? { update: customerData }
            : {
                create: {
                  uid: uuidv4(),
                  first_name,
                  last_name,
                  timezone: timezone || 'UTC',
                  status: 'active',
                },
              },
        },
        include: { customer: true },
      });

      res.json({ user: await normalizeUser(user), message: 'Profile updated.' });
    } catch (err) {
      next(err);
    }
  },
];

exports.updateContact = [
  body('email').isEmail().withMessage('Valid email required'),
  body('first_name').trim().notEmpty().withMessage('First name required'),
  body('last_name').trim().notEmpty().withMessage('Last name required'),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    try {
      const { email, first_name, last_name } = req.body;
      const existing = await prisma.user.findFirst({
        where: { email, NOT: { id: req.user.id } },
      });
      if (existing) return res.status(422).json({ message: 'Email already registered.' });

      // Extra contact fields (added additively to sendq_customers).
      const contactFields = ['company', 'phone', 'address', 'city', 'state', 'zip', 'country', 'website', 'tax_number'];
      const contactData = contactFields.reduce((acc, key) => {
        if (req.body[key] !== undefined) acc[key] = req.body[key] === '' ? null : req.body[key];
        return acc;
      }, {});

      const user = await prisma.user.update({
        where: { id: req.user.id },
        data: {
          email,
          first_name,
          last_name,
          customer: req.customer
            ? { update: { first_name, last_name, ...contactData } }
            : {
                create: {
                  uid: uuidv4(),
                  first_name,
                  last_name,
                  timezone: 'UTC',
                  status: 'active',
                  ...contactData,
                },
              },
        },
        include: { customer: true },
      });

      res.json({ user: await normalizeUser(user), message: 'Contact information updated.' });
    } catch (err) {
      next(err);
    }
  },
];

exports.users = async (req, res, next) => {
  try {
    const customerId = getCustomerId(req);
    const users = await listUsersForAccount(customerId
      ? {
          OR: [
            { id: req.user.id },
            { customer: { id: customerId } },
            { roles: { some: { role: { customer_id: customerId } } } },
          ],
        }
      : { id: req.user.id }, req.user.id);

    res.json({ users: await Promise.all(users.map(normalizeUser)) });
  } catch (err) {
    next(err);
  }
};

exports.createUser = [
  body('email').isEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('first_name').trim().notEmpty().withMessage('First name required'),
  body('last_name').trim().notEmpty().withMessage('Last name required'),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    try {
      const { email, password, first_name, last_name, role_code = 'user' } = req.body;
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) return res.status(422).json({ message: 'Email already registered.' });

      let role = null;
      try {
        role = await prisma.role.findFirst({ where: { code: role_code, status: 'active' } });
      } catch (err) {
        if (!isMissingTableError(err)) throw err;
      }
      const user = await prisma.user.create({
        data: {
          uid: uuidv4(),
          email,
          password: await bcrypt.hash(password, 12),
          api_token: uuidv4().replace(/-/g, '').substring(0, 60),
          status: 'active',
          first_name,
          last_name,
          roles: role ? { create: { role_id: role.id } } : undefined,
        },
        select: role ? userSelect : baseUserSelect,
      });

      res.status(201).json({ user: await normalizeUser(user), message: 'User created.' });
    } catch (err) {
      next(err);
    }
  },
];

// Resolve a target user (by uid) that belongs to the requester's account.
const findAccountUser = async (req) => {
  const customerId = getCustomerId(req);
  const scope = customerId
    ? { OR: [{ customer: { id: customerId } }, { roles: { some: { role: { customer_id: customerId } } } }] }
    : { id: req.user.id };
  return prisma.user.findFirst({ where: { uid: req.params.uid, ...scope } });
};

exports.updateUser = [
  body('email').optional().isEmail().withMessage('Valid email required'),
  body('password').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('first_name').optional().trim().notEmpty().withMessage('First name required'),
  body('last_name').optional().trim().notEmpty().withMessage('Last name required'),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
    try {
      const target = await findAccountUser(req);
      if (!target) return res.status(404).json({ message: 'User not found.' });

      const data = {};
      ['first_name', 'last_name', 'status'].forEach((f) => { if (req.body[f] !== undefined) data[f] = req.body[f]; });
      if (req.body.email !== undefined && req.body.email !== target.email) {
        const dupe = await prisma.user.findUnique({ where: { email: req.body.email } });
        if (dupe) return res.status(422).json({ message: 'Email already registered.' });
        data.email = req.body.email;
      }
      if (req.body.password) data.password = await bcrypt.hash(req.body.password, 12);

      const user = await prisma.user.update({ where: { id: target.id }, data, select: baseUserSelect });
      res.json({ user: await normalizeUser(user), message: 'User updated.' });
    } catch (err) {
      next(err);
    }
  },
];

exports.deleteUser = async (req, res, next) => {
  try {
    const target = await findAccountUser(req);
    if (!target) return res.status(404).json({ message: 'User not found.' });
    if (target.id === req.user.id) return res.status(422).json({ message: 'You cannot delete your own account.' });

    // Detach role links first (if the pivot exists) so the delete doesn't hit an FK.
    try { await prisma.user.update({ where: { id: target.id }, data: { roles: { deleteMany: {} } } }); } catch { /* relation optional */ }
    await prisma.user.delete({ where: { id: target.id } });
    res.json({ message: 'User deleted.' });
  } catch (err) {
    next(err);
  }
};

exports.roles = async (req, res, next) => {
  try {
    const customerId = getCustomerId(req);
    let roles = [];
    try {
      roles = await prisma.role.findMany({
        where: {
          OR: [
            { is_global: true },
            ...(customerId ? [{ customer_id: customerId }] : []),
          ],
        },
        include: { rolePermissions: true },
        orderBy: [{ readonly: 'desc' }, { name: 'asc' }],
      });
    } catch (err) {
      if (!isMissingTableError(err)) throw err;
    }

    res.json({ roles });
  } catch (err) {
    next(err);
  }
};

exports.subscription = async (req, res, next) => {
  try {
    const customerId = getCustomerId(req);
    const subscriptions = customerId
      ? await safeFindMany(() => prisma.subscription.findMany({
          where: { customer_id: customerId },
          include: { plan: true },
          orderBy: { created_at: 'desc' },
        }))
      : [];
    const plans = await safeFindMany(() => prisma.plan.findMany({ orderBy: { id: 'asc' } }));

    res.json({ subscriptions, plans });
  } catch (err) {
    next(err);
  }
};

exports.logs = async (req, res, next) => {
  try {
    const customerId = getCustomerId(req);
    if (!customerId) return res.json({ logs: [] });

    const [campaigns, lists, subscribers] = await Promise.all([
      prisma.campaign.findMany({
        where: { customer_id: customerId },
        select: { uid: true, name: true, status: true, created_at: true, updated_at: true },
        orderBy: { updated_at: 'desc' },
        take: 10,
      }),
      prisma.mailList.findMany({
        where: { customer_id: customerId },
        select: { uid: true, name: true, created_at: true, updated_at: true },
        orderBy: { updated_at: 'desc' },
        take: 10,
      }),
      prisma.subscriber.findMany({
        where: { customer_id: customerId },
        select: { uid: true, email: true, status: true, created_at: true, updated_at: true },
        orderBy: { updated_at: 'desc' },
        take: 10,
      }),
    ]);

    const logs = [
      ...campaigns.map((item) => ({
        type: 'campaign',
        title: item.name,
        message: `Campaign status: ${item.status}`,
        created_at: item.updated_at || item.created_at,
      })),
      ...lists.map((item) => ({
        type: 'list',
        title: item.name,
        message: 'List record updated',
        created_at: item.updated_at || item.created_at,
      })),
      ...subscribers.map((item) => ({
        type: 'subscriber',
        title: item.email,
        message: `Subscriber status: ${item.status}`,
        created_at: item.updated_at || item.created_at,
      })),
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json({ logs });
  } catch (err) {
    next(err);
  }
};

exports.admin = async (req, res, next) => {
  try {
    const [users, admins, customers, roles, plans, subscriptions, campaigns, lists, subscribers] = await Promise.all([
      safeCount(prisma.user),
      safeCount(prisma.admin),
      safeCount(prisma.customer),
      safeCount(prisma.role),
      safeCount(prisma.plan),
      safeCount(prisma.subscription),
      safeCount(prisma.campaign),
      safeCount(prisma.mailList),
      safeCount(prisma.subscriber),
    ]);

    const adminGroups = await prisma.adminGroup.findMany({
      select: { id: true, name: true, custom_order: true, created_at: true },
      orderBy: { custom_order: 'asc' },
    }).catch(() => []);

    res.json({
      summary: { users, admins, customers, roles, plans, subscriptions, campaigns, lists, subscribers },
      adminGroups,
    });
  } catch (err) {
    next(err);
  }
};

// ─── Change password ─────────────────────────────────────────────────────────────
exports.changePassword = [
  body('current_password').notEmpty().withMessage('Current password is required'),
  body('new_password').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
    try {
      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (!user || !(await bcrypt.compare(req.body.current_password, user.password))) {
        return res.status(422).json({ message: 'Current password is incorrect.' });
      }
      if (req.body.current_password === req.body.new_password) {
        return res.status(422).json({ message: 'New password must be different from the current one.' });
      }
      await prisma.user.update({
        where: { id: req.user.id },
        data: { password: await bcrypt.hash(req.body.new_password, 12) },
      });
      // Revoke all existing sessions, then hand back a fresh token so THIS session
      // keeps working (other devices are logged out).
      await bumpTokenVersion(req.user.id);
      res.json({ message: 'Password changed successfully.', token: await freshToken(req.user.id) });
    } catch (err) {
      next(err);
    }
  },
];

// POST /account/logout-all — revoke every issued token for the current user
// (this session included). The client should then clear its token + re-login.
exports.logoutAll = async (req, res, next) => {
  try {
    await bumpTokenVersion(req.user.id);
    res.json({ message: 'Signed out of all devices.' });
  } catch (err) {
    next(err);
  }
};

// ─── Avatar upload / remove ──────────────────────────────────────────────────────
// `upload.middleware` has already parsed the file and set req.file.
exports.uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file) return res.status(422).json({ message: 'No image uploaded.' });
    const imagePath = `/uploads/avatars/${req.file.filename}`;
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        image: imagePath,
        ...(req.customer ? { customer: { update: { image: imagePath } } } : {}),
      },
      include: { customer: true },
    });
    res.json({ user: await normalizeUser(user), image: imagePath, message: 'Profile image updated.' });
  } catch (err) {
    next(err);
  }
};

exports.removeAvatar = async (req, res, next) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        image: null,
        ...(req.customer ? { customer: { update: { image: null } } } : {}),
      },
      include: { customer: true },
    });
    res.json({ user: await normalizeUser(user), message: 'Profile image removed.' });
  } catch (err) {
    next(err);
  }
};

// ─── Two-factor authentication ────────────────────────────────────────────────────
exports.twoFactorStatus = async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  res.json({ enabled: user.two_factor_enabled, method: user.two_factor_method || null });
};

// Begin setup for a method. TOTP → return secret + QR (not enabled until confirmed).
exports.twoFactorSetup = async (req, res) => {
  const method = req.body.method === 'totp' ? 'totp' : 'email';
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });

  if (method === 'totp') {
    const secret = twofa.generateTotpSecret();
    await prisma.user.update({ where: { id: user.id }, data: { two_factor_method: 'totp', two_factor_secret: secret, two_factor_enabled: false } });
    const otpauth = twofa.totpAuthUri(user.email, secret);
    return res.json({ method: 'totp', secret, otpauth, qr: await twofa.qrDataUrl(otpauth) });
  }

  await prisma.user.update({ where: { id: user.id }, data: { two_factor_method: 'email', two_factor_secret: null, two_factor_enabled: false } });
  await twofa.sendEmailCode(user);
  res.json({ method: 'email', message: 'A verification code was sent to your email.' });
};

// Confirm the code and turn 2FA on.
exports.twoFactorEnable = async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user.two_factor_method) return res.status(422).json({ message: 'Start 2FA setup first.' });
  const ok = twofa.verifyCode(user, req.body.code, { method: user.two_factor_method, secret: user.two_factor_secret });
  if (!ok) return res.status(422).json({ message: 'Invalid or expired code.' });
  await prisma.user.update({ where: { id: user.id }, data: { two_factor_enabled: true, two_factor_code: null, two_factor_code_expires_at: null } });
  res.json({ enabled: true, method: user.two_factor_method, message: 'Two-factor authentication enabled.' });
};

// Disable 2FA (requires current password).
exports.twoFactorDisable = async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!(await bcrypt.compare(req.body.password || '', user.password))) {
    return res.status(422).json({ message: 'Current password is incorrect.' });
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { two_factor_enabled: false, two_factor_method: null, two_factor_secret: null, two_factor_code: null, two_factor_code_expires_at: null },
  });
  res.json({ enabled: false, message: 'Two-factor authentication disabled.' });
};
