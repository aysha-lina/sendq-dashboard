const fs = require('fs');
const path = require('path');
const multer = require('multer');

// Builder assets (images dropped into the PRO builder) live under
// backend/uploads/assets and are served statically at /uploads.
const ASSET_DIR = path.join(process.cwd(), 'uploads', 'assets');
fs.mkdirSync(ASSET_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, ASSET_DIR),
  filename: (req, file, cb) => {
    const ext = (path.extname(file.originalname) || '.png').toLowerCase();
    const base = path.basename(file.originalname, ext).replace(/[^a-z0-9_-]/gi, '').slice(0, 40) || 'asset';
    cb(null, `${base}-${Date.now()}${ext}`);
  },
});

const assetUpload = multer({
  storage,
  limits: { fileSize: 6 * 1024 * 1024 }, // 6 MB each
  fileFilter: (req, file, cb) => {
    if (/^image\/(png|jpe?g|gif|webp|svg\+xml)$/.test(file.mimetype)) return cb(null, true);
    cb(new Error('Only PNG, JPG, GIF, WEBP or SVG images are allowed.'));
  },
}).array('files', 12);

// Wrap so multer errors become clean 422 JSON responses.
const uploadAssets = (req, res, next) => assetUpload(req, res, (err) => {
  if (err) return res.status(422).json({ message: err.message });
  next();
});

module.exports = { uploadAssets, ASSET_DIR };
