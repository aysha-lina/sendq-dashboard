const fs = require('fs');
const path = require('path');
const multer = require('multer');

// Avatars live under backend/uploads/avatars and are served statically at /uploads.
const AVATAR_DIR = path.join(process.cwd(), 'uploads', 'avatars');
fs.mkdirSync(AVATAR_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, AVATAR_DIR),
  filename: (req, file, cb) => {
    const ext = (path.extname(file.originalname) || '.png').toLowerCase();
    cb(null, `${req.user?.uid || 'user'}-${Date.now()}${ext}`);
  },
});

const avatarUpload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (req, file, cb) => {
    if (/^image\/(png|jpe?g|gif|webp)$/.test(file.mimetype)) return cb(null, true);
    cb(new Error('Only PNG, JPG, GIF or WEBP images are allowed.'));
  },
}).single('avatar');

// Wrap so multer errors become clean 422 JSON responses.
const uploadAvatar = (req, res, next) => avatarUpload(req, res, (err) => {
  if (err) return res.status(422).json({ message: err.message });
  next();
});

module.exports = { uploadAvatar, AVATAR_DIR };
