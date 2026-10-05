const fs = require('fs');
const path = require('path');
const multer = require('multer');

// Settings images (login slider slides, slider background, logos/favicon) are stored as
// files under uploads/settings/ and referenced by URL — NOT base64 in sendq_settings.value
// (which is a TEXT column capped at 64KB and overflows on real images).
const DIR = path.join(process.cwd(), 'uploads', 'settings');
fs.mkdirSync(DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, DIR),
  filename: (req, file, cb) => {
    const ext = (path.extname(file.originalname).toLowerCase().match(/^\.[a-z0-9]+$/) || ['.png'])[0];
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon']);

const imageUpload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
  fileFilter: (req, file, cb) => (IMAGE_MIMES.has(file.mimetype) ? cb(null, true) : cb(new Error('Only image files (PNG, JPG, GIF, WebP, SVG) are allowed.'))),
}).single('file');

const uploadSettingImage = (req, res, next) => imageUpload(req, res, (err) => {
  if (err) return res.status(422).json({ message: err.message });
  next();
});

module.exports = { uploadSettingImage, SETTINGS_IMG_DIR: DIR };
