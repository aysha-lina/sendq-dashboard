const fs = require('fs');
const path = require('path');
const multer = require('multer');

// Template thumbnails live under backend/uploads/templates and are served statically at /uploads.
const THUMB_DIR = path.join(process.cwd(), 'uploads', 'templates');
fs.mkdirSync(THUMB_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, THUMB_DIR),
  filename: (req, file, cb) => {
    const ext = (path.extname(file.originalname) || '.png').toLowerCase();
    cb(null, `${req.params.uid || 'template'}-${Date.now()}${ext}`);
  },
});

const thumbnailUpload = multer({
  storage,
  limits: { fileSize: 4 * 1024 * 1024 }, // 4 MB
  fileFilter: (req, file, cb) => {
    if (/^image\/(png|jpe?g|gif|webp)$/.test(file.mimetype)) return cb(null, true);
    cb(new Error('Only PNG, JPG, GIF or WEBP images are allowed.'));
  },
}).single('thumbnail');

// Wrap so multer errors become clean 422 JSON responses.
const uploadThumbnail = (req, res, next) => thumbnailUpload(req, res, (err) => {
  if (err) return res.status(422).json({ message: err.message });
  next();
});

module.exports = { uploadThumbnail, THUMB_DIR };
