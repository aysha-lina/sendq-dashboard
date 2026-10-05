const prisma = require('../../config/database.config');

// token_version powers JWT revocation. It's an additive column not known to the
// generated Prisma client, so it's read/written via raw SQL. A token embeds the
// tv it was issued with; incrementing the user's tv invalidates every older token
// (used on password change/reset and "log out everywhere").
const getTokenVersion = async (userId) => {
  try {
    const rows = await prisma.$queryRawUnsafe('SELECT token_version AS v FROM sendq_users WHERE id = ?', userId);
    return Number(rows?.[0]?.v || 0);
  } catch {
    return 0; // column/DB unavailable → treat as 0 (don't lock anyone out)
  }
};

const bumpTokenVersion = async (userId) => {
  try {
    await prisma.$executeRawUnsafe('UPDATE sendq_users SET token_version = token_version + 1 WHERE id = ?', userId);
  } catch { /* best-effort */ }
};

module.exports = { getTokenVersion, bumpTokenVersion };
