const fs = require('fs');
const path = require('path');
const multer = require('multer');

// Uploaded plugin packages land in a temp dir; installPlugin extracts + relocates them.
const TMP_DIR = path.join(process.cwd(), 'uploads', 'plugins-tmp');
fs.mkdirSync(TMP_DIR, { recursive: true });

// Installed plugins live under backend/storage/app/plugins/{vendor}/{name} (mirrors PHP).
const PLUGINS_DIR = path.join(process.cwd(), 'storage', 'app', 'plugins');
fs.mkdirSync(PLUGINS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, TMP_DIR),
  filename: (req, file, cb) => {
    const base = path.basename(file.originalname).replace(/[^\w.-]/g, '_');
    cb(null, `${Date.now()}-${base}`);
  },
});

const ZIP_MIMES = new Set([
  'application/zip',
  'application/octet-stream',
  'application/x-zip-compressed',
  'multipart/x-zip',
  'application/x-zip',
]);

const pluginUpload = multer({
  storage,
  limits: { fileSize: 16 * 1024 * 1024 }, // 16 MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.zip' || ZIP_MIMES.has(file.mimetype)) return cb(null, true);
    cb(new Error('Input must be a valid .zip file'));
  },
}).single('file');

// Wrap so multer errors become clean 422 JSON responses.
const uploadPlugin = (req, res, next) => pluginUpload(req, res, (err) => {
  if (err) return res.status(422).json({ message: err.message });
  next();
});

module.exports = { uploadPlugin, TMP_DIR, PLUGINS_DIR };
