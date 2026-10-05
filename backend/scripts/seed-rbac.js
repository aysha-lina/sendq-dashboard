require('dotenv').config();

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const prisma = require('../src/config/database.config');
const {
  ORIGINAL_ADMINISTRATOR_PERMISSIONS,
  ORIGINAL_RESELLER_PERMISSIONS,
  ORGANIZATION_ADMIN_PERMISSIONS,
  ORGANIZATION_READONLY_PERMISSIONS,
  SUPER_ADMIN_PERMISSIONS,
} = require('../src/config/original-rbac');

const prefix = process.env.DB_PREFIX ? `${process.env.DB_PREFIX}_` : 'sendq_';
const table = (name) => `\`${prefix}${name}\``;

const nowSql = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

const ensureTables = async () => {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS ${table('admin_groups')} (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      name VARCHAR(255) NOT NULL,
      options TEXT NULL,
      permissions TEXT NULL,
      custom_order INT NULL DEFAULT 0,
      creator_id INT UNSIGNED NULL,
      created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS ${table('admins')} (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      uid CHAR(36) NOT NULL,
      user_id INT UNSIGNED NOT NULL,
      creator_id INT UNSIGNED NULL,
      contact_id INT UNSIGNED NULL,
      admin_group_id INT UNSIGNED NOT NULL,
      language_id INT UNSIGNED NULL,
      first_name VARCHAR(255) NOT NULL,
      last_name VARCHAR(255) NOT NULL,
      image VARCHAR(255) NULL,
      timezone VARCHAR(255) NOT NULL,
      status VARCHAR(255) NULL,
      color_scheme VARCHAR(255) NULL,
      created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY admins_user_id_unique (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS ${table('roles')} (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      uid CHAR(36) NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT NULL,
      status VARCHAR(255) NOT NULL,
      readonly BOOLEAN NOT NULL DEFAULT false,
      customer_id INT UNSIGNED NULL,
      is_global BOOLEAN NOT NULL DEFAULT true,
      code VARCHAR(255) NULL,
      created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY roles_code_unique (code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS ${table('user_role')} (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id INT UNSIGNED NOT NULL,
      role_id BIGINT UNSIGNED NOT NULL,
      created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY user_role_user_id_role_id_unique (user_id, role_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS ${table('role_permission')} (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      role_id BIGINT UNSIGNED NOT NULL,
      permission VARCHAR(255) NOT NULL,
      created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY role_permission_role_id_permission_unique (role_id, permission)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
};

const seedAdminGroups = async () => {
  const groups = [
    [1, 'Administrator', ORIGINAL_ADMINISTRATOR_PERMISSIONS],
    [2, 'Reseller', ORIGINAL_RESELLER_PERMISSIONS],
  ];

  for (const [id, name, permissions] of groups) {
    await prisma.$executeRawUnsafe(
      `
        INSERT INTO ${table('admin_groups')}
          (id, name, options, permissions, creator_id, created_at, updated_at)
        VALUES (?, ?, '', ?, NULL, ?, ?)
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          permissions = VALUES(permissions),
          updated_at = VALUES(updated_at)
      `,
      id,
      name,
      JSON.stringify(permissions),
      nowSql(),
      nowSql()
    );
  }
};

const upsertRole = async ({ code, name, description, permissions, readonly = true }) => {
  const existing = await prisma.$queryRawUnsafe(
    `SELECT id FROM ${table('roles')} WHERE code = ? LIMIT 1`,
    code
  );

  let roleId = existing[0]?.id;

  if (roleId) {
    await prisma.$executeRawUnsafe(
      `
        UPDATE ${table('roles')}
        SET name = ?, description = ?, status = 'active', readonly = ?, is_global = true, updated_at = ?
        WHERE id = ?
      `,
      name,
      description,
      readonly,
      nowSql(),
      roleId
    );
  } else {
    await prisma.$executeRawUnsafe(
      `
        INSERT INTO ${table('roles')}
          (uid, code, name, description, status, readonly, is_global, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'active', ?, true, ?, ?)
      `,
      uuidv4(),
      code,
      name,
      description,
      readonly,
      nowSql(),
      nowSql()
    );
    const created = await prisma.$queryRawUnsafe(
      `SELECT id FROM ${table('roles')} WHERE code = ? LIMIT 1`,
      code
    );
    roleId = created[0].id;
  }

  await prisma.$executeRawUnsafe(`DELETE FROM ${table('role_permission')} WHERE role_id = ?`, roleId);

  for (const permission of permissions) {
    await prisma.$executeRawUnsafe(
      `
        INSERT IGNORE INTO ${table('role_permission')}
          (role_id, permission, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `,
      roleId,
      permission,
      nowSql(),
      nowSql()
    );
  }

  return roleId;
};

const findOrCreateFirstUser = async () => {
  const users = await prisma.$queryRawUnsafe(
    `SELECT id, email, first_name, last_name FROM ${table('users')} ORDER BY id ASC LIMIT 1`
  );

  if (users[0]) return users[0];

  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;
  const firstName = process.env.SUPER_ADMIN_FIRST_NAME || 'Super';
  const lastName = process.env.SUPER_ADMIN_LAST_NAME || 'Admin';

  if (!email || !password) {
    throw new Error(
      'No users exist. Set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD in backend/.env, then run npm run seed:rbac again.'
    );
  }

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO ${table('users')}
        (uid, email, password, api_token, status, first_name, last_name, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?)
    `,
    uuidv4(),
    email,
    await bcrypt.hash(password, 12),
    uuidv4().replace(/-/g, '').substring(0, 60),
    firstName,
    lastName,
    nowSql(),
    nowSql()
  );

  const createdUsers = await prisma.$queryRawUnsafe(
    `SELECT id, email, first_name, last_name FROM ${table('users')} WHERE email = ? LIMIT 1`,
    email
  );
  const user = createdUsers[0];

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO ${table('customers')}
        (uid, user_id, first_name, last_name, timezone, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
    `,
    uuidv4(),
    user.id,
    firstName,
    lastName,
    process.env.SUPER_ADMIN_TIMEZONE || 'UTC',
    nowSql(),
    nowSql()
  );

  return user;
};

const assignRole = async (userId, roleId) => {
  await prisma.$executeRawUnsafe(
    `
      INSERT IGNORE INTO ${table('user_role')}
        (user_id, role_id, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `,
    userId,
    roleId,
    nowSql(),
    nowSql()
  );
};

const assignAdminAccount = async (user) => {
  await prisma.$executeRawUnsafe(
    `
      INSERT INTO ${table('admins')}
        (uid, user_id, admin_group_id, first_name, last_name, timezone, status, created_at, updated_at)
      VALUES (?, ?, 1, ?, ?, ?, 'active', ?, ?)
      ON DUPLICATE KEY UPDATE
        admin_group_id = 1,
        status = 'active',
        updated_at = VALUES(updated_at)
    `,
    uuidv4(),
    user.id,
    user.first_name || 'Super',
    user.last_name || 'Admin',
    process.env.SUPER_ADMIN_TIMEZONE || 'UTC',
    nowSql(),
    nowSql()
  );
};

const main = async () => {
  await ensureTables();
  await seedAdminGroups();

  const superAdminRoleId = await upsertRole({
    code: 'super_admin',
    name: 'Super Admin',
    description: 'Full backend Administrator access cloned from original admin_group_id = 1.',
    permissions: SUPER_ADMIN_PERMISSIONS,
  });

  const adminRoleId = await upsertRole({
    code: 'admin',
    name: 'Admin',
    description: 'Full customer account access cloned from original organization_admin role.',
    permissions: ORGANIZATION_ADMIN_PERMISSIONS,
  });

  await upsertRole({
    code: 'user',
    name: 'User',
    description: 'Limited read-only customer account access cloned from original organization_readonly role.',
    permissions: ORGANIZATION_READONLY_PERMISSIONS,
  });

  const firstUser = await findOrCreateFirstUser();
  await assignRole(firstUser.id, superAdminRoleId);
  await assignRole(firstUser.id, adminRoleId);
  await assignAdminAccount(firstUser);

  console.log(`RBAC seed complete. First user ${firstUser.email} is assigned super_admin and admin.`);
};

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
