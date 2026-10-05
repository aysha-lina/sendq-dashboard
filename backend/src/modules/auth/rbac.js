const prisma = require('../../config/database.config');

const tablePrefix = () => (process.env.DB_PREFIX ? `${process.env.DB_PREFIX}_` : 'sendq_');
const table = (name) => `\`${tablePrefix()}${name}\``;

const loadAccessForUser = async (userId) => {
  try {
    const rows = await prisma.$queryRawUnsafe(
      `
        SELECT
          r.id AS role_id,
          r.code,
          r.name,
          rp.permission
        FROM ${table('user_role')} ur
        INNER JOIN ${table('roles')} r ON r.id = ur.role_id
        LEFT JOIN ${table('role_permission')} rp ON rp.role_id = r.id
        WHERE ur.user_id = ?
          AND r.status = 'active'
      `,
      userId
    );

    const roleMap = new Map();
    const permissions = new Set();

    rows.forEach((row) => {
      const roleId = row.role_id?.toString();
      if (!roleMap.has(roleId)) {
        roleMap.set(roleId, {
          id: Number(row.role_id),
          code: row.code,
          name: row.name,
        });
      }
      if (row.permission) permissions.add(row.permission);
    });

    return {
      roles: Array.from(roleMap.values()),
      permissions: Array.from(permissions),
    };
  } catch (err) {
    if (
      err.code === 'P2021' ||
      err.original?.code === 'ER_NO_SUCH_TABLE' ||
      err.message?.includes("doesn't exist")
    ) {
      return { roles: [], permissions: [] };
    }

    throw err;
  }
};

const attachAccess = async (user) => {
  if (!user) return user;
  const access = await loadAccessForUser(user.id);
  return { ...user, ...access };
};

const hasRole = (user, code) => user?.roles?.some((role) => role.code === code);

// Admin abilities are stored as `ability:scope` strings (e.g. "admin_read:all",
// "customer_delete:own", "report_open_log:yes"); org abilities are plain strings
// (e.g. "campaign.full_access"). `hasAbility` grants when the user holds the ability
// with ANY non-"no" scope (or as a plain match). super_admin always passes.
const hasAbility = (user, ability) => {
  if (hasRole(user, 'super_admin')) return true;
  if (!Array.isArray(user?.permissions)) return false;
  return user.permissions.some((p) => {
    const [name, scope] = String(p).split(':');
    if (name !== ability) return false;
    return scope === undefined || (scope !== 'no' && scope !== '');
  });
};

// Backwards-compatible: exact membership OR scope-aware ability match. Keeps existing
// `.full_access` checks working while no longer silently failing on `ability:scope`.
const hasPermission = (user, permission) => {
  if (hasRole(user, 'super_admin')) return true;
  if (user?.permissions?.includes(permission)) return true;
  return hasAbility(user, permission);
};

const requireRole = (...roleCodes) => (req, res, next) => {
  if (roleCodes.some((code) => hasRole(req.user, code))) return next();

  return res.status(403).json({
    message: 'You do not have permission to access this resource.',
  });
};

const requirePermission = (permission) => (req, res, next) => {
  if (hasPermission(req.user, permission)) return next();

  return res.status(403).json({
    message: 'You do not have permission to access this resource.',
  });
};

// Scope-aware ability gate (super_admin bypass). Wire onto admin route groups to enable
// granular roles — see docs/RBAC_ENABLEMENT.md. Not yet applied to the live admin gate
// (which stays super_admin-only) until per-route ability mapping is validated live.
const requireAbility = (ability) => (req, res, next) => {
  if (hasAbility(req.user, ability)) return next();

  return res.status(403).json({
    message: 'You do not have permission to access this resource.',
  });
};

module.exports = {
  attachAccess,
  hasAbility,
  hasPermission,
  hasRole,
  loadAccessForUser,
  requireAbility,
  requirePermission,
  requireRole,
};
