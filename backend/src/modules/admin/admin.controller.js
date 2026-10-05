const prisma = require('../../config/database.config');

const missingSchema = (error) => (
  error?.code === 'P2021' ||
  error?.code === 'P2022' ||
  error?.message?.includes('does not exist') ||
  error?.message?.includes("doesn't exist")
);

const safeRead = async (fallback, reader) => {
  try {
    return await reader();
  } catch (error) {
    if (missingSchema(error)) {
      return fallback;
    }
    throw error;
  }
};

const safeCount = (model) => {
  if (!model?.count) return Promise.resolve(0);
  return safeRead(0, () => model.count());
};

const safeList = (model, options = {}) => {
  if (!model?.findMany) return Promise.resolve([]);
  return safeRead([], () => model.findMany(options));
};

const monthKey = (date) => {
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return null;
  return `${String(value.getMonth() + 1).padStart(2, '0')}/${value.getFullYear()}`;
};

const lastMonthKeys = (count = 5) => {
  const now = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (count - 1 - index), 1);
    return monthKey(date);
  });
};

const buildMonthlyCounts = (rows, count = 5) => {
  const keys = lastMonthKeys(count);
  const totals = new Map(keys.map((key) => [key, 0]));

  rows.forEach((row) => {
    const key = monthKey(row.created_at);
    if (totals.has(key)) {
      totals.set(key, totals.get(key) + 1);
    }
  });

  return keys.map((key) => ({ label: key, value: totals.get(key) || 0 }));
};

const pageMeta = (total, req) => {
  const perPage = Math.min(Math.max(Number(req.query.per_page || 25), 1), 100);
  const page = Math.max(Number(req.query.page || 1), 1);

  return {
    page,
    per_page: perPage,
    total,
    total_pages: Math.max(Math.ceil(total / perPage), 1),
  };
};

const paged = async (req, res, model, options = {}) => {
  const meta = pageMeta(await safeCount(model), req);
  const data = await safeList(model, {
    ...options,
    skip: (meta.page - 1) * meta.per_page,
    take: meta.per_page,
  });

  res.json({ data, pagination: meta });
};

const emptyPaged = (req, res, moduleName) => {
  res.json({
    data: [],
    pagination: pageMeta(0, req),
    message: `${moduleName} has no records in the current database.`,
  });
};

const moduleCards = (summary) => [
  { key: 'users', label: 'Admin users', description: 'Create and manage administrator accounts.', count: summary.admins },
  { key: 'admin-groups', label: 'Admin groups', description: 'Administrator permission groups from the original system.', count: summary.adminGroups },
  { key: 'roles', label: 'Roles & permissions', description: 'RBAC roles and permission assignments.', count: summary.roles },
  { key: 'customers', label: 'Customers', description: 'Tenant/customer accounts.', count: summary.customers },
  { key: 'subscriptions', label: 'Subscriptions', description: 'Customer subscription records.', count: summary.subscriptions },
  { key: 'plans', label: 'Plans', description: 'Plan limits and features.', count: summary.plans },
  { key: 'payments', label: 'Payments', description: 'Payment services and methods.', count: 0 },
  { key: 'sending-servers', label: 'Sending servers', description: 'SMTP and delivery infrastructure administration.', count: 0 },
  { key: 'templates', label: 'Templates & layouts', description: 'System template and layout administration.', count: 0 },
  { key: 'settings', label: 'Settings', description: 'Application settings from the admin area.', count: 0 },
  { key: 'languages', label: 'Languages', description: 'Language packs and translations.', count: 0 },
  { key: 'currencies', label: 'Currencies', description: 'Currency records for billing.', count: 0 },
  { key: 'reports', label: 'Reports', description: 'System and campaign report totals.', count: summary.emailLogs + summary.openLogs + summary.clickLogs + summary.bounceLogs },
  { key: 'logs', label: 'System logs', description: 'Administrative activity and application logs.', count: 0 },
];

exports.dashboard = async (req, res) => {
  const [
    users,
    admins,
    adminGroups,
    roles,
    customers,
    subscriptions,
    plans,
    campaigns,
    lists,
    subscribers,
    emailLogs,
    openLogs,
    clickLogs,
    bounceLogs,
    sendingServers,
    sendingDomains,
    automations,
  ] = await Promise.all([
    safeCount(prisma.user),
    safeCount(prisma.admin),
    safeCount(prisma.adminGroup),
    safeCount(prisma.role),
    safeCount(prisma.customer),
    safeCount(prisma.subscription),
    safeCount(prisma.plan),
    safeCount(prisma.campaign),
    safeCount(prisma.mailList),
    safeCount(prisma.subscriber),
    safeCount(prisma.emailLog),
    safeCount(prisma.openLog),
    safeCount(prisma.clickLog),
    safeCount(prisma.bounceLog),
    safeCount(prisma.sendingServer),
    safeCount(prisma.sendingDomain),
    safeCount(prisma.automation),
  ]);

  const summary = {
    users,
    admins,
    adminGroups,
    roles,
    customers,
    subscriptions,
    plans,
    campaigns,
    lists,
    subscribers,
    emailLogs,
    openLogs,
    clickLogs,
    bounceLogs,
    sendingServers,
    sendingDomains,
    automations,
  };

  const [recentUsers, recentCustomers, recentCampaigns, recentLists, recentSubscriptions] = await Promise.all([
    safeList(prisma.user, {
      orderBy: { created_at: 'desc' },
      take: 5,
      select: { id: true, email: true, first_name: true, last_name: true, status: true, created_at: true },
    }),
    safeList(prisma.customer, {
      orderBy: { created_at: 'desc' },
      take: 5,
      select: { id: true, first_name: true, last_name: true, status: true, created_at: true },
    }),
    safeList(prisma.campaign, {
      orderBy: { created_at: 'desc' },
      take: 5,
      select: { id: true, uid: true, name: true, status: true, created_at: true },
    }),
    safeList(prisma.mailList, {
      orderBy: { created_at: 'desc' },
      take: 5,
      select: { id: true, uid: true, name: true, status: true, created_at: true },
    }),
    safeList(prisma.subscription, {
      orderBy: { created_at: 'desc' },
      take: 5,
      include: { customer: true, plan: true },
    }),
  ]);

  const [customerTimelineRows, subscriptionRows, planRows] = await Promise.all([
    safeList(prisma.customer, {
      select: { id: true, created_at: true },
    }),
    safeList(prisma.subscription, {
      select: { id: true, plan_id: true },
    }),
    safeList(prisma.plan, {
      select: { id: true, name: true },
    }),
  ]);

  const planNames = new Map(planRows.map((plan) => [plan.id, plan.name]));
  const planCounts = subscriptionRows.reduce((map, subscription) => {
    const key = planNames.get(subscription.plan_id) || 'Unknown';
    map.set(key, (map.get(key) || 0) + 1);
    return map;
  }, new Map());

  // Recent activity log (sendq_logs) for the dashboard "Activities" section.
  const activityRows = await safeList(prisma.auditLog, {
    orderBy: { created_at: 'desc' },
    take: 12,
    include: { customer: { select: { first_name: true, last_name: true } } },
  });
  const activities = activityRows.map((log) => ({
    type: log.type,
    name: log.name,
    actor: log.customer ? `${log.customer.first_name || ''} ${log.customer.last_name || ''}`.trim() : 'System',
    created_at: log.created_at,
  }));

  res.json({
    mode: 'admin',
    summary,
    modules: moduleCards(summary),
    charts: {
      customersGrowth: buildMonthlyCounts(customerTimelineRows),
      plans: Array.from(planCounts.entries()).map(([label, value]) => ({ label, value })),
    },
    alerts: [],
    activities,
    recent: {
      users: recentUsers,
      customers: recentCustomers,
      campaigns: recentCampaigns,
      lists: recentLists,
      subscriptions: recentSubscriptions,
    },
  });
};

exports.users = async (req, res) => paged(req, res, prisma.user, {
  orderBy: { created_at: 'desc' },
  select: { id: true, uid: true, email: true, first_name: true, last_name: true, status: true, created_at: true, updated_at: true },
});

// ─── Admins (clone of Admin\AdminController) ─────────────────────────────────────
exports.admins = async (req, res) => {
  const meta = pageMeta(await safeCount(prisma.admin), req);
  const rows = await safeList(prisma.admin, {
    orderBy: { created_at: 'desc' },
    include: { user: true, adminGroup: true },
    skip: (meta.page - 1) * meta.per_page,
    take: meta.per_page,
  });
  const customerTotal = await safeCount(prisma.customer);
  const data = rows.map((a) => ({
    id: a.id,
    uid: a.uid,
    first_name: a.first_name,
    last_name: a.last_name,
    name: `${a.first_name || ''} ${a.last_name || ''}`.trim() || a.user?.email,
    email: a.user?.email || '',
    image: a.image || a.user?.image || null,
    status: a.status || 'active',
    created_at: a.created_at,
    admin_group_id: a.admin_group_id,
    group_name: a.adminGroup?.name || '—',
    customers_count: customerTotal,
    is_self: a.user_id === req.user?.id,
  }));
  res.json({ data, pagination: meta });
};

exports.adminDetail = async (req, res) => {
  const admin = await prisma.admin.findFirst({
    where: { uid: req.params.uid },
    include: { user: true, adminGroup: true },
  });
  if (!admin) return res.status(404).json({ message: 'Admin not found.' });
  res.json({
    id: admin.id,
    uid: admin.uid,
    email: admin.user?.email || '',
    first_name: admin.first_name,
    last_name: admin.last_name,
    image: admin.image,
    timezone: admin.timezone,
    status: admin.status,
    admin_group_id: admin.admin_group_id,
  });
};

exports.createAdmin = async (req, res) => {
  const bcrypt = require('bcryptjs');
  const { email, first_name, last_name, password, admin_group_id, timezone, create_customer } = req.body;
  if (!String(email || '').trim()) return res.status(422).json({ message: 'Email is required.' });
  if (!String(first_name || '').trim()) return res.status(422).json({ message: 'First name is required.' });
  if (!String(last_name || '').trim()) return res.status(422).json({ message: 'Last name is required.' });
  if (!String(password || '').trim()) return res.status(422).json({ message: 'Password is required.' });
  if (!admin_group_id) return res.status(422).json({ message: 'Group is required.' });

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return res.status(422).json({ message: 'A user with this email already exists.' });

  const user = await prisma.user.create({
    data: {
      email,
      password: await bcrypt.hash(password, 12),
      first_name,
      last_name,
      status: 'active',
    },
  });
  const admin = await prisma.admin.create({
    data: {
      user_id: user.id,
      admin_group_id: Number(admin_group_id),
      first_name,
      last_name,
      timezone: timezone || 'UTC',
      status: 'active',
    },
  });
  if (create_customer) {
    await prisma.customer.create({
      data: { user_id: user.id, first_name, last_name, timezone: timezone || 'UTC', status: 'active' },
    });
  }
  res.status(201).json({ uid: admin.uid });
};

exports.updateAdmin = async (req, res) => {
  const bcrypt = require('bcryptjs');
  const admin = await prisma.admin.findFirst({ where: { uid: req.params.uid }, include: { user: true } });
  if (!admin) return res.status(404).json({ message: 'Admin not found.' });
  const { email, first_name, last_name, password, admin_group_id, timezone } = req.body;

  const adminData = {};
  if (first_name !== undefined) adminData.first_name = first_name;
  if (last_name !== undefined) adminData.last_name = last_name;
  if (timezone !== undefined) adminData.timezone = timezone;
  if (admin_group_id !== undefined) adminData.admin_group_id = Number(admin_group_id);
  if (Object.keys(adminData).length) await prisma.admin.update({ where: { id: admin.id }, data: adminData });

  const userData = {};
  if (email !== undefined && email !== admin.user.email) userData.email = email;
  if (first_name !== undefined) userData.first_name = first_name;
  if (last_name !== undefined) userData.last_name = last_name;
  if (password) userData.password = await bcrypt.hash(password, 12);
  if (Object.keys(userData).length) await prisma.user.update({ where: { id: admin.user_id }, data: userData });

  res.json({ message: 'Admin saved.' });
};

exports.setAdminStatus = async (req, res) => {
  const status = req.params.action === 'enable' ? 'active' : 'inactive';
  const admin = await prisma.admin.findFirst({ where: { uid: req.params.uid } });
  if (!admin) return res.status(404).json({ message: 'Admin not found.' });
  await prisma.admin.update({ where: { id: admin.id }, data: { status } });
  res.json({ message: `Admin ${status === 'active' ? 'enabled' : 'disabled'}.` });
};

exports.deleteAdmin = async (req, res) => {
  const admin = await prisma.admin.findFirst({ where: { uid: req.params.uid } });
  if (!admin) return res.status(404).json({ message: 'Admin not found.' });
  await prisma.admin.delete({ where: { id: admin.id } });
  res.json({ message: 'Admin deleted.' });
};

// Generate a one-click login URL for an admin (clone of Admin\AdminController@oneClickLogin)
exports.adminOneClickLoginUrl = async (req, res) => {
  const admin = await prisma.admin.findFirst({ where: { uid: req.params.uid }, include: { user: true } });
  if (!admin || !admin.user) return res.status(404).json({ message: 'Admin not found.' });
  const jwt = require('jsonwebtoken');
  const token = jwt.sign({ id: admin.user.id }, process.env.JWT_SECRET, { expiresIn: '15m' });
  const base = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
  res.json({ url: `${base}/login/token/${token}`, expires_in: '15 minutes' });
};

// ─── Admin groups (clone of Admin\AdminGroupController) ───────────────────────────
exports.adminGroups = async (req, res) => {
  const meta = pageMeta(await safeCount(prisma.adminGroup), req);
  const rows = await safeList(prisma.adminGroup, {
    orderBy: { custom_order: 'asc' },
    include: { _count: { select: { admins: true } } },
    skip: (meta.page - 1) * meta.per_page,
    take: meta.per_page,
  });
  const data = rows.map((g) => ({
    id: g.id,
    name: g.name,
    created_at: g.created_at,
    admins_count: g._count?.admins || 0,
  }));
  res.json({ data, pagination: meta });
};

exports.adminGroupDetail = async (req, res) => {
  const group = await prisma.adminGroup.findUnique({ where: { id: Number(req.params.id) } });
  if (!group) return res.status(404).json({ message: 'Admin group not found.' });
  let permissions = {};
  try { permissions = group.permissions ? JSON.parse(group.permissions) : {}; } catch { permissions = {}; }
  res.json({ id: group.id, name: group.name, permissions });
};

exports.createAdminGroup = async (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(422).json({ message: 'Name is required.' });
  const group = await prisma.adminGroup.create({
    data: {
      name,
      permissions: JSON.stringify(req.body.permissions || {}),
      custom_order: 0,
    },
  });
  res.status(201).json({ id: group.id });
};

exports.updateAdminGroup = async (req, res) => {
  const group = await prisma.adminGroup.findUnique({ where: { id: Number(req.params.id) } });
  if (!group) return res.status(404).json({ message: 'Admin group not found.' });
  const data = {};
  if (req.body.name !== undefined) data.name = String(req.body.name).trim();
  if (req.body.permissions !== undefined) data.permissions = JSON.stringify(req.body.permissions || {});
  if (Object.keys(data).length) await prisma.adminGroup.update({ where: { id: group.id }, data });
  res.json({ message: 'Admin group saved.' });
};

exports.deleteAdminGroup = async (req, res) => {
  const id = Number(req.params.id);
  const group = await prisma.adminGroup.findUnique({ where: { id }, include: { _count: { select: { admins: true } } } });
  if (!group) return res.status(404).json({ message: 'Admin group not found.' });
  if (group._count?.admins > 0) return res.status(422).json({ message: 'This group still has admins assigned.' });
  await prisma.adminGroup.delete({ where: { id } });
  res.json({ message: 'Admin group deleted.' });
};

exports.roles = async (req, res) => {
  const meta = pageMeta(await safeCount(prisma.role), req);
  const rows = await safeList(prisma.role, {
    orderBy: { created_at: 'desc' },
    include: { _count: { select: { rolePermissions: true, users: true } } },
    skip: (meta.page - 1) * meta.per_page,
    take: meta.per_page,
  });
  // Role.id is BigInt → coerce for JSON; surface permission/user counts.
  const data = rows.map((r) => ({
    id: Number(r.id),
    uid: r.uid,
    name: r.name,
    code: r.code,
    description: r.description,
    status: r.status,
    readonly: r.readonly,
    created_at: r.created_at,
    updated_at: r.updated_at,
    permissions_count: r._count?.rolePermissions || 0,
    users_count: r._count?.users || 0,
  }));
  res.json({ data, pagination: meta });
};

// Role with its permission strings, for the role editor.
exports.roleDetail = async (req, res) => {
  const role = await prisma.role.findFirst({
    where: { uid: req.params.uid },
    include: { rolePermissions: { select: { permission: true } } },
  });
  if (!role) return res.status(404).json({ message: 'Role not found.' });
  res.json({
    id: Number(role.id),
    uid: role.uid,
    name: role.name,
    description: role.description,
    status: role.status,
    readonly: role.readonly,
    permissions: role.rolePermissions.map((p) => p.permission),
  });
};

const writePermissions = async (roleId, permissions) => {
  if (!Array.isArray(permissions)) return;
  await prisma.rolePermission.deleteMany({ where: { role_id: roleId } });
  const unique = [...new Set(permissions.filter(Boolean))];
  if (unique.length) {
    await prisma.rolePermission.createMany({
      data: unique.map((permission) => ({ role_id: roleId, permission })),
    });
  }
};

exports.createRole = async (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(422).json({ message: 'Role name is required.' });
  const role = await prisma.role.create({
    data: {
      name,
      description: req.body.description || null,
      status: req.body.status || 'active',
      is_global: true,
      readonly: false,
    },
  });
  await writePermissions(role.id, req.body.permissions);
  res.status(201).json({ id: Number(role.id), uid: role.uid });
};

exports.updateRole = async (req, res) => {
  const role = await prisma.role.findFirst({ where: { uid: req.params.uid } });
  if (!role) return res.status(404).json({ message: 'Role not found.' });
  const data = {};
  ['name', 'description', 'status'].forEach((k) => { if (req.body[k] !== undefined) data[k] = req.body[k]; });
  if (Object.keys(data).length) await prisma.role.update({ where: { id: role.id }, data });
  if (req.body.permissions !== undefined) await writePermissions(role.id, req.body.permissions);
  res.json({ message: 'Role saved.' });
};

exports.setRoleStatus = async (req, res) => {
  const status = req.params.action === 'enable' ? 'active' : 'inactive';
  const role = await prisma.role.findFirst({ where: { uid: req.params.uid } });
  if (!role) return res.status(404).json({ message: 'Role not found.' });
  await prisma.role.update({ where: { id: role.id }, data: { status } });
  res.json({ message: `Role ${status === 'active' ? 'enabled' : 'disabled'}.` });
};

exports.deleteRole = async (req, res) => {
  const role = await prisma.role.findFirst({ where: { uid: req.params.uid } });
  if (!role) return res.status(404).json({ message: 'Role not found.' });
  if (role.readonly) return res.status(422).json({ message: 'This role cannot be deleted.' });
  await prisma.rolePermission.deleteMany({ where: { role_id: role.id } });
  await prisma.role.delete({ where: { id: role.id } });
  res.json({ message: 'Role deleted.' });
};

exports.customers = async (req, res) => {
  const meta = pageMeta(await safeCount(prisma.customer), req);
  const rows = await safeList(prisma.customer, {
    orderBy: { created_at: 'desc' },
    include: {
      user: true,
      subscriptions: { include: { plan: true }, orderBy: { created_at: 'desc' } },
    },
    skip: (meta.page - 1) * meta.per_page,
    take: meta.per_page,
  });

  const data = await Promise.all(rows.map(async (c) => {
    const subscriber_count = await safeCount({ count: () => prisma.subscriber.count({ where: { customer_id: c.id } }) });
    const active = (c.subscriptions || []).find((s) => s.status === 'active');
    const pending = (c.subscriptions || []).find((s) => s.status === 'new' || s.status === 'pending');
    // Owner user(s) available for "Login as".
    const users = c.user ? [{ id: c.user.id, uid: c.user.uid, email: c.user.email, first_name: c.user.first_name, last_name: c.user.last_name }] : [];
    return {
      id: c.id,
      uid: c.uid,
      first_name: c.first_name,
      last_name: c.last_name,
      status: c.status,
      created_at: c.created_at,
      subscriber_count,
      users,
      active_subscription: active ? { plan_name: active.plan?.name, daily_email_limit: active.plan?.daily_email_limit } : null,
      pending_subscription: pending ? { plan_name: pending.plan?.name } : null,
    };
  }));

  res.json({ data, pagination: meta });
};

// Issue a token to impersonate a customer's user (admin "Login as").
exports.loginAsCustomer = async (req, res) => {
  const customer = await prisma.customer.findFirst({
    where: { uid: req.params.uid },
    include: { user: true },
  });
  if (!customer?.user) return res.status(404).json({ message: 'Customer user not found.' });
  const jwt = require('jsonwebtoken');
  const token = jwt.sign({ id: customer.user.id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
  res.json({ token, user: { uid: customer.user.uid, email: customer.user.email } });
};

// Enable / disable / delete a customer.
exports.setCustomerStatus = async (req, res) => {
  const status = req.params.action === 'enable' ? 'active' : 'inactive';
  const customer = await prisma.customer.findFirst({ where: { uid: req.params.uid } });
  if (!customer) return res.status(404).json({ message: 'Customer not found.' });
  await prisma.customer.update({ where: { id: customer.id }, data: { status } });
  res.json({ message: `Customer ${status === 'active' ? 'enabled' : 'disabled'}.` });
};

exports.deleteCustomer = async (req, res) => {
  const customer = await prisma.customer.findFirst({ where: { uid: req.params.uid } });
  if (!customer) return res.status(404).json({ message: 'Customer not found.' });
  await prisma.customer.delete({ where: { id: customer.id } });
  res.json({ message: 'Customer deleted.' });
};

// All customer columns the detail page reads/writes (raw SQL → no Prisma regen needed).
const CUSTOMER_DETAIL_COLS = [
  'first_name', 'last_name', 'timezone', 'status', 'language',
  'company', 'contact_first_name', 'contact_last_name', 'phone', 'work_email',
  'address', 'address_2', 'city', 'state', 'zip', 'country', 'website',
  'tax_number', 'billing_address',
];

// Raw MySQL UNSIGNED INT comes back as BigInt — coerce ids to Number for Prisma + JSON.
const toInt = (v) => (v === null || v === undefined ? null : Number(v));

// Full customer detail for the admin customer page (Profile / Contact / Users / Subscriptions).
exports.customerDetail = async (req, res) => {
  const rows = await prisma.$queryRawUnsafe('SELECT * FROM sendq_customers WHERE uid = ? LIMIT 1', req.params.uid);
  const raw = rows?.[0];
  if (!raw) return res.status(404).json({ message: 'Customer not found.' });
  const customer = { ...raw, id: toInt(raw.id), user_id: toInt(raw.user_id) };

  const [user, subscriptions] = await Promise.all([
    customer.user_id ? prisma.user.findUnique({ where: { id: customer.user_id } }) : Promise.resolve(null),
    safeList(prisma.subscription, { where: { customer_id: customer.id }, include: { plan: true }, orderBy: { created_at: 'desc' } }),
  ]);
  const users = user ? [{
    id: user.id, uid: user.uid, email: user.email,
    first_name: user.first_name, last_name: user.last_name,
    status: user.status, created_at: user.created_at,
  }] : [];
  res.json({ customer, users, subscriptions });
};

// Update a customer's profile + contact info from the admin detail page (raw SQL).
exports.updateCustomerProfile = async (req, res) => {
  const rows = await prisma.$queryRawUnsafe('SELECT id, user_id FROM sendq_customers WHERE uid = ? LIMIT 1', req.params.uid);
  const raw = rows?.[0];
  if (!raw) return res.status(404).json({ message: 'Customer not found.' });
  const customerId = Number(raw.id);
  const userId = raw.user_id === null || raw.user_id === undefined ? null : Number(raw.user_id);

  const sets = [];
  const values = [];
  CUSTOMER_DETAIL_COLS.forEach((col) => {
    if (req.body[col] !== undefined) {
      sets.push(`\`${col}\` = ?`);
      values.push(req.body[col] === '' ? null : req.body[col]);
    }
  });
  if (sets.length) {
    await prisma.$executeRawUnsafe(`UPDATE sendq_customers SET ${sets.join(', ')} WHERE id = ?`, ...values, customerId);
  }

  if (userId && req.body.email) {
    await prisma.user.update({ where: { id: userId }, data: { email: req.body.email } });
  }
  res.json({ message: 'Customer saved.' });
};

// ─── User-level admin actions (PHP clone of admin/users) ──────────────────────────
exports.loginAsUser = async (req, res) => {
  const user = await prisma.user.findFirst({ where: { uid: req.params.uid } });
  if (!user) return res.status(404).json({ message: 'User not found.' });
  const jwt = require('jsonwebtoken');
  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
  res.json({ token, user: { uid: user.uid, email: user.email } });
};

// Generate a shareable one-click login URL (short-lived token in the link).
exports.oneClickLoginUrl = async (req, res) => {
  const user = await prisma.user.findFirst({ where: { uid: req.params.uid } });
  if (!user) return res.status(404).json({ message: 'User not found.' });
  const jwt = require('jsonwebtoken');
  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '15m' });
  const base = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
  res.json({ url: `${base}/login/token/${token}`, expires_in: '15 minutes' });
};

exports.setUserStatus = async (req, res) => {
  const status = req.params.action === 'enable' ? 'active' : 'inactive';
  const user = await prisma.user.findFirst({ where: { uid: req.params.uid } });
  if (!user) return res.status(404).json({ message: 'User not found.' });
  await prisma.user.update({ where: { id: user.id }, data: { status } });
  res.json({ message: `User ${status === 'active' ? 'enabled' : 'disabled'}.` });
};

exports.deleteUser = async (req, res) => {
  const user = await prisma.user.findFirst({ where: { uid: req.params.uid } });
  if (!user) return res.status(404).json({ message: 'User not found.' });
  await prisma.user.delete({ where: { id: user.id } });
  res.json({ message: 'User deleted.' });
};

exports.subscriptions = async (req, res) => {
  const meta = pageMeta(await safeCount(prisma.subscription), req);
  const rows = await safeList(prisma.subscription, {
    orderBy: { updated_at: 'desc' },
    include: { customer: true, plan: true },
    skip: (meta.page - 1) * meta.per_page,
    take: meta.per_page,
  });
  const data = rows.map((s) => ({
    id: s.id,
    uid: s.uid,
    status: s.status,
    is_recurring: s.is_recurring,
    created_at: s.created_at,
    ends_at: s.ends_at,
    current_period_ends_at: s.current_period_ends_at,
    terminated_at: s.terminated_at,
    plan: s.plan ? { name: s.plan.name, type: s.plan.type } : null,
    customer: s.customer ? { uid: s.customer.uid, name: `${s.customer.first_name || ''} ${s.customer.last_name || ''}`.trim() || 'Customer' } : null,
  }));
  res.json({ data, pagination: meta });
};

const findSub = (uid) => prisma.subscription.findFirst({ where: { uid } });

exports.approveSubscription = async (req, res) => {
  const s = await findSub(req.params.uid);
  if (!s) return res.status(404).json({ message: 'Subscription not found.' });
  await prisma.subscription.update({ where: { id: s.id }, data: { status: 'active' } });
  res.json({ message: 'Subscription approved.' });
};

exports.setSubscriptionRecurring = async (req, res) => {
  const on = req.params.action === 'enable-recurring';
  const s = await findSub(req.params.uid);
  if (!s) return res.status(404).json({ message: 'Subscription not found.' });
  await prisma.subscription.update({ where: { id: s.id }, data: { is_recurring: on } });
  res.json({ message: on ? 'Recurring enabled.' : 'Recurring disabled.' });
};

exports.terminateSubscription = async (req, res) => {
  const s = await findSub(req.params.uid);
  if (!s) return res.status(404).json({ message: 'Subscription not found.' });
  await prisma.subscription.update({ where: { id: s.id }, data: { status: 'ended', is_recurring: false, terminated_at: new Date() } });
  res.json({ message: 'Subscription terminated.' });
};

exports.deleteSubscription = async (req, res) => {
  const s = await findSub(req.params.uid);
  if (!s) return res.status(404).json({ message: 'Subscription not found.' });
  await prisma.invoice.deleteMany({ where: { subscription_id: s.id } }).catch(() => {});
  await prisma.subscription.delete({ where: { id: s.id } });
  res.json({ message: 'Subscription deleted.' });
};

const parseFeatures = (plan) => {
  try { return plan.features && typeof plan.features === 'object' ? plan.features : (plan.features ? JSON.parse(plan.features) : {}); } catch { return {}; }
};

const planView = (plan) => {
  const f = parseFeatures(plan);
  return {
    id: plan.id,
    uid: plan.uid,
    name: plan.name,
    description: plan.description,
    status: plan.status,
    price: plan.price != null ? Number(plan.price) : 0,
    frequency_amount: plan.frequency_amount || '1',
    frequency_unit: plan.frequency_unit || 'month',
    currency_id: plan.currency_id,
    currency: plan.currency?.code || 'OMR',
    daily_email_limit: plan.daily_email_limit,
    trial_amount: plan.trial_amount,
    trial_unit: plan.trial_unit,
    sending_credits: f.sending_credits ?? 'unlimited',
    subscriber_limit: f.subscriber_limit ?? 0,
    delivery: f.delivery || 'smtp',
  };
};

exports.plans = async (req, res) => {
  const meta = pageMeta(await safeCount(prisma.plan), req);
  const rows = await safeList(prisma.plan, {
    orderBy: { created_at: 'desc' },
    include: { currency: true },
    skip: (meta.page - 1) * meta.per_page,
    take: meta.per_page,
  });
  res.json({ data: rows.map(planView), pagination: meta });
};

exports.planDetail = async (req, res) => {
  const plan = await prisma.plan.findFirst({ where: { uid: req.params.uid }, include: { currency: true } });
  if (!plan) return res.status(404).json({ message: 'Plan not found.' });
  res.json(planView(plan));
};

exports.reports = async (req, res) => {
  const [campaigns, lists, subscribers, sent, opens, clicks, bounces] = await Promise.all([
    safeCount(prisma.campaign),
    safeCount(prisma.mailList),
    safeCount(prisma.subscriber),
    safeCount(prisma.emailLog),
    safeCount(prisma.openLog),
    safeCount(prisma.clickLog),
    safeCount(prisma.bounceLog),
  ]);

  res.json({
    data: {
      campaigns,
      lists,
      subscribers,
      sent,
      opens,
      clicks,
      bounces,
      open_rate: sent ? Number(((opens / sent) * 100).toFixed(2)) : 0,
      click_rate: sent ? Number(((clicks / sent) * 100).toFixed(2)) : 0,
      bounce_rate: sent ? Number(((bounces / sent) * 100).toFixed(2)) : 0,
    },
  });
};

exports.emptyModule = (moduleName) => (req, res) => emptyPaged(req, res, moduleName);

// ─── Generic admin CRUD factory ─────────────────────────────────────────────────
// Builds list/create/update/remove handlers for a simple Prisma model. Used to
// clone the original admin resource controllers (currencies, taxes, etc.) without
// repeating boilerplate per module.
const pick = (body, fields, numeric = []) => fields.reduce((data, field) => {
  if (body[field] !== undefined) {
    if (numeric.includes(field)) {
      const n = Number(body[field]);
      data[field] = Number.isNaN(n) ? null : n;
    } else {
      data[field] = body[field] === '' ? null : body[field];
    }
  }
  return data;
}, {});

const makeCrud = (getModel, {
  label = 'Record',
  fields = [],
  required = [],
  numeric = [],
  defaults = {},
  orderBy = { created_at: 'desc' },
  withAdminId = false,
} = {}) => ({
  list: (req, res) => paged(req, res, getModel(), { orderBy }),

  create: async (req, res) => {
    const missing = required.filter((field) => !String(req.body[field] ?? '').trim());
    if (missing.length) {
      return res.status(422).json({ message: `${missing.join(', ')} ${missing.length > 1 ? 'are' : 'is'} required.` });
    }
    const data = { ...defaults, ...pick(req.body, fields, numeric) };
    if (withAdminId) data.admin_id = req.user?.admin?.id ?? req.admin?.id ?? null;
    const record = await getModel().create({ data });
    res.status(201).json(record);
  },

  update: async (req, res) => {
    const id = Number(req.params.id);
    const existing = await getModel().findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: `${label} not found.` });
    const record = await getModel().update({ where: { id }, data: pick(req.body, fields, numeric) });
    res.json(record);
  },

  remove: async (req, res) => {
    const id = Number(req.params.id);
    const existing = await getModel().findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: `${label} not found.` });
    await getModel().delete({ where: { id } });
    res.json({ message: `${label} deleted.` });
  },
});

// ─── Currencies (clone of Admin\CurrencyController) ──────────────────────────────
const currencyCrud = makeCrud(() => prisma.currency, {
  label: 'Currency',
  fields: ['name', 'code', 'format', 'status'],
  required: ['name', 'code', 'format'],
  defaults: { status: 'active' },
  withAdminId: true,
});
exports.currencies = currencyCrud.list;
exports.createCurrency = currencyCrud.create;
exports.updateCurrency = currencyCrud.update;
exports.deleteCurrency = currencyCrud.remove;

// ─── Tax settings (clone of Admin\TaxController) ─────────────────────────────────
// Global tax: `tax_enabled` + `tax_rate` live in sendq_settings; per-country
// overrides live in sendq_country_taxes.
const toNum = (v, fallback = 0) => { const n = Number(v); return Number.isNaN(n) ? fallback : n; };

exports.taxSettings = async (req, res) => {
  const settings = await prisma.setting.findMany({ where: { name: { in: ['tax_enabled', 'tax_rate'] } } });
  const map = Object.fromEntries(settings.map((s) => [s.name, s.value]));
  const rows = await prisma.$queryRawUnsafe('SELECT * FROM sendq_country_taxes ORDER BY country ASC');
  res.json({
    enabled: map.tax_enabled === '1' || map.tax_enabled === 'true',
    rate: map.tax_rate != null ? Number(map.tax_rate) : 0,
    countries: rows.map((r) => ({ id: Number(r.id), country: r.country, rate: Number(r.rate) })),
  });
};

exports.updateTaxSettings = async (req, res) => {
  const enabled = req.body.enabled ? '1' : '0';
  const rate = String(toNum(req.body.rate, 0));
  await Promise.all([
    prisma.setting.upsert({ where: { name: 'tax_enabled' }, update: { value: enabled }, create: { name: 'tax_enabled', value: enabled } }),
    prisma.setting.upsert({ where: { name: 'tax_rate' }, update: { value: rate }, create: { name: 'tax_rate', value: rate } }),
  ]);
  res.json({ message: 'Tax settings saved.' });
};

exports.addCountryTax = async (req, res) => {
  const country = String(req.body.country ?? '').trim();
  if (!country) return res.status(422).json({ message: 'Country is required.' });
  const rate = toNum(req.body.rate, 0);
  const existing = await prisma.$queryRawUnsafe('SELECT id FROM sendq_country_taxes WHERE country = ? LIMIT 1', country);
  if (existing.length) return res.status(422).json({ message: 'A tax rate for this country already exists.' });
  await prisma.$executeRawUnsafe('INSERT INTO sendq_country_taxes (country, rate, created_at, updated_at) VALUES (?, ?, NOW(3), NOW(3))', country, rate);
  res.status(201).json({ message: 'Country tax added.' });
};

exports.updateCountryTax = async (req, res) => {
  const id = Number(req.params.id);
  const rate = toNum(req.body.rate, 0);
  const existing = await prisma.$queryRawUnsafe('SELECT id FROM sendq_country_taxes WHERE id = ? LIMIT 1', id);
  if (!existing.length) return res.status(404).json({ message: 'Country tax not found.' });
  await prisma.$executeRawUnsafe('UPDATE sendq_country_taxes SET rate = ?, updated_at = NOW(3) WHERE id = ?', rate, id);
  res.json({ message: 'Country tax updated.' });
};

exports.deleteCountryTax = async (req, res) => {
  const id = Number(req.params.id);
  await prisma.$executeRawUnsafe('DELETE FROM sendq_country_taxes WHERE id = ?', id);
  res.json({ message: 'Country tax removed.' });
};

// ─── Invoice template (clone of Admin\InvoiceTemplateController) ─────────────────
// Single HTML document stored under the `invoice_template` setting key.
exports.invoiceTemplate = async (req, res) => {
  const row = await prisma.setting.findUnique({ where: { name: 'invoice_template' } });
  res.json({ content: row?.value || '' });
};

exports.updateInvoiceTemplate = async (req, res) => {
  const content = req.body.content == null ? '' : String(req.body.content);
  await prisma.setting.upsert({
    where: { name: 'invoice_template' },
    update: { value: content },
    create: { name: 'invoice_template', value: content },
  });
  res.json({ message: 'Invoice template saved.' });
};

// ─── Settings (clone of Admin\SettingController) ────────────────────────────────
// The original settings page is a flat key/value store. We expose all settings as
// a `data` array (so the generic admin table renders them) plus bulk upsert.
exports.settings = async (req, res) => {
  const rows = await safeList(prisma.setting, { orderBy: { name: 'asc' } });
  res.json({
    data: rows,
    pagination: pageMeta(rows.length, req),
  });
};

exports.updateSettings = async (req, res) => {
  // Accept either { settings: [{name, value}] } or a flat { name: value } map.
  const incoming = Array.isArray(req.body.settings)
    ? req.body.settings
    : Object.entries(req.body).map(([name, value]) => ({ name, value }));

  const valid = incoming.filter((item) => item?.name);
  if (!valid.length) return res.status(422).json({ message: 'No settings provided.' });

  await Promise.all(valid.map((item) => prisma.setting.upsert({
    where: { name: item.name },
    update: { value: item.value == null ? null : String(item.value) },
    create: { name: item.name, value: item.value == null ? null : String(item.value) },
  })));

  const rows = await prisma.setting.findMany({ orderBy: { name: 'asc' } });
  res.json({ data: rows, message: 'Settings saved.' });
};

// GET /api/v1/public/settings — whitelisted design/slider/site settings for the
// unauthenticated login, register, forgot-password & reset-password pages.
exports.publicSettings = async (req, res) => {
  const rows = await safeList(prisma.setting, {});
  const ALLOW = new Set(['site_name', 'site_description', 'site_logo_dark', 'site_logo_light', 'site_favicon', 'custom_css']);
  const out = {};
  rows.forEach((r) => {
    if (r.name && (r.name.startsWith('d_') || r.name.startsWith('slider_') || r.name.startsWith('slide_image_') || ALLOW.has(r.name))) {
      out[r.name] = r.value;
    }
  });
  res.json(out);
};

// POST /admin/settings/upload-image — store a settings image on disk, return its URL.
// Images (slider slides, slider background, logos) must NOT be base64 in setting.value.
exports.uploadSettingImage = async (req, res) => {
  if (!req.file) return res.status(422).json({ message: 'No image uploaded.' });
  // Store a RELATIVE path so it resolves on any origin (nginx proxies /uploads).
  // An absolute URL would bake in the upload host (e.g. localhost:5000) and break
  // when the app is served from a different origin.
  const url = `/uploads/settings/${req.file.filename}`;
  res.json({ url, message: 'Image uploaded.' });
};

// ─── Settings-backed config groups (mail, captcha, appearance, etc.) ─────────────
// Each group is a set of Setting keys edited as one form. Saved via updateSettings.
const SETTING_GROUPS = {
  'mail-settings': {
    title: 'Mail settings',
    fields: [
      { key: 'mail_driver', label: 'Driver (smtp/ses/sendmail)' },
      { key: 'mail_host', label: 'Host' },
      { key: 'mail_port', label: 'Port' },
      { key: 'mail_username', label: 'Username' },
      { key: 'mail_password', label: 'Password', type: 'password' },
      { key: 'mail_encryption', label: 'Encryption (tls/ssl)' },
      { key: 'mail_from_address', label: 'From address' },
      { key: 'mail_from_name', label: 'From name' },
    ],
  },
  captcha: {
    title: 'Captcha',
    fields: [
      { key: 'registration_recaptcha', label: 'Enable on registration (yes/no)' },
      { key: 'recaptcha_site_key', label: 'Site key' },
      { key: 'recaptcha_secret_key', label: 'Secret key', type: 'password' },
    ],
  },
  appearance: {
    title: 'Appearance',
    fields: [
      { key: 'app_name', label: 'Application name' },
      { key: 'app_logo_url', label: 'Logo URL' },
      { key: 'app_primary_color', label: 'Primary color', type: 'color' },
      { key: 'app_default_timezone', label: 'Default timezone' },
    ],
  },
  license: {
    title: 'License',
    fields: [
      { key: 'license_key', label: 'License key' },
      { key: 'license_holder', label: 'Licensed to' },
    ],
  },
  'public-view': {
    title: 'Public view',
    fields: [
      { key: 'public_site_title', label: 'Public site title' },
      { key: 'public_footer_text', label: 'Public footer text', type: 'textarea' },
      { key: 'public_support_email', label: 'Support email' },
    ],
  },
  'invoice-templates': {
    title: 'Invoice templates',
    fields: [
      { key: 'invoice_prefix', label: 'Invoice number prefix' },
      { key: 'invoice_footer', label: 'Invoice footer', type: 'textarea' },
      { key: 'invoice_company_details', label: 'Company details', type: 'textarea' },
    ],
  },
  taxes: {
    title: 'Taxes',
    fields: [
      { key: 'tax_enabled', label: 'Enabled (yes/no)' },
      { key: 'tax_name', label: 'Tax name (e.g. VAT)' },
      { key: 'tax_rate', label: 'Tax rate %' },
    ],
  },
};

exports.configGroup = (groupKey) => async (req, res) => {
  const def = SETTING_GROUPS[groupKey];
  const rows = await safeList(prisma.setting, { where: { name: { in: def.fields.map((f) => f.key) } } });
  const valueMap = new Map(rows.map((r) => [r.name, r.value]));
  res.json({
    type: 'settings',
    group: groupKey,
    title: def.title,
    fields: def.fields.map((f) => ({ ...f, value: valueMap.get(f.key) ?? '' })),
  });
};

// ─── Installed languages ─────────────────────────────────────────────────────────
exports.languages = async (req, res) => {
  const def = await safeRead(null, () => prisma.setting.findFirst({ where: { name: 'default_language' } }));
  res.json({
    type: 'languages',
    default: def?.value || 'en',
    locales: [
      { code: 'en', name: 'English' }, { code: 'de', name: 'German' }, { code: 'es', name: 'Spanish' },
      { code: 'it', name: 'Italian' }, { code: 'pt', name: 'Portuguese' }, { code: 'tr', name: 'Turkish' },
      { code: 'ja', name: 'Japanese' }, { code: 'ar', name: 'Arabic (RTL)' },
    ],
  });
};

// ─── Read-only list modules (clone of the original admin index views) ────────────
const listModule = (getModel, options = {}) => (req, res) => paged(req, res, getModel(), {
  orderBy: { created_at: 'desc' },
  ...options,
});

const campaignSubscriberInclude = {
  campaign: { select: { uid: true, name: true } },
  subscriber: { select: { uid: true, email: true } },
};

// Tracking & analytics log views
exports.trackingLog = listModule(() => prisma.trackingLog, { include: campaignSubscriberInclude });
exports.openLog = async (req, res) => {
  const meta = pageMeta(await safeCount(prisma.openLog), req);
  const rows = await safeList(prisma.openLog, {
    include: campaignSubscriberInclude, orderBy: { created_at: 'desc' },
    skip: (meta.page - 1) * meta.per_page, take: meta.per_page,
  });
  let geoip = null; try { geoip = require('geoip-lite'); } catch { /* offline geo optional */ }
  const area = (ip) => {
    if (!ip || !geoip) return 'Unknown';
    const g = geoip.lookup(ip);
    if (!g) return 'Unknown';
    return [g.city, g.region, g.country].filter(Boolean).join(', ') || 'Unknown';
  };
  const data = rows.map((r) => ({
    id: r.id, recipient: r.subscriber?.email || '-', ip: r.ip || '-',
    campaign: r.campaign?.name || '-', area: area(r.ip), created_at: r.created_at,
  }));
  res.json({ data, pagination: meta });
};
exports.clickLog = listModule(() => prisma.clickLog, { include: campaignSubscriberInclude });
exports.bounceLog = listModule(() => prisma.bounceLog, { include: campaignSubscriberInclude });
exports.unsubscribeLog = listModule(() => prisma.unsubscribeLog, { include: campaignSubscriberInclude });
exports.feedbackLog = listModule(() => prisma.feedbackLog, { include: campaignSubscriberInclude });

// System logs (sendq_logs)
exports.logs = listModule(() => prisma.auditLog, { include: { customer: { select: { first_name: true, last_name: true } } } });

// Sending infrastructure list views
const SENDING_SERVER_TYPES = {
  'amazon-smtp': 'Amazon SES SMTP',
  'amazon-api': 'Amazon SES API',
  'sendgrid-smtp': 'SendGrid SMTP',
  'sendgrid-api': 'SendGrid API',
  'mailgun-api': 'Mailgun API',
  'mailgun-smtp': 'Mailgun SMTP',
  'elasticemail-api': 'ElasticEmail API',
  'elasticemail-smtp': 'ElasticEmail SMTP',
  'sparkpost-api': 'SparkPost API',
  'sparkpost-smtp': 'SparkPost SMTP',
  'blastengine-api': 'BlastEngine API',
  'blastengine-smtp': 'BlastEngine SMTP',
  smtp: 'SMTP',
  'php-mail': 'PHP Mail',
  sendmail: 'SendMail (UNIX)',
};
const sendingServerTypeLabel = (t) => SENDING_SERVER_TYPES[t] || (t || 'SMTP');
const sendingLimitText = (s) => `${s.quota_value || 0}/${s.quota_base || 1} ${s.quota_unit || 'hour'}`;

exports.sendingServers = async (req, res) => {
  const meta = pageMeta(await safeCount(prisma.sendingServer), req);
  const rows = await safeList(prisma.sendingServer, {
    orderBy: { created_at: 'desc' },
    skip: (meta.page - 1) * meta.per_page,
    take: meta.per_page,
  });
  const data = await Promise.all(rows.map(async (s) => {
    // EmailLog has no sending_server_id — attribute via the campaign that used this server.
    const sent = await safeRead(0, () => prisma.emailLog.count({
      where: { status: 'sent', campaign: { sending_server_id: s.id } },
    }));
    return {
      id: s.id,
      uid: s.uid,
      name: s.name,
      type: s.type,
      type_label: sendingServerTypeLabel(s.type),
      hostname: s.host || s.domain || '',
      status: s.status || 'active',
      created_at: s.created_at,
      sent,
      sending_limit: sendingLimitText(s),
    };
  }));
  res.json({ data, pagination: meta });
};

exports.sendingServerDetail = async (req, res) => {
  const id = Number(req.params.id);
  const s = await prisma.sendingServer.findUnique({ where: { id } });
  if (!s) return res.status(404).json({ message: 'Sending server not found.' });
  let options = {};
  try { options = s.options ? JSON.parse(s.options) : {}; } catch { options = {}; }
  // Never return secrets (smtp_password/api_key/aws secret) — send presence flags instead.
  const { maskSecrets } = require('../email-engine/api.senders');
  res.json({ ...maskSecrets(s), type_label: sendingServerTypeLabel(s.type), options });
};

// Build nodemailer SMTP options from the form/DB creds.
const buildSmtpOptions = (c) => {
  const port = Number(c.port) || 587;
  return {
    host: c.host,
    port,
    secure: String(c.protocol || '').toLowerCase() === 'ssl' || port === 465,
    requireTLS: String(c.protocol || '').toLowerCase() === 'tls',
    auth: c.username ? { user: c.username, pass: c.password } : undefined,
    connectionTimeout: 12000,
    greetingTimeout: 12000,
    socketTimeout: 15000,
  };
};

// Merge submitted creds with the saved server (so a locked/blank password still works when editing).
const resolveTestCreds = async (req) => {
  const b = req.body || {};
  let s = null;
  if (req.params.id) s = await prisma.sendingServer.findUnique({ where: { id: Number(req.params.id) } });
  const pick = (bodyKey, col) => (b[bodyKey] != null && b[bodyKey] !== '' ? b[bodyKey] : (s ? s[col] : undefined));
  // Server-like shape consumed by descriptorFor() — covers SMTP, SES and the *-api types.
  const server = {
    type: b.type || s?.type || 'smtp',
    host: pick('host', 'host'),
    smtp_port: b.smtp_port || b.port || s?.smtp_port,
    smtp_username: pick('smtp_username', 'smtp_username'),
    smtp_password: pick('smtp_password', 'smtp_password'),
    smtp_protocol: pick('smtp_protocol', 'smtp_protocol'),
    api_key: pick('api_key', 'api_key'),
    domain: pick('domain', 'domain'),
    username: pick('username', 'username'),
    sendmail_path: pick('sendmail_path', 'sendmail_path'),
    aws_access_key_id: pick('aws_access_key_id', 'aws_access_key_id'),
    aws_secret_access_key: pick('aws_secret_access_key', 'aws_secret_access_key'),
    aws_region: pick('aws_region', 'aws_region'),
    options: s?.options,
  };
  return {
    server,
    from: b.from || s?.default_from_email,
    host: server.host, port: server.smtp_port, username: server.smtp_username,
    password: server.smtp_password, protocol: server.smtp_protocol,
  };
};

// POST /admin/mailbox-handlers/test — real IMAP/POP3 login test for bounce/FBL handlers.
exports.testMailboxHandler = async (req, res) => {
  const net = require('net');
  const tls = require('tls');
  const { host, username, password } = req.body;
  const protocol = (req.body.protocol || 'imap').toLowerCase();
  const encryption = (req.body.encryption || 'tls').toLowerCase();
  if (!host) return res.status(422).json({ message: 'Hostname is required.' });
  const secure = encryption === 'ssl' || encryption === 'tls';
  const port = Number(req.body.port) || (protocol === 'pop3' ? (secure ? 995 : 110) : (secure ? 993 : 143));

  const result = await new Promise((resolve) => {
    let settled = false;
    let buf = '';
    let stage = 'greeting';
    const opts = { host, port, servername: host, rejectUnauthorized: false };
    const sock = secure ? tls.connect(opts) : net.connect(opts);
    const done = (ok, message) => { if (!settled) { settled = true; try { sock.destroy(); } catch { /* */ } resolve({ ok, message }); } };
    const send = (s) => sock.write(`${s}\r\n`);
    sock.setTimeout(12000, () => done(false, 'Connection timed out.'));
    sock.on('error', (e) => done(false, e.message));
    sock.on('data', (d) => {
      buf += d.toString();
      if (protocol === 'pop3') {
        if (stage === 'greeting' && buf.includes('+OK')) { buf = ''; stage = 'user'; send(`USER ${username}`); }
        else if (stage === 'user' && /\r?\n/.test(buf)) { if (buf.startsWith('+OK')) { buf = ''; stage = 'pass'; send(`PASS ${password}`); } else done(false, buf.trim()); }
        else if (stage === 'pass' && /\r?\n/.test(buf)) { buf.startsWith('+OK') ? done(true, 'Authentication successful.') : done(false, buf.trim()); }
      } else {
        if (stage === 'greeting' && /\*\s*OK/i.test(buf)) { buf = ''; stage = 'login'; send(`a1 LOGIN "${username}" "${password}"`); }
        else if (stage === 'login' && /a1 (OK|NO|BAD)/i.test(buf)) {
          /a1 OK/i.test(buf) ? done(true, 'Authentication successful.') : done(false, (buf.match(/a1 (?:NO|BAD)\s*(.*)/i)?.[1] || 'Login failed').trim());
        }
      }
    });
  });

  if (result.ok) return res.json({ message: `Connected to ${host}:${port} — ${result.message}` });
  return res.status(422).json({ message: `Connection failed: ${result.message}` });
};

// ─── UI translation overrides (admin Languages → Translate) ──────────────────────
exports.getTranslations = async (req, res) => {
  const rows = await prisma.$queryRawUnsafe('SELECT tkey, value FROM sendq_translations WHERE locale = ?', req.params.locale).catch(() => []);
  const map = {};
  rows.forEach((r) => { map[r.tkey] = r.value; });
  res.json({ translations: map });
};

exports.saveTranslations = async (req, res) => {
  const locale = req.params.locale;
  const t = req.body.translations || {};
  let saved = 0;
  for (const [k, v] of Object.entries(t)) {
    if (v === undefined || v === null || String(v) === '') {
      await prisma.$executeRawUnsafe('DELETE FROM sendq_translations WHERE locale = ? AND tkey = ?', locale, k);
    } else {
      await prisma.$executeRawUnsafe(
        'INSERT INTO sendq_translations (locale, tkey, value) VALUES (?,?,?) ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = NOW(3)',
        locale, k, String(v),
      );
      saved += 1;
    }
  }
  res.json({ message: `Saved ${saved} translation(s) for ${locale}.` });
};

// POST /admin/settings/test-email — send a real test through the system mail config.
// Falls back to an active sending server (real delivery) and finally env SMTP.
exports.testSystemEmail = async (req, res) => {
  const nodemailer = require('nodemailer');
  const to = String(req.body.to || '').trim();
  if (!to) return res.status(422).json({ message: 'Recipient (To) email is required.' });
  const subject = req.body.subject || 'SendQ system mail test';
  const content = req.body.content || 'This is a test of the system mail configuration.';

  const keys = ['sysmail_host', 'sysmail_port', 'sysmail_encryption', 'sysmail_username', 'sysmail_password', 'sysmail_from_email', 'sysmail_from_name'];
  const rows = await prisma.setting.findMany({ where: { name: { in: keys } } });
  const sm = {};
  rows.forEach((r) => { sm[r.name] = r.value; });

  let transport;
  let from;
  let via;
  if (sm.sysmail_host) {
    const port = Number(sm.sysmail_port) || 465;
    transport = nodemailer.createTransport({
      host: sm.sysmail_host, port,
      secure: (sm.sysmail_encryption || '').toLowerCase() === 'ssl' || port === 465,
      auth: sm.sysmail_username ? { user: sm.sysmail_username, pass: sm.sysmail_password } : undefined,
    });
    from = sm.sysmail_from_name ? `${sm.sysmail_from_name} <${sm.sysmail_from_email || sm.sysmail_username}>` : (sm.sysmail_from_email || sm.sysmail_username);
    via = `system mail (${sm.sysmail_host})`;
  } else {
    const server = await prisma.sendingServer.findFirst({ where: { status: 'active' }, orderBy: { id: 'asc' } });
    if (server?.host) {
      const port = Number(server.smtp_port) || 587;
      transport = nodemailer.createTransport({
        host: server.host, port,
        secure: (server.smtp_protocol || '').toLowerCase() === 'ssl' || port === 465,
        auth: server.smtp_username ? { user: server.smtp_username, pass: server.smtp_password } : undefined,
      });
      from = sm.sysmail_from_email || server.smtp_username;
      via = `active sending server (${server.host})`;
    } else {
      transport = require('../email-engine/smtp.factory').createTransport({});
      from = sm.sysmail_from_email || process.env.MAIL_FROM || 'noreply@sendq.io';
      via = 'system default (env SMTP)';
    }
  }

  try {
    const info = await transport.sendMail({ from, to, subject, html: content });
    res.json({ message: `Test email sent to ${to} via ${via}.`, id: info.messageId });
  } catch (err) {
    res.status(422).json({ message: `Send failed: ${err.message}` });
  }
};

// POST /admin/sending-servers/test-connection (+ /:id) — verify SMTP connectivity now.
exports.testSendingServerConnection = async (req, res) => {
  const nodemailer = require('nodemailer');
  const { descriptorFor, isApi, verifyApi } = require('../email-engine/api.senders');
  const c = await resolveTestCreds(req);
  const provider = descriptorFor(c.server);
  try {
    if (isApi(provider)) {
      const msg = await verifyApi(provider);
      return res.json({ message: msg });
    }
    if (!c.host) return res.status(422).json({ message: 'Hostname is required.' });
    await nodemailer.createTransport(buildSmtpOptions(c)).verify();
    res.json({ message: `Connection to ${c.host}:${c.port || 587} succeeded.` });
  } catch (err) {
    res.status(422).json({ message: `Connection failed: ${err.message}` });
  }
};

// POST /admin/sending-servers/test-email (+ /:id) — send a real test email now.
exports.testSendingServerEmail = async (req, res) => {
  const nodemailer = require('nodemailer');
  const { descriptorFor, isApi, sendViaApi } = require('../email-engine/api.senders');
  const to = String(req.body.to || '').trim();
  if (!to) return res.status(422).json({ message: 'Recipient email is required.' });
  const c = await resolveTestCreds(req);
  const provider = descriptorFor(c.server);
  const from = c.from || c.username || process.env.MAIL_FROM || 'noreply@sendq.io';
  const message = {
    from,
    to,
    subject: 'SendQ — sending server test email',
    html: '<p>This is a test email from your SendQ sending server.</p><p>If you received this, the server is configured correctly and can send mail.</p>',
  };
  try {
    if (isApi(provider)) {
      const info = await sendViaApi(provider, message);
      return res.json({ message: `Test email sent to ${to}.`, id: info.messageId });
    }
    if (!c.host) return res.status(422).json({ message: 'Hostname is required.' });
    const info = await nodemailer.createTransport(buildSmtpOptions(c)).sendMail(message);
    res.json({ message: `Test email sent to ${to}.`, id: info.messageId });
  } catch (err) {
    res.status(422).json({ message: `Send failed: ${err.message}` });
  }
};

exports.setSendingServerStatus = async (req, res) => {
  const id = Number(req.params.id);
  const status = req.params.action === 'enable' ? 'active' : 'inactive';
  const s = await prisma.sendingServer.findUnique({ where: { id } });
  if (!s) return res.status(404).json({ message: 'Sending server not found.' });
  await prisma.sendingServer.update({ where: { id }, data: { status } });
  res.json({ message: `Sending server ${status === 'active' ? 'enabled' : 'disabled'}.` });
};

// Sending server create/edit/delete (clone of Admin\SendingServerController).
// Covers the common provider types; type-specific fields are stored when supplied.
const sendingServerCrud = makeCrud(() => prisma.sendingServer, {
  label: 'Sending server',
  fields: [
    'name', 'type', 'host', 'smtp_username', 'smtp_password', 'smtp_port', 'smtp_protocol',
    'sendmail_path', 'aws_access_key_id', 'aws_secret_access_key', 'aws_region',
    'domain', 'api_key', 'api_secret_key', 'username',
    'bounce_handler_id', 'feedback_loop_handler_id',
    'quota_value', 'quota_base', 'quota_unit', 'status', 'options',
  ],
  required: ['name', 'type'],
  numeric: ['smtp_port', 'quota_value', 'quota_base', 'bounce_handler_id', 'feedback_loop_handler_id'],
  defaults: { status: 'active', quota_value: 1000, quota_base: 1, quota_unit: 'hour' },
  withAdminId: true,
});
exports.createSendingServer = sendingServerCrud.create;
exports.updateSendingServer = sendingServerCrud.update;
exports.deleteSendingServer = sendingServerCrud.remove;
exports.sendingDomains = listModule(() => prisma.sendingDomain);
exports.trackingDomains = listModule(() => prisma.trackingDomain);
exports.bounceHandlers = listModule(() => prisma.bounceHandler);
exports.feedbackLoopHandlers = listModule(() => prisma.feedbackLoopHandler);

// ─── Bounce handlers CRUD (clone of Admin\BounceHandlerController) ────────────────
const bounceHandlerCrud = makeCrud(() => prisma.bounceHandler, {
  label: 'Bounce handler',
  fields: ['name', 'host', 'port', 'email', 'username', 'password', 'protocol', 'encryption', 'status'],
  required: ['name', 'host', 'port', 'email', 'username', 'password'],
  defaults: { status: 'active', protocol: 'imap', encryption: 'tls' },
  withAdminId: true,
});
exports.bounceHandlerDetail = async (req, res) => {
  const h = await prisma.bounceHandler.findFirst({ where: { uid: req.params.uid } });
  if (!h) return res.status(404).json({ message: 'Bounce handler not found.' });
  res.json(h);
};
exports.createBounceHandler = bounceHandlerCrud.create;
exports.updateBounceHandler = async (req, res) => {
  const h = await prisma.bounceHandler.findFirst({ where: { uid: req.params.uid } });
  if (!h) return res.status(404).json({ message: 'Bounce handler not found.' });
  req.params.id = h.id;
  return bounceHandlerCrud.update(req, res);
};
exports.deleteBounceHandler = async (req, res) => {
  const h = await prisma.bounceHandler.findFirst({ where: { uid: req.params.uid } });
  if (!h) return res.status(404).json({ message: 'Bounce handler not found.' });
  await prisma.bounceHandler.delete({ where: { id: h.id } });
  res.json({ message: 'Bounce handler deleted.' });
};

// ─── Feedback loop handlers CRUD ─────────────────────────────────────────────────
const fblHandlerCrud = makeCrud(() => prisma.feedbackLoopHandler, {
  label: 'Feedback loop handler',
  fields: ['name', 'type', 'host', 'port', 'email', 'username', 'password', 'protocol', 'encryption', 'status'],
  required: ['name', 'host', 'port', 'email', 'username', 'password'],
  defaults: { status: 'active', type: 'imap', protocol: 'imap', encryption: 'tls' },
  withAdminId: true,
});
exports.feedbackHandlerDetail = async (req, res) => {
  const h = await prisma.feedbackLoopHandler.findFirst({ where: { uid: req.params.uid } });
  if (!h) return res.status(404).json({ message: 'Feedback loop handler not found.' });
  res.json(h);
};
exports.createFeedbackHandler = fblHandlerCrud.create;
exports.updateFeedbackHandler = async (req, res) => {
  const h = await prisma.feedbackLoopHandler.findFirst({ where: { uid: req.params.uid } });
  if (!h) return res.status(404).json({ message: 'Feedback loop handler not found.' });
  req.params.id = h.id;
  return fblHandlerCrud.update(req, res);
};
exports.deleteFeedbackHandler = async (req, res) => {
  const h = await prisma.feedbackLoopHandler.findFirst({ where: { uid: req.params.uid } });
  if (!h) return res.status(404).json({ message: 'Feedback loop handler not found.' });
  await prisma.feedbackLoopHandler.delete({ where: { id: h.id } });
  res.json({ message: 'Feedback loop handler deleted.' });
};

// ─── Email verification servers CRUD (clone of Admin\EmailVerificationServerController)
exports.emailVerificationServers = listModule(() => prisma.emailVerificationServer);
exports.emailVerificationServerDetail = async (req, res) => {
  const s = await prisma.emailVerificationServer.findFirst({ where: { uid: req.params.uid } });
  if (!s) return res.status(404).json({ message: 'Email verification server not found.' });
  let options = {};
  try { options = s.options ? JSON.parse(s.options) : {}; } catch { options = {}; }
  res.json({ ...s, options });
};
exports.createEmailVerificationServer = async (req, res) => {
  const name = String(req.body.name || '').trim();
  const type = String(req.body.type || '').trim();
  if (!name) return res.status(422).json({ message: 'Name is required.' });
  if (!type) return res.status(422).json({ message: 'Service type is required.' });
  const options = {
    api_key: req.body.api_key || '',
    limit_value: req.body.limit_value ?? '',
    limit_base: req.body.limit_base ?? '',
    limit_unit: req.body.limit_unit || '',
  };
  const s = await prisma.emailVerificationServer.create({
    data: { name, type, options: JSON.stringify(options), status: 'active', admin_id: req.user?.admin?.id ?? null },
  });
  res.status(201).json({ uid: s.uid });
};
exports.updateEmailVerificationServer = async (req, res) => {
  const s = await prisma.emailVerificationServer.findFirst({ where: { uid: req.params.uid } });
  if (!s) return res.status(404).json({ message: 'Email verification server not found.' });
  const data = {};
  if (req.body.name !== undefined) data.name = String(req.body.name).trim();
  if (req.body.type !== undefined) data.type = String(req.body.type).trim();
  if (req.body.status !== undefined) data.status = req.body.status;
  if (req.body.options !== undefined || req.body.limit_value !== undefined) {
    let options = {};
    try { options = s.options ? JSON.parse(s.options) : {}; } catch { options = {}; }
    options = {
      ...options,
      api_key: req.body.api_key ?? options.api_key ?? '',
      limit_value: req.body.limit_value ?? options.limit_value ?? '',
      limit_base: req.body.limit_base ?? options.limit_base ?? '',
      limit_unit: req.body.limit_unit ?? options.limit_unit ?? '',
    };
    data.options = JSON.stringify(options);
  }
  await prisma.emailVerificationServer.update({ where: { id: s.id }, data });
  res.json({ message: 'Email verification server saved.' });
};
exports.deleteEmailVerificationServer = async (req, res) => {
  const s = await prisma.emailVerificationServer.findFirst({ where: { uid: req.params.uid } });
  if (!s) return res.status(404).json({ message: 'Email verification server not found.' });
  await prisma.emailVerificationServer.delete({ where: { id: s.id } });
  res.json({ message: 'Email verification server deleted.' });
};
exports.signatures = listModule(() => prisma.signature);
exports.sendingCreditPlans = async (req, res) => {
  const meta = pageMeta(await safeCount(prisma.sendingCreditPlan), req);
  const rows = await safeList(prisma.sendingCreditPlan, {
    orderBy: { created_at: 'desc' },
    include: { currency: true },
    skip: (meta.page - 1) * meta.per_page,
    take: meta.per_page,
  });
  const data = rows.map((p) => ({
    id: Number(p.id),
    uid: p.uid,
    name: p.name,
    description: p.description,
    credits: p.credits != null ? Number(p.credits) : 0,
    price: p.price != null ? Number(p.price) : 0,
    currency_id: p.currency_id,
    currency: p.currency?.code || 'OMR',
  }));
  res.json({ data, pagination: meta });
};

exports.sendingCreditPlanDetail = async (req, res) => {
  const p = await prisma.sendingCreditPlan.findFirst({ where: { uid: req.params.uid }, include: { currency: true } });
  if (!p) return res.status(404).json({ message: 'Plan not found.' });
  res.json({
    uid: p.uid,
    name: p.name,
    description: p.description,
    credits: p.credits != null ? Number(p.credits) : 0,
    price: p.price != null ? Number(p.price) : 0,
    currency_id: p.currency_id,
    currency: p.currency?.code || 'OMR',
  });
};

exports.createSendingCreditPlan = async (req, res) => {
  if (!String(req.body.name || '').trim()) return res.status(422).json({ message: 'Plan name is required.' });
  let currencyId = req.body.currency_id ? Number(req.body.currency_id) : null;
  if (!currencyId) { const c = await prisma.currency.findFirst(); currencyId = c?.id; }
  if (!currencyId) return res.status(422).json({ message: 'No currency configured. Add a currency first.' });
  const plan = await prisma.sendingCreditPlan.create({
    data: {
      name: req.body.name.trim(),
      description: req.body.description || null,
      credits: BigInt(Math.trunc(Number(req.body.credits) || 0)),
      price: Number(req.body.price) || 0,
      currency_id: currencyId,
    },
  });
  res.status(201).json({ uid: plan.uid });
};

exports.updateSendingCreditPlan = async (req, res) => {
  const plan = await prisma.sendingCreditPlan.findFirst({ where: { uid: req.params.uid } });
  if (!plan) return res.status(404).json({ message: 'Plan not found.' });
  const data = {};
  if (req.body.name !== undefined) data.name = String(req.body.name).trim();
  if (req.body.description !== undefined) data.description = req.body.description || null;
  if (req.body.credits !== undefined) data.credits = BigInt(Math.trunc(Number(req.body.credits) || 0));
  if (req.body.price !== undefined) data.price = Number(req.body.price) || 0;
  if (req.body.currency_id) data.currency_id = Number(req.body.currency_id);
  await prisma.sendingCreditPlan.update({ where: { id: plan.id }, data });
  res.json({ message: 'Plan saved.' });
};

exports.deleteSendingCreditPlan = async (req, res) => {
  const plan = await prisma.sendingCreditPlan.findFirst({ where: { uid: req.params.uid } });
  if (!plan) return res.status(404).json({ message: 'Plan not found.' });
  await prisma.sendingCreditPlan.delete({ where: { id: plan.id } });
  res.json({ message: 'Plan deleted.' });
};

// ─── Email verification plans (raw SQL — additive table, no Prisma model) ─────────
const EVP_TABLE = 'sendq_email_verification_plans';
const evpView = (p) => ({
  id: Number(p.id),
  uid: p.uid,
  name: p.name,
  description: p.description,
  email_verification_credits: Number(p.email_verification_credits || 0),
  price: p.price != null ? Number(p.price) : 0,
  currency_id: p.currency_id != null ? Number(p.currency_id) : null,
  currency: p.currency_code || 'OMR',
  type: p.type || 'recurring',
  frequency_amount: p.frequency_amount,
  frequency_unit: p.frequency_unit,
  trial_amount: p.trial_amount != null ? Number(p.trial_amount) : null,
  trial_unit: p.trial_unit,
  status: p.status,
});

exports.emailVerificationPlans = async (req, res) => {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT p.*, c.code AS currency_code FROM ${EVP_TABLE} p LEFT JOIN sendq_currencies c ON c.id = p.currency_id ORDER BY p.created_at DESC`,
  ).catch(() => []);
  res.json({ data: rows.map(evpView) });
};

exports.emailVerificationPlanDetail = async (req, res) => {
  const rows = await prisma.$queryRawUnsafe(`SELECT * FROM ${EVP_TABLE} WHERE uid = ? LIMIT 1`, req.params.uid);
  if (!rows?.[0]) return res.status(404).json({ message: 'Plan not found.' });
  res.json(evpView(rows[0]));
};

exports.createEmailVerificationPlan = async (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(422).json({ message: 'Plan name is required.' });
  let currencyId = req.body.currency_id ? Number(req.body.currency_id) : null;
  if (!currencyId) { const c = await prisma.currency.findFirst(); currencyId = c?.id || null; }
  const uid = require('crypto').randomUUID();
  const type = req.body.type === 'one_time' ? 'one_time' : 'recurring';
  await prisma.$executeRawUnsafe(
    `INSERT INTO ${EVP_TABLE} (uid, name, description, email_verification_credits, price, currency_id, type, frequency_amount, frequency_unit, trial_amount, trial_unit, status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    uid,
    name,
    req.body.description || null,
    Math.trunc(Number(req.body.email_verification_credits) || 0),
    Number(req.body.price) || 0,
    currencyId,
    type,
    type === 'recurring' ? (req.body.frequency_amount || '1') : null,
    type === 'recurring' ? (req.body.frequency_unit || 'month') : null,
    req.body.trial_amount ? Number(req.body.trial_amount) : null,
    req.body.trial_unit || null,
    'active',
  );
  res.status(201).json({ uid });
};

exports.updateEmailVerificationPlan = async (req, res) => {
  const rows = await prisma.$queryRawUnsafe(`SELECT id FROM ${EVP_TABLE} WHERE uid = ? LIMIT 1`, req.params.uid);
  if (!rows?.[0]) return res.status(404).json({ message: 'Plan not found.' });
  const cols = {
    name: (v) => String(v).trim(),
    description: (v) => v || null,
    email_verification_credits: (v) => Math.trunc(Number(v) || 0),
    price: (v) => Number(v) || 0,
    currency_id: (v) => (v ? Number(v) : null),
    type: (v) => v,
    frequency_amount: (v) => v || null,
    frequency_unit: (v) => v || null,
    trial_amount: (v) => (v ? Number(v) : null),
    trial_unit: (v) => v || null,
    status: (v) => v,
  };
  const sets = [];
  const values = [];
  Object.entries(cols).forEach(([col, fn]) => {
    if (req.body[col] !== undefined) { sets.push(`\`${col}\` = ?`); values.push(fn(req.body[col])); }
  });
  if (sets.length) {
    await prisma.$executeRawUnsafe(`UPDATE ${EVP_TABLE} SET ${sets.join(', ')} WHERE id = ?`, ...values, Number(rows[0].id));
  }
  res.json({ message: 'Plan saved.' });
};

exports.deleteEmailVerificationPlan = async (req, res) => {
  await prisma.$executeRawUnsafe(`DELETE FROM ${EVP_TABLE} WHERE uid = ?`, req.params.uid);
  res.json({ message: 'Plan deleted.' });
};

// System template/warmup/domain admin list views
exports.adminTemplates = listModule(() => prisma.template, { include: { customer: { select: { first_name: true, last_name: true } } } });

// ─── Template Gallery (admin base templates, clone of Admin\TemplateController) ───
const mapGalleryTemplate = (t) => ({
  uid: t.uid,
  name: t.name,
  image: t.image || null,
  category: t.categories?.[0]?.name || 'Basic',
  category_ids: (t.categories || []).map((c) => c.id),
  created_at: t.created_at,
});

exports.templateGallery = async (req, res) => {
  const rows = await safeList(prisma.template, {
    where: { customer_id: null },
    include: { categories: true },
    orderBy: { created_at: 'desc' },
  });
  res.json({ data: rows.map(mapGalleryTemplate), pagination: pageMeta(rows.length, req) });
};

exports.templateGalleryCategories = async (req, res) => {
  const rows = await safeList(prisma.templateCategory, { orderBy: { name: 'asc' } });
  res.json({ data: rows.map((c) => ({ id: c.id, uid: c.uid, name: c.name })) });
};

exports.templateGalleryDetail = async (req, res) => {
  const t = await prisma.template.findFirst({ where: { uid: req.params.uid }, include: { categories: true } });
  if (!t) return res.status(404).json({ message: 'Template not found.' });
  res.json({ ...mapGalleryTemplate(t), content: t.content || '' });
};

exports.createTemplateGallery = async (req, res) => {
  const name = String(req.body.name || '').trim() || 'Untitled template';
  const data = {
    name, content: req.body.content || '', image: req.body.image || null,
    shared: true, admin_id: req.user?.admin?.id ?? null,
  };
  const catId = req.body.category_id ? Number(req.body.category_id) : null;
  if (catId) data.categories = { connect: [{ id: catId }] };
  const t = await prisma.template.create({ data });
  res.status(201).json({ uid: t.uid });
};

exports.updateTemplateGallery = async (req, res) => {
  const t = await prisma.template.findFirst({ where: { uid: req.params.uid } });
  if (!t) return res.status(404).json({ message: 'Template not found.' });
  const data = {};
  if (req.body.name !== undefined) data.name = String(req.body.name).trim();
  if (req.body.image !== undefined) data.image = req.body.image || null;
  if (req.body.content !== undefined) data.content = req.body.content;
  if (Array.isArray(req.body.category_ids)) {
    data.categories = { set: req.body.category_ids.map((id) => ({ id: Number(id) })) };
  }
  await prisma.template.update({ where: { id: t.id }, data });
  res.json({ message: 'Template saved.' });
};

exports.copyTemplateGallery = async (req, res) => {
  const t = await prisma.template.findFirst({ where: { uid: req.params.uid }, include: { categories: true } });
  if (!t) return res.status(404).json({ message: 'Template not found.' });
  const copy = await prisma.template.create({
    data: {
      name: `${t.name} (copy)`, content: t.content || '', image: t.image || null,
      shared: true, admin_id: t.admin_id,
      categories: { connect: (t.categories || []).map((c) => ({ id: c.id })) },
    },
  });
  res.status(201).json({ uid: copy.uid });
};

exports.deleteTemplateGallery = async (req, res) => {
  const t = await prisma.template.findFirst({ where: { uid: req.params.uid } });
  if (!t) return res.status(404).json({ message: 'Template not found.' });
  await prisma.template.update({ where: { id: t.id }, data: { categories: { set: [] } } });
  await prisma.template.delete({ where: { id: t.id } });
  res.json({ message: 'Template deleted.' });
};

// ─── Form templates (admin Setting > Form templates) ─────────────────────────────
exports.formTemplates = async (req, res) => {
  const rows = await prisma.$queryRawUnsafe('SELECT id, uid, name, category, image, created_at FROM sendq_form_templates ORDER BY created_at DESC');
  res.json({ data: rows.map((r) => ({ uid: r.uid, name: r.name, category: r.category, image: r.image, created_at: r.created_at })), pagination: pageMeta(rows.length, req) });
};
exports.formTemplateDetail = async (req, res) => {
  const rows = await prisma.$queryRawUnsafe('SELECT * FROM sendq_form_templates WHERE uid = ? LIMIT 1', req.params.uid);
  if (!rows.length) return res.status(404).json({ message: 'Form template not found.' });
  res.json(rows[0]);
};
exports.createFormTemplate = async (req, res) => {
  const { randomUUID } = require('crypto');
  const name = String(req.body.name || '').trim() || 'Untitled form';
  const uid = randomUUID();
  await prisma.$executeRawUnsafe(
    'INSERT INTO sendq_form_templates (uid, name, category, content, image, created_at, updated_at) VALUES (?,?,?,?,?,NOW(3),NOW(3))',
    uid, name, req.body.category || 'Basic', req.body.content || '', req.body.image || null);
  res.status(201).json({ uid });
};
exports.updateFormTemplate = async (req, res) => {
  const rows = await prisma.$queryRawUnsafe('SELECT id FROM sendq_form_templates WHERE uid = ? LIMIT 1', req.params.uid);
  if (!rows.length) return res.status(404).json({ message: 'Form template not found.' });
  const cur = await prisma.$queryRawUnsafe('SELECT name, category, content, image FROM sendq_form_templates WHERE uid = ?', req.params.uid);
  const c = cur[0];
  await prisma.$executeRawUnsafe(
    'UPDATE sendq_form_templates SET name = ?, category = ?, content = ?, image = ?, updated_at = NOW(3) WHERE uid = ?',
    req.body.name !== undefined ? String(req.body.name).trim() : c.name,
    req.body.category !== undefined ? req.body.category : c.category,
    req.body.content !== undefined ? req.body.content : c.content,
    req.body.image !== undefined ? (req.body.image || null) : c.image,
    req.params.uid);
  res.json({ message: 'Form template saved.' });
};
exports.copyFormTemplate = async (req, res) => {
  const { randomUUID } = require('crypto');
  const rows = await prisma.$queryRawUnsafe('SELECT name, category, content, image FROM sendq_form_templates WHERE uid = ? LIMIT 1', req.params.uid);
  if (!rows.length) return res.status(404).json({ message: 'Form template not found.' });
  const c = rows[0];
  const uid = randomUUID();
  const name = String(req.body.name || '').trim() || `Copy of ${c.name}`;
  await prisma.$executeRawUnsafe(
    'INSERT INTO sendq_form_templates (uid, name, category, content, image, created_at, updated_at) VALUES (?,?,?,?,?,NOW(3),NOW(3))',
    uid, name, c.category, c.content, c.image);
  res.status(201).json({ uid });
};
exports.deleteFormTemplate = async (req, res) => {
  await prisma.$executeRawUnsafe('DELETE FROM sendq_form_templates WHERE uid = ?', req.params.uid);
  res.json({ message: 'Form template deleted.' });
};

// ─── Payment gateways (admin Setting > Payment gateways) ─────────────────────────
exports.paymentGateways = async (req, res) => {
  const rows = await safeList(prisma.paymentGateway, { orderBy: { created_at: 'desc' } });
  const data = rows.map((g) => ({ id: Number(g.id), uid: g.uid, type: g.type, name: g.name, description: g.description, status: g.status, created_at: g.created_at }));
  res.json({ data, pagination: pageMeta(data.length, req) });
};
exports.createPaymentGateway = async (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(422).json({ message: 'Name is required.' });
  const g = await prisma.paymentGateway.create({
    data: { name, type: req.body.type || 'offline', description: req.body.description || null, status: 'active', gateway_data: JSON.stringify(req.body.gateway_data || {}) },
  });
  res.status(201).json({ uid: g.uid });
};
exports.setPaymentGatewayStatus = async (req, res) => {
  const status = req.params.action === 'enable' ? 'active' : 'inactive';
  const g = await prisma.paymentGateway.findFirst({ where: { uid: req.params.uid } });
  if (!g) return res.status(404).json({ message: 'Payment gateway not found.' });
  await prisma.paymentGateway.update({ where: { id: g.id }, data: { status } });
  res.json({ message: `Payment gateway ${status === 'active' ? 'enabled' : 'disabled'}.` });
};
exports.deletePaymentGateway = async (req, res) => {
  const g = await prisma.paymentGateway.findFirst({ where: { uid: req.params.uid } });
  if (!g) return res.status(404).json({ message: 'Payment gateway not found.' });
  await prisma.paymentGateway.delete({ where: { id: g.id } });
  res.json({ message: 'Payment gateway deleted.' });
};
exports.paymentGatewayDetail = async (req, res) => {
  const g = await prisma.paymentGateway.findFirst({ where: { uid: req.params.uid } });
  if (!g) return res.status(404).json({ message: 'Payment gateway not found.' });
  let gateway_data = {};
  try { gateway_data = g.gateway_data ? JSON.parse(g.gateway_data) : {}; } catch { gateway_data = {}; }
  res.json({ uid: g.uid, type: g.type, name: g.name, description: g.description, status: g.status, gateway_data });
};
exports.updatePaymentGateway = async (req, res) => {
  const g = await prisma.paymentGateway.findFirst({ where: { uid: req.params.uid } });
  if (!g) return res.status(404).json({ message: 'Payment gateway not found.' });
  const data = {};
  if (req.body.name !== undefined) data.name = String(req.body.name).trim();
  if (req.body.description !== undefined) data.description = req.body.description || null;
  if (req.body.status !== undefined) data.status = req.body.status;
  if (req.body.gateway_data !== undefined) {
    let prev = {};
    try { prev = g.gateway_data ? JSON.parse(g.gateway_data) : {}; } catch { prev = {}; }
    data.gateway_data = JSON.stringify({ ...prev, ...req.body.gateway_data });
  }
  await prisma.paymentGateway.update({ where: { id: g.id }, data });
  res.json({ message: 'Payment gateway saved.' });
};

// ─── Webhooks (admin Setting > Webhooks) ─────────────────────────────────────────
exports.adminWebhooks = async (req, res) => {
  const rows = await safeList(prisma.webhook, { orderBy: { created_at: 'desc' } });
  const data = rows.map((w) => ({ id: Number(w.id), uid: w.uid, name: w.name, event: w.event, status: w.status, request_method: w.request_method, request_url: w.request_url, created_at: w.created_at }));
  res.json({ data, pagination: pageMeta(data.length, req) });
};
exports.createWebhook = async (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(422).json({ message: 'Name is required.' });
  const w = await prisma.webhook.create({
    data: { name, event: req.body.event || 'subscriber.created', status: 'active', request_method: req.body.request_method || 'POST', request_url: req.body.request_url || null },
  });
  res.status(201).json({ uid: w.uid });
};
exports.setWebhookStatus = async (req, res) => {
  const status = req.params.action === 'enable' ? 'active' : 'inactive';
  const w = await prisma.webhook.findFirst({ where: { uid: req.params.uid } });
  if (!w) return res.status(404).json({ message: 'Webhook not found.' });
  await prisma.webhook.update({ where: { id: w.id }, data: { status } });
  res.json({ message: `Webhook ${status === 'active' ? 'enabled' : 'disabled'}.` });
};
exports.deleteWebhook = async (req, res) => {
  const w = await prisma.webhook.findFirst({ where: { uid: req.params.uid } });
  if (!w) return res.status(404).json({ message: 'Webhook not found.' });
  await prisma.webhook.delete({ where: { id: w.id } });
  res.json({ message: 'Webhook deleted.' });
};

// ─── Custom Emails & Pages (admin Setting > Custom Emails & Pages) ───────────────
exports.customTemplates = async (req, res) => {
  const rows = await prisma.$queryRawUnsafe('SELECT * FROM sendq_custom_templates ORDER BY id ASC');
  res.json({ data: rows.map((r) => ({ uid: r.uid, name: r.name, group_label: r.group_label, type: r.type, custom_page_count: Number(r.custom_page_count) })) });
};
exports.customTemplateDetail = async (req, res) => {
  const rows = await prisma.$queryRawUnsafe('SELECT * FROM sendq_custom_templates WHERE uid = ? LIMIT 1', req.params.uid);
  if (!rows.length) return res.status(404).json({ message: 'Template not found.' });
  res.json(rows[0]);
};
exports.updateCustomTemplate = async (req, res) => {
  const rows = await prisma.$queryRawUnsafe('SELECT subject, content FROM sendq_custom_templates WHERE uid = ? LIMIT 1', req.params.uid);
  if (!rows.length) return res.status(404).json({ message: 'Template not found.' });
  await prisma.$executeRawUnsafe(
    'UPDATE sendq_custom_templates SET content = ?, subject = ?, updated_at = NOW(3) WHERE uid = ?',
    req.body.content !== undefined ? req.body.content : rows[0].content,
    req.body.subject !== undefined ? req.body.subject : rows[0].subject,
    req.params.uid);
  res.json({ message: 'Template saved.' });
};

// ─── Languages (admin Setting > Language) ────────────────────────────────────────
exports.adminLanguages = async (req, res) => {
  const rows = await prisma.$queryRawUnsafe('SELECT * FROM sendq_languages ORDER BY name ASC');
  res.json({ data: rows.map((r) => ({ uid: r.uid, name: r.name, code: r.code, status: r.status, created_at: r.created_at })), pagination: pageMeta(rows.length, req) });
};
exports.createLanguage = async (req, res) => {
  const { randomUUID } = require('crypto');
  const name = String(req.body.name || '').trim();
  const code = String(req.body.code || '').trim().toLowerCase();
  if (!name || !code) return res.status(422).json({ message: 'Name and code are required.' });
  const existing = await prisma.$queryRawUnsafe('SELECT id FROM sendq_languages WHERE code = ? LIMIT 1', code);
  if (existing.length) return res.status(422).json({ message: 'A language with this code already exists.' });
  await prisma.$executeRawUnsafe(
    'INSERT INTO sendq_languages (uid, name, code, region_code, status, created_at, updated_at) VALUES (?,?,?,?,?,NOW(3),NOW(3))',
    randomUUID(), name, code, req.body.region_code || null, 'active');
  res.status(201).json({ message: 'Language added.' });
};
exports.setLanguageStatus = async (req, res) => {
  const status = req.params.action === 'enable' ? 'active' : 'inactive';
  await prisma.$executeRawUnsafe('UPDATE sendq_languages SET status = ?, updated_at = NOW(3) WHERE uid = ?', status, req.params.uid);
  res.json({ message: `Language ${status === 'active' ? 'enabled' : 'disabled'}.` });
};
exports.deleteLanguage = async (req, res) => {
  await prisma.$executeRawUnsafe('DELETE FROM sendq_languages WHERE uid = ?', req.params.uid);
  res.json({ message: 'Language deleted.' });
};
exports.adminDomains = listModule(() => prisma.sendingDomain, { include: { customer: { select: { first_name: true, last_name: true } } } });


// Billing list views
exports.payments = listModule(() => prisma.transaction, { include: { customer: { select: { first_name: true, last_name: true } } } });
exports.paymentMethods = listModule(() => prisma.paymentMethod);
exports.paymentServices = listModule(() => prisma.paymentGateway);
const custName = (c) => (c ? `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Customer' : null);

exports.invoices = async (req, res) => {
  const meta = pageMeta(await safeCount(prisma.invoice), req);
  const rows = await safeList(prisma.invoice, {
    orderBy: { created_at: 'desc' },
    include: { customer: true, currency: true },
    skip: (meta.page - 1) * meta.per_page,
    take: meta.per_page,
  });
  const data = rows.map((i) => ({
    id: i.id,
    uid: i.uid,
    number: i.number || i.uid,
    type: i.type,
    status: i.status,
    amount: i.fee != null ? Number(i.fee) : 0,
    currency: i.currency?.code || 'OMR',
    created_at: i.created_at,
    customer: i.customer ? { uid: i.customer.uid, name: custName(i.customer) } : null,
  }));
  res.json({ data, pagination: meta });
};

exports.transactions = async (req, res) => {
  const meta = pageMeta(await safeCount(prisma.transaction), req);
  const rows = await safeList(prisma.transaction, {
    orderBy: { created_at: 'desc' },
    include: { invoice: { include: { customer: true, currency: true } } },
    skip: (meta.page - 1) * meta.per_page,
    take: meta.per_page,
  });
  const data = rows.map((t) => ({
    id: t.id,
    uid: t.uid,
    status: t.status,
    method: t.method,
    error: t.error,
    created_at: t.created_at,
    invoice_number: t.invoice?.number || t.invoice?.uid || '-',
    amount: t.invoice?.fee != null ? Number(t.invoice.fee) : 0,
    currency: t.invoice?.currency?.code || 'OMR',
    customer: t.invoice?.customer ? { uid: t.invoice.customer.uid, name: custName(t.invoice.customer) } : null,
  }));
  res.json({ data, pagination: meta });
};

exports.approveInvoice = async (req, res) => {
  const inv = await prisma.invoice.findFirst({ where: { uid: req.params.uid } });
  if (!inv) return res.status(404).json({ message: 'Invoice not found.' });
  const wasUnpaid = inv.status !== 'paid';
  await prisma.invoice.update({ where: { id: inv.id }, data: { status: 'paid' } });
  await prisma.transaction.updateMany({ where: { invoice_id: inv.id }, data: { status: 'success' } }).catch(() => {});

  // Sending-credit invoices grant their credits to the customer on approval (once).
  if (wasUnpaid && inv.type === 'credit' && inv.customer_id) {
    try {
      const item = await prisma.invoiceItem.findFirst({ where: { invoice_id: inv.id, item_type: 'credit_plan' } });
      const plan = item ? await prisma.sendingCreditPlan.findFirst({ where: { id: Number(item.item_id) } }) : null;
      if (plan) {
        await prisma.$executeRawUnsafe(
          'UPDATE sendq_customers SET sending_credits = sending_credits + ? WHERE id = ?',
          Number(plan.credits), inv.customer_id,
        );
      }
    } catch (e) { console.error('[admin] credit grant on invoice approve failed:', e.message); }
  }

  res.json({ message: 'Invoice approved.' });
};

// GET /admin/invoices/:uid/pdf — download any invoice as a PDF (admin).
exports.invoicePdf = async (req, res) => {
  const { renderInvoicePdf } = require('../billing/invoice-render');
  const invoice = await prisma.invoice.findFirst({ where: { uid: req.params.uid }, include: { currency: true, customer: true } });
  if (!invoice) return res.status(404).json({ message: 'Invoice not found.' });
  const items = await prisma.invoiceItem.findMany({ where: { invoice_id: invoice.id } }).catch(() => []);
  const s = await prisma.setting.findUnique({ where: { name: 'site_name' } }).catch(() => null);
  const pdf = await renderInvoicePdf({ invoice, items, customer: invoice.customer, currency: invoice.currency, siteName: (s && s.value) || 'SendQ' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoice.number || invoice.uid.slice(0, 8)}.pdf"`);
  res.send(pdf);
};

exports.deleteInvoice = async (req, res) => {
  const inv = await prisma.invoice.findFirst({ where: { uid: req.params.uid } });
  if (!inv) return res.status(404).json({ message: 'Invoice not found.' });
  await prisma.transaction.deleteMany({ where: { invoice_id: inv.id } }).catch(() => {});
  await prisma.invoiceItem.deleteMany({ where: { invoice_id: inv.id } }).catch(() => {});
  await prisma.invoice.delete({ where: { id: inv.id } });
  res.json({ message: 'Invoice deleted.' });
};

// ─── Blacklist (clone of Admin\BlacklistController) ──────────────────────────────
const blacklistCrud = makeCrud(() => prisma.blacklist, {
  label: 'Blacklist entry',
  fields: ['email', 'reason'],
  required: ['email'],
});
// Admin blacklist = the system/global suppression list (customer_id IS NULL).
exports.blacklist = blacklistCrud.list;
exports.createBlacklist = async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!email) return res.status(422).json({ message: 'Email is required.' });
  const existing = await prisma.$queryRawUnsafe(
    'SELECT id FROM sendq_blacklists WHERE customer_id IS NULL AND email = ? LIMIT 1', email,
  );
  if (existing.length) return res.status(409).json({ message: 'This email is already blacklisted.' });
  await prisma.$executeRawUnsafe(
    'INSERT INTO sendq_blacklists (customer_id, email, reason, created_at) VALUES (NULL, ?, ?, NOW(3))',
    email, req.body.reason || null,
  );
  res.status(201).json({ email, reason: req.body.reason || null });
};
exports.deleteBlacklist = blacklistCrud.remove;
// Import a TXT blacklist (one email per line) into the global list.
exports.importBlacklist = async (req, res) => {
  const text = String(req.body.csv || req.body.text || '');
  if (!text.trim()) return res.status(422).json({ message: 'No file content provided.' });
  const emails = [...new Set(text.split(/\r?\n/).map((l) => l.trim().toLowerCase()).filter((e) => e && e.includes('@')))];
  let imported = 0;
  for (const email of emails) {
    const r = await prisma.$executeRawUnsafe(
      'INSERT IGNORE INTO sendq_blacklists (customer_id, email, reason, created_at) VALUES (NULL, ?, NULL, NOW(3))', email,
    );
    imported += Number(r) || 0;
  }
  res.json({ message: `Imported ${imported} email${imported === 1 ? '' : 's'}.`, imported });
};

// ─── Plugins (clone of Admin\PluginController + Model\Plugin) ─────────────────────
const PLG_TABLE = 'sendq_plugins';
const plgView = (p) => ({
  id: Number(p.id),
  uid: p.uid,
  name: p.name,
  type: p.type || null,
  title: p.title,
  description: p.description || '',
  version: p.version,
  status: p.status,
  created_at: p.created_at,
});

exports.plugins = async (req, res) => {
  const kw = String(req.query.keyword || '').trim().toLowerCase();
  const rows = await prisma.$queryRawUnsafe(`SELECT * FROM ${PLG_TABLE} ORDER BY created_at DESC`).catch(() => []);
  let data = rows.map(plgView);
  if (kw) data = data.filter((p) => `${p.name} ${p.title} ${p.description} ${p.version}`.toLowerCase().includes(kw));
  res.json({ data });
};

// Install/upload a plugin from a .zip package. Mirrors Model\Plugin::upload + installFromDir.
exports.installPlugin = async (req, res) => {
  const fs = require('fs');
  const path = require('path');
  const AdmZip = require('adm-zip');
  const { PLUGINS_DIR } = require('./plugin-upload.middleware');

  if (!req.file) return res.status(422).json({ message: 'Input must be a valid .zip file' });
  const tmpZip = req.file.path;
  const extractDir = `${tmpZip}-x`;
  const cleanup = () => {
    try { fs.rmSync(tmpZip, { force: true }); } catch { /* ignore */ }
    try { fs.rmSync(extractDir, { recursive: true, force: true }); } catch { /* ignore */ }
  };

  try {
    // Read + extract the archive.
    let zip;
    try { zip = new AdmZip(tmpZip); zip.extractAllTo(extractDir, true); }
    catch { cleanup(); return res.status(422).json({ message: 'Cannot open plugin package' }); }

    // composer.json may sit at root or inside a single wrapping folder.
    let root = extractDir;
    if (!fs.existsSync(path.join(root, 'composer.json'))) {
      const entries = fs.readdirSync(root).filter((n) => fs.statSync(path.join(root, n)).isDirectory());
      const nested = entries.find((d) => fs.existsSync(path.join(root, d, 'composer.json')));
      if (nested) root = path.join(root, nested);
    }

    const configFile = path.join(root, 'composer.json');
    if (!fs.existsSync(configFile)) {
      cleanup(); return res.status(422).json({ message: 'Invalid plugin package. No meta data found' });
    }

    let config;
    try { config = JSON.parse(fs.readFileSync(configFile, 'utf8')); }
    catch { cleanup(); return res.status(422).json({ message: 'Invalid plugin package. Cannot parse meta data' }); }

    // Required keys (matches Plugin::validateMetaData).
    for (const key of ['name', 'title', 'version', 'app_version']) {
      if (!(key in config)) { cleanup(); return res.status(422).json({ message: `Invalid plugin package. Unknown '${key}'` }); }
    }

    // Name must be "vendor/name".
    const names = String(config.name).split('/');
    if (names.length !== 2 || !names[0] || !names[1]) {
      cleanup(); return res.status(422).json({ message: 'Invalid plugin package. No meta data found' });
    }
    const [vendor, name] = names;
    if (!/^[a-z0-9-]+$/.test(vendor) || !/^[a-z0-9-]+$/.test(name)) {
      cleanup();
      return res.status(422).json({ message: "Plugin name must match 'author/name' pattern. Only lowercase letters, numbers and/or dash (-) are allowed." });
    }

    // Overwrite check against existing record.
    const existing = await prisma.$queryRawUnsafe(`SELECT * FROM ${PLG_TABLE} WHERE name = ? LIMIT 1`, config.name);
    if (existing?.[0] && !req.body.overwrite) {
      cleanup();
      return res.status(409).json({ message: `The plugin "${config.name}" already exists (v${existing[0].version}). Do you want to overwrite it with v${config.version}?` });
    }

    // Relocate to storage/app/plugins/{vendor}/{name}.
    const dest = path.join(PLUGINS_DIR, vendor, name);
    fs.rmSync(dest, { recursive: true, force: true });
    fs.mkdirSync(dest, { recursive: true });
    fs.cpSync(root, dest, { recursive: true });

    // Upsert the DB record.
    const title = String(config.title);
    const description = config.description ? String(config.description) : null;
    const version = config.version ? String(config.version) : '0.0.0';
    const type = config.type || (config.extra && config.extra.type) || null;
    if (existing?.[0]) {
      await prisma.$executeRawUnsafe(
        `UPDATE ${PLG_TABLE} SET title = ?, description = ?, version = ?, type = ?, updated_at = NOW(3) WHERE id = ?`,
        title, description, version, type, Number(existing[0].id),
      );
      cleanup();
      return res.json({ message: 'Plugin updated.', url: '/admin/plugins' });
    }
    const uid = require('crypto').randomUUID();
    await prisma.$executeRawUnsafe(
      `INSERT INTO ${PLG_TABLE} (uid, name, type, title, description, version, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,NOW(3),NOW(3))`,
      uid, config.name, type, title, description, version, 'inactive',
    );
    cleanup();
    return res.status(201).json({ message: 'Plugin installed.', url: '/admin/plugins' });
  } catch (err) {
    cleanup();
    return res.status(422).json({ message: err.message || 'Plugin installation failed.' });
  }
};

exports.setPluginStatus = async (req, res) => {
  const status = req.params.action === 'enable' ? 'active' : 'inactive';
  await prisma.$executeRawUnsafe(`UPDATE ${PLG_TABLE} SET status = ?, updated_at = NOW(3) WHERE uid = ?`, status, req.params.uid);
  res.json({ message: `Plugin ${status === 'active' ? 'activated' : 'deactivated'}.` });
};

exports.deletePlugin = async (req, res) => {
  const fs = require('fs');
  const path = require('path');
  const { PLUGINS_DIR } = require('./plugin-upload.middleware');
  const rows = await prisma.$queryRawUnsafe(`SELECT * FROM ${PLG_TABLE} WHERE uid = ? LIMIT 1`, req.params.uid);
  if (rows?.[0]) {
    try { fs.rmSync(path.join(PLUGINS_DIR, rows[0].name), { recursive: true, force: true }); } catch { /* ignore */ }
    await prisma.$executeRawUnsafe(`DELETE FROM ${PLG_TABLE} WHERE id = ?`, Number(rows[0].id));
  }
  res.json({ message: 'Plugin deleted.' });
};

// ─── Notifications (clone of Admin\NotificationController) ────────────────────────
exports.notifications = listModule(() => prisma.notification);
exports.deleteNotification = async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.notification.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ message: 'Notification not found.' });
  await prisma.notification.delete({ where: { id } });
  res.json({ message: 'Notification deleted.' });
};

// ─── Write operations ─────────────────────────────────────────────────────────

exports.updateCustomer = async (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body;
  if (!['active', 'inactive'].includes(status)) {
    return res.status(422).json({ message: 'Status must be active or inactive.' });
  }
  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) return res.status(404).json({ message: 'Customer not found.' });
  res.json(await prisma.customer.update({ where: { id }, data: { status } }));
};

// Build the Prisma data from a create/update request body.
const planDataFromBody = (body, existingFeatures = {}) => {
  const data = {};
  if (body.name !== undefined) data.name = String(body.name).trim();
  if (body.description !== undefined) data.description = body.description || null;
  if (body.status !== undefined) data.status = body.status;
  if (body.price !== undefined) data.price = Number(body.price) || 0;
  if (body.frequency_amount !== undefined) data.frequency_amount = String(body.frequency_amount);
  if (body.frequency_unit !== undefined) data.frequency_unit = body.frequency_unit;
  if (body.currency_id !== undefined) data.currency_id = body.currency_id ? Number(body.currency_id) : null;
  if (body.daily_email_limit !== undefined) data.daily_email_limit = Number(body.daily_email_limit) || 0;
  if (body.trial_amount !== undefined) data.trial_amount = body.trial_amount === '' || body.trial_amount === null ? null : Number(body.trial_amount);
  if (body.trial_unit !== undefined) data.trial_unit = body.trial_unit || null;

  // sending_credits / subscriber_limit / delivery live in the features JSON.
  const features = { ...existingFeatures };
  let touched = false;
  if (body.sending_credits !== undefined) { features.sending_credits = body.sending_credits; touched = true; }
  if (body.subscriber_limit !== undefined) { features.subscriber_limit = body.subscriber_limit; touched = true; }
  if (body.delivery !== undefined) { features.delivery = body.delivery; touched = true; }
  if (touched) data.features = features;
  return data;
};

exports.createPlan = async (req, res) => {
  if (!String(req.body.name || '').trim()) return res.status(422).json({ message: 'Plan name is required.' });
  const data = planDataFromBody(req.body);
  if (data.status === undefined) data.status = 'active';
  if (data.daily_email_limit === undefined) data.daily_email_limit = 100;
  const plan = await prisma.plan.create({ data });
  res.status(201).json(planView({ ...plan, currency: null }));
};

exports.updatePlan = async (req, res) => {
  const where = req.params.uid ? { uid: req.params.uid } : { id: Number(req.params.id) };
  const plan = await prisma.plan.findFirst({ where });
  if (!plan) return res.status(404).json({ message: 'Plan not found.' });
  const data = planDataFromBody(req.body, parseFeatures(plan));
  const updated = await prisma.plan.update({ where: { id: plan.id }, data, include: { currency: true } });
  res.json(planView(updated));
};

exports.copyPlan = async (req, res) => {
  const plan = await prisma.plan.findFirst({ where: { uid: req.params.uid } });
  if (!plan) return res.status(404).json({ message: 'Plan not found.' });
  const { id, uid, created_at, updated_at, ...rest } = plan;  
  const copy = await prisma.plan.create({ data: { ...rest, name: `${plan.name} (copy)` } });
  res.status(201).json({ uid: copy.uid });
};

exports.deletePlan = async (req, res) => {
  const where = req.params.uid ? { uid: req.params.uid } : { id: Number(req.params.id) };
  const plan = await prisma.plan.findFirst({ where });
  if (!plan) return res.status(404).json({ message: 'Plan not found.' });
  await prisma.plan.delete({ where: { id: plan.id } });
  res.json({ message: 'Plan deleted.' });
};

exports.assignPlan = async (req, res) => {
  const { customer_id, plan_id, ends_at } = req.body;
  if (!customer_id || !plan_id) {
    return res.status(422).json({ message: 'customer_id and plan_id are required.' });
  }
  const [customer, plan] = await Promise.all([
    prisma.customer.findUnique({ where: { id: Number(customer_id) } }),
    prisma.plan.findUnique({ where: { id: Number(plan_id) } }),
  ]);
  if (!customer) return res.status(404).json({ message: 'Customer not found.' });
  if (!plan) return res.status(404).json({ message: 'Plan not found.' });

  await prisma.subscription.updateMany({
    where: { customer_id: Number(customer_id), status: 'active' },
    data: { status: 'expired' },
  });

  const subscription = await prisma.subscription.create({
    data: {
      customer_id: Number(customer_id),
      plan_id: Number(plan_id),
      status: 'active',
      starts_at: new Date(),
      ends_at: ends_at ? new Date(ends_at) : null,
    },
    include: { customer: true, plan: true },
  });
  res.status(201).json(subscription);
};

exports.updateSubscription = async (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body;
  if (!['active', 'expired', 'suspended'].includes(status)) {
    return res.status(422).json({ message: 'Status must be active, expired, or suspended.' });
  }
  const sub = await prisma.subscription.findUnique({ where: { id } });
  if (!sub) return res.status(404).json({ message: 'Subscription not found.' });
  res.json(await prisma.subscription.update({ where: { id }, data: { status } }));
};
