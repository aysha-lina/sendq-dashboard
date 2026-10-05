const prisma = require('../../config/database.config');

const isMissingSchema = (err) => (
  err?.code === 'P2021' || err?.code === 'P2022' || /does(n't| not) exist/i.test(err?.message || '')
);

// Wrap a handler so that "table not created yet" returns a clear 503 instead of a 500.
const guard = (fn) => async (req, res, next) => {
  try { await fn(req, res, next); }
  catch (err) {
    if (isMissingSchema(err)) {
      return res.status(503).json({ message: 'Store tables are not created yet. Run the store migration (prisma db push).' });
    }
    next(err);
  }
};

const pick = (body, fields, numeric = []) => fields.reduce((data, f) => {
  if (body[f] === undefined) return data;
  data[f] = numeric.includes(f) ? (body[f] === '' || body[f] === null ? null : Number(body[f])) : (body[f] === '' ? null : body[f]);
  return data;
}, {});

// Generic CRUD. `scope` = 'customer' (filter+inject customer_id) or 'global'.
const crud = (getModel, { label, fields, required = [], numeric = [], scope = 'customer', orderBy = { created_at: 'desc' }, include } = {}) => {
  const where = (req, extra = {}) => (scope === 'customer' ? { customer_id: req.customer.id, ...extra } : extra);
  return {
    list: guard(async (req, res) => {
      const data = await getModel().findMany({ where: where(req), orderBy, ...(include ? { include } : {}) });
      res.json({ data });
    }),
    create: guard(async (req, res) => {
      const missing = required.filter((f) => !String(req.body[f] ?? '').trim());
      if (missing.length) return res.status(422).json({ message: `${missing.join(', ')} required.` });
      const data = pick(req.body, fields, numeric);
      if (scope === 'customer') data.customer_id = req.customer.id;
      res.status(201).json(await getModel().create({ data }));
    }),
    update: guard(async (req, res) => {
      const id = Number(req.params.id);
      const existing = await getModel().findFirst({ where: where(req, { id }) });
      if (!existing) return res.status(404).json({ message: `${label} not found.` });
      res.json(await getModel().update({ where: { id }, data: pick(req.body, fields, numeric) }));
    }),
    remove: guard(async (req, res) => {
      const id = Number(req.params.id);
      const existing = await getModel().findFirst({ where: where(req, { id }) });
      if (!existing) return res.status(404).json({ message: `${label} not found.` });
      await getModel().delete({ where: { id } });
      res.json({ message: `${label} deleted.` });
    }),
  };
};

// ─── Products (customer-scoped) ─────────────────────────────────────────────────
const products = crud(() => prisma.product, {
  label: 'Product', fields: ['title', 'description', 'content', 'price', 'meta'],
  required: ['title'], numeric: ['price'],
});
exports.products = products.list;
exports.createProduct = products.create;
exports.updateProduct = products.update;
exports.deleteProduct = products.remove;

// ─── Categories (global) ────────────────────────────────────────────────────────
const categories = crud(() => prisma.category, {
  label: 'Category', fields: ['name', 'description'], required: ['name'], scope: 'global',
});
exports.categories = categories.list;
exports.createCategory = categories.create;
exports.updateCategory = categories.update;
exports.deleteCategory = categories.remove;

// ─── Attributes (global, tied to a category) ────────────────────────────────────
const attributes = crud(() => prisma.attribute, {
  label: 'Attribute', fields: ['category_id', 'name', 'status', 'description'],
  required: ['category_id', 'name'], numeric: ['category_id'], scope: 'global',
  include: { category: { select: { name: true } } },
});
exports.attributes = attributes.list;
exports.createAttribute = attributes.create;
exports.updateAttribute = attributes.update;
exports.deleteAttribute = attributes.remove;

// ─── Funnels (customer-scoped) ──────────────────────────────────────────────────
const funnels = crud(() => prisma.funnel, {
  label: 'Funnel', fields: ['name', 'message', 'content', 'status'], required: ['name'],
});
exports.funnels = funnels.list;
exports.createFunnel = funnels.create;
exports.updateFunnel = funnels.update;
exports.deleteFunnel = funnels.remove;

// ─── Orders (customer-scoped; created by storefront, managed here) ───────────────
const orders = crud(() => prisma.order, {
  label: 'Order',
  fields: ['name', 'description', 'price', 'status', 'amount', 'tax', 'total', 'receive_name', 'receive_address', 'receive_phone'],
  required: ['name'], numeric: ['amount', 'tax', 'total'],
});
exports.orders = orders.list;
exports.createOrder = orders.create;
exports.updateOrder = orders.update;
exports.deleteOrder = orders.remove;

// ─── Media library (customer-scoped) ────────────────────────────────────────────
const media = crud(() => prisma.media, {
  label: 'Media', fields: ['source', 'type', 'dir', 'ext', 'slug', 'caption', 'status', 'author'], required: [],
});
exports.media = media.list;
exports.createMedia = media.create;
exports.deleteMedia = media.remove;

// ─── Store dashboard summary ────────────────────────────────────────────────────
exports.summary = guard(async (req, res) => {
  const [productCount, orderCount, funnelCount] = await Promise.all([
    prisma.product.count({ where: { customer_id: req.customer.id } }),
    prisma.order.count({ where: { customer_id: req.customer.id } }),
    prisma.funnel.count({ where: { customer_id: req.customer.id } }),
  ]);
  const revenue = await prisma.order.aggregate({
    where: { customer_id: req.customer.id, status: 'completed' },
    _sum: { total: true },
  });
  res.json({ products: productCount, orders: orderCount, funnels: funnelCount, revenue: revenue._sum.total || 0 });
});
