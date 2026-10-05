const { randomUUID, randomBytes } = require('crypto');
const prisma = require('../../config/database.config');
const { sendMail } = require('../email-engine/smtp.service');

// Verified sender (From-address) management. Uses raw SQL against the additive
// sendq_senders table (the Prisma client isn't regenerated for it).

const genToken = () => randomBytes(20).toString('hex'); // 40 hex chars

const sendVerificationEmail = async (sender) => {
  const api = (process.env.API_URL || `http://localhost:${process.env.PORT || 5000}`).replace(/\/$/, '');
  const link = `${api}/api/v1/public/sender-verify/${sender.verification_token}`;
  const from = process.env.MAIL_FROM || process.env.SMTP_USER || 'noreply@sendq.io';
  try {
    await sendMail({
      provider: {},
      message: {
        from,
        to: sender.email,
        subject: 'Verify your sender email address',
        html: `<p>Hi ${sender.name || ''},</p>
<p>Please confirm this email address so you can use it as a verified sender:</p>
<p><a href="${link}" style="display:inline-block;padding:12px 24px;background:#00698f;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;">Verify sender</a></p>
<p>Or open this link:<br />${link}</p>`,
      },
    });
    return true;
  } catch (err) {
    console.error('[senders] verification email failed:', err.message);
    return false;
  }
};

exports.listSenders = async (req, res) => {
  const rows = await prisma.$queryRawUnsafe(
    'SELECT uid, name, email, status, created_at FROM sendq_senders WHERE customer_id = ? ORDER BY created_at DESC',
    req.customer.id,
  );
  res.json({ data: rows });
};

exports.createSender = async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!name || !email) return res.status(422).json({ message: 'Name and email are required.' });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(422).json({ message: 'Invalid email address.' });

  const uid = randomUUID();
  const token = genToken();
  await prisma.$executeRawUnsafe(
    "INSERT INTO sendq_senders (uid, customer_id, name, email, status, verification_token, created_at, updated_at) VALUES (?,?,?,?,'unverified',?,NOW(3),NOW(3))",
    uid, req.customer.id, name, email, token,
  );
  const sent = await sendVerificationEmail({ name, email, verification_token: token });
  res.status(201).json({ sender: { uid, name, email, status: 'unverified' }, verification_sent: sent });
};

exports.resendSenderVerification = async (req, res) => {
  const rows = await prisma.$queryRawUnsafe(
    'SELECT id, name, email, status FROM sendq_senders WHERE uid = ? AND customer_id = ? LIMIT 1',
    req.params.uid, req.customer.id,
  );
  if (!rows.length) return res.status(404).json({ message: 'Sender not found.' });
  const s = rows[0];
  if (s.status === 'verified') return res.json({ message: 'Sender already verified.' });
  const token = genToken();
  await prisma.$executeRawUnsafe('UPDATE sendq_senders SET verification_token = ?, updated_at = NOW(3) WHERE id = ?', token, s.id);
  const sent = await sendVerificationEmail({ ...s, verification_token: token });
  res.json({ message: sent ? 'Verification email sent.' : 'Could not send verification email.', verification_sent: sent });
};

exports.deleteSender = async (req, res) => {
  await prisma.$executeRawUnsafe('DELETE FROM sendq_senders WHERE uid = ? AND customer_id = ?', req.params.uid, req.customer.id);
  res.json({ message: 'Sender deleted.' });
};

// Public (no auth): the verification link target from the email.
exports.verifySenderToken = async (req, res) => {
  const token = String(req.params.token || '');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (!token) return res.status(404).send('<p>Invalid verification link.</p>');
  const rows = await prisma.$queryRawUnsafe('SELECT id FROM sendq_senders WHERE verification_token = ? LIMIT 1', token);
  if (!rows.length) return res.status(404).send('<p>This verification link is invalid or has already been used.</p>');
  await prisma.$executeRawUnsafe(
    "UPDATE sendq_senders SET status = 'verified', verified_at = NOW(3), verification_token = NULL, updated_at = NOW(3) WHERE id = ?",
    rows[0].id,
  );
  res.send('<div style="font-family:sans-serif;text-align:center;padding:60px;color:#172033;"><h1>Sender verified ✅</h1><p>You can now use this address as a From address in your campaigns.</p></div>');
};
