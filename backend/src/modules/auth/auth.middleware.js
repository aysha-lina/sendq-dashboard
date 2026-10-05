const jwt = require('jsonwebtoken');
const prisma = require('../../config/database.config');
const { attachAccess } = require('./rbac');
const { getTokenVersion } = require('./token-version');

const sanitizeUser = (user) => {
  if (!user) return user;
  const { password, remember_token, ...safeUser } = user;
  return safeUser;
};

// Resolve a user from either a JWT (three dot-separated segments) or a personal
// API token (the 60-char hex `api_token`, no dots). Lets external clients call the
// API with `Authorization: Bearer <api_token>` (or `?api_token=`) — PHP `auth:api` parity.
const resolveUserFromToken = async (token) => {
  if (token.includes('.')) {
    const decoded = jwt.verify(token, process.env.JWT_SECRET); // throws → caught below
    return prisma.user.findUnique({ where: { id: decoded.id }, include: { customer: true } });
  }
  return prisma.user.findFirst({ where: { api_token: token }, include: { customer: true } });
};

const protect = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    let token = header.startsWith('Bearer ') ? header.slice(7) : null;
    // PHP-parity: external API clients may pass the token as a query/body param.
    if (!token) token = req.query.api_token || req.body?.api_token || null;

    if (!token) {
      return res.status(401).json({ message: 'Not authenticated. Please log in.' });
    }

    const user = await resolveUserFromToken(token);

    if (!user) {
      return res.status(401).json({ message: 'Invalid token.' });
    }

    // JWT revocation: the token embeds the token_version it was issued with; a
    // mismatch means it was revoked (password change / reset / log-out-everywhere).
    // API tokens are managed separately (renew endpoint), so skip the check.
    if (token.includes('.')) {
      const decoded = jwt.decode(token) || {};
      const currentTv = await getTokenVersion(user.id);
      if ((decoded.tv ?? 0) !== currentTv) {
        return res.status(401).json({ message: 'Session expired. Please log in again.' });
      }
    }

    if (user.status !== 'active') {
      return res.status(403).json({ message: 'Your account is inactive.' });
    }

    req.user = await attachAccess(sanitizeUser(user));
    req.customer = user.customer;
    req.authVia = token.includes('.') ? 'jwt' : 'api_token';
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token.' });
    }
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired. Please log in again.' });
    }
    next(err);
  }
};

module.exports = { protect, sanitizeUser, resolveUserFromToken };
