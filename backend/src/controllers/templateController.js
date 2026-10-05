const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const prisma = require('../config/database.config');

// ─── GET /api/v1/templates ───────────────────────────────────────────────────
exports.index = async (req, res) => {
  try {
    const customerId = req.customer.id;
    const page = parseInt(req.query.page) || 1;
    const perPage = parseInt(req.query.per_page) || 25;
    const keyword = req.query.keyword || '';
    const sortOrder = ['name', 'created_at'].includes(req.query.sort_order)
      ? req.query.sort_order : 'created_at';
    const sortDir = req.query.sort_direction === 'asc' ? 'asc' : 'desc';
    const shared = req.query.shared === 'true';

    const where = shared
      ? { shared: true }
      : { customer_id: customerId };

    if (keyword) {
      where.name = { contains: keyword };
    }

    if (req.query.category) {
      where.categories = { some: { uid: req.query.category } };
    }

    const [templates, total] = await Promise.all([
      prisma.template.findMany({
        where,
        orderBy: { [sortOrder]: sortDir },
        skip: (page - 1) * perPage,
        take: perPage,
        select: {
          id: true, uid: true, name: true,
          image: true, shared: true,
          created_at: true, updated_at: true,
          categories: { select: { id: true, uid: true, name: true } },
        },
      }),
      prisma.template.count({ where }),
    ]);

    res.json({
      data: templates,
      pagination: {
        total,
        per_page: perPage,
        current_page: page,
        total_pages: Math.ceil(total / perPage),
      },
    });
  } catch (err) {
    console.error('Templates index error:', err);
    res.status(500).json({ message: 'Server error fetching templates.' });
  }
};

// ─── GET /api/v1/templates/:uid ──────────────────────────────────────────────
exports.show = async (req, res) => {
  try {
    const template = await prisma.template.findFirst({
      where: {
        uid: req.params.uid,
        OR: [{ customer_id: req.customer.id }, { shared: true }],
      },
      include: { categories: { select: { id: true, uid: true, name: true } } },
    });

    if (!template) return res.status(404).json({ message: 'Template not found.' });
    res.json(template);
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
};

// ─── POST /api/v1/templates ──────────────────────────────────────────────────
exports.store = [
  body('name').notEmpty().withMessage('Template name is required'),

  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }

    try {
      const { name, content = '' } = req.body;

      const template = await prisma.template.create({
        data: {
          uid: uuidv4(),
          customer_id: req.customer.id,
          name,
          content,
          shared: false,
          custom_order: 0,
        },
      });

      require('../utils/event-log').logEvent({ customerId: req.customer.id, type: 'template.created', name: template.name });
      res.status(201).json(template);
    } catch (err) {
      console.error('Template store error:', err);
      res.status(500).json({ message: 'Server error creating template.' });
    }
  },
];

// ─── PUT /api/v1/templates/:uid ──────────────────────────────────────────────
exports.update = [
  body('name').optional().notEmpty().withMessage('Name cannot be empty'),

  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }

    try {
      const existing = await prisma.template.findFirst({
        where: { uid: req.params.uid, customer_id: req.customer.id },
      });

      if (!existing) return res.status(404).json({ message: 'Template not found.' });

      const data = {};
      if (req.body.name !== undefined) data.name = req.body.name;
      if (req.body.content !== undefined) data.content = req.body.content;
      if (req.body.image !== undefined) data.image = req.body.image;
      if (Array.isArray(req.body.category_ids)) {
        data.categories = { set: req.body.category_ids.map((id) => ({ id: Number(id) })) };
      }

      const template = await prisma.template.update({
        where: { id: existing.id },
        data,
        include: { categories: { select: { id: true, uid: true, name: true } } },
      });

      res.json(template);
    } catch (err) {
      console.error('Template update error:', err);
      res.status(500).json({ message: 'Server error updating template.' });
    }
  },
];

// ─── POST /api/v1/templates/:uid/thumbnail ──────────────────────────────────
// `templateUpload.middleware` has already parsed the file and set req.file.
exports.uploadThumbnail = async (req, res) => {
  try {
    if (!req.file) return res.status(422).json({ message: 'No image uploaded.' });

    const existing = await prisma.template.findFirst({
      where: { uid: req.params.uid, customer_id: req.customer.id },
    });
    if (!existing) return res.status(404).json({ message: 'Template not found.' });

    const imagePath = `/uploads/templates/${req.file.filename}`;
    const template = await prisma.template.update({
      where: { id: existing.id },
      data: { image: imagePath },
      include: { categories: { select: { id: true, uid: true, name: true } } },
    });

    // Best-effort cleanup of the previous locally-uploaded thumbnail.
    if (existing.image && existing.image.startsWith('/uploads/templates/')) {
      fs.unlink(path.join(process.cwd(), existing.image.replace(/^\//, '')), () => {});
    }

    res.json({ ...template, image: imagePath, message: 'Thumbnail updated.' });
  } catch (err) {
    console.error('Template thumbnail error:', err);
    res.status(500).json({ message: 'Server error updating thumbnail.' });
  }
};

// ─── POST /api/v1/assets ─────────────────────────────────────────────────────
// Builder image uploads. `assetUpload.middleware` parsed the files into req.files.
// Returns the shape GrapesJS' Asset Manager expects: { data: [{ src, name, type }] }.
exports.uploadAssets = async (req, res) => {
  if (!req.files || !req.files.length) {
    return res.status(422).json({ message: 'No images uploaded.' });
  }
  const data = req.files.map((f) => ({
    src: `/uploads/assets/${f.filename}`,
    name: f.originalname,
    type: 'image',
  }));
  res.json({ data });
};

// ─── DELETE /api/v1/templates/:uid ──────────────────────────────────────────
exports.destroy = async (req, res) => {
  try {
    const existing = await prisma.template.findFirst({
      where: { uid: req.params.uid, customer_id: req.customer.id },
    });

    if (!existing) return res.status(404).json({ message: 'Template not found.' });

    await prisma.template.delete({ where: { id: existing.id } });
    res.json({ message: 'Template deleted.' });
  } catch (err) {
    console.error('Template destroy error:', err);
    res.status(500).json({ message: 'Server error deleting template.' });
  }
};

// ─── Template categories (global, shared across customers like the original) ─────
exports.categories = async (req, res) => {
  try {
    const categories = await prisma.templateCategory.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, uid: true, name: true, _count: { select: { templates: true } } },
    });
    res.json({ data: categories });
  } catch (err) {
    console.error('Template categories error:', err);
    res.status(500).json({ message: 'Server error fetching categories.' });
  }
};

exports.createCategory = [
  body('name').trim().notEmpty().withMessage('Category name is required'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
    try {
      const category = await prisma.templateCategory.create({
        data: { uid: uuidv4(), name: req.body.name.trim() },
      });
      res.status(201).json(category);
    } catch (err) {
      console.error('Template category create error:', err);
      res.status(500).json({ message: 'Server error creating category.' });
    }
  },
];

exports.deleteCategory = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const category = await prisma.templateCategory.findUnique({ where: { id } });
    if (!category) return res.status(404).json({ message: 'Category not found.' });
    await prisma.templateCategory.delete({ where: { id } });
    res.json({ message: 'Category deleted.' });
  } catch (err) {
    console.error('Template category delete error:', err);
    res.status(500).json({ message: 'Server error deleting category.' });
  }
};

// ─── POST /api/v1/templates/:uid/copy ───────────────────────────────────────
exports.copy = async (req, res) => {
  try {
    const source = await prisma.template.findFirst({
      where: {
        uid: req.params.uid,
        OR: [{ customer_id: req.customer.id }, { shared: true }],
      },
    });

    if (!source) return res.status(404).json({ message: 'Template not found.' });

    const copy = await prisma.template.create({
      data: {
        uid: uuidv4(),
        customer_id: req.customer.id,
        name: `${source.name} (copy)`,
        content: source.content || '',
        shared: false,
        custom_order: 0,
      },
    });

    res.status(201).json(copy);
  } catch (err) {
    console.error('Template copy error:', err);
    res.status(500).json({ message: 'Server error copying template.' });
  }
};
