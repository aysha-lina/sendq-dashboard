const fs = require('fs');
const path = require('path');
const multer = require('multer');

// Campaign attachments live under backend/uploads/attachments, served at /uploads.
const ATTACH_DIR = path.join(process.cwd(), 'uploads', 'attachments');
fs.mkdirSync(ATTACH_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, ATTACH_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    const base = path.basename(file.originalname, ext).replace(/[^a-z0-9_-]/gi, '').slice(0, 40) || 'file';
    cb(null, `${base}-${Date.now()}${ext}`);
  },
});

// Allowlist of safe attachment types. Executables, scripts, and active content
// (.exe/.js/.html/.svg/.php/…) are rejected so they can't be attached to outgoing
// mail or served from /uploads. Both extension AND mime-type must be allowed.
const ALLOWED_EXT = new Set([
  '.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp',
  '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.csv', '.txt', '.rtf', '.zip',
]);
const ALLOWED_MIME = /^(application\/(pdf|zip|x-zip-compressed|msword|vnd\.openxmlformats-officedocument\.[a-z.]+|vnd\.ms-(excel|powerpoint)|rtf)|image\/(png|jpe?g|gif|webp|bmp)|text\/(plain|csv|rtf))$/i;

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (ALLOWED_EXT.has(ext) && ALLOWED_MIME.test(file.mimetype || '')) return cb(null, true);
  cb(new Error('File type not allowed. Permitted: PDF, images, Office docs, CSV, TXT, RTF, ZIP.'));
};

const attachmentUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter,
}).single('attachment');

const uploadAttachment = (req, res, next) => attachmentUpload(req, res, (err) => {
  if (err) return res.status(422).json({ message: err.message });
  next();
});

module.exports = { uploadAttachment, ATTACH_DIR };
