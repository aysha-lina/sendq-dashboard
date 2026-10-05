require('dotenv').config();

const mysql = require('mysql2/promise');

const prefix = process.env.DB_PREFIX ? `${process.env.DB_PREFIX}_` : 'sendq_';
const table = (name) => `\`${prefix}${name}\``;

const main = async () => {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectTimeout: 8000,
  });

  const [users] = await connection.query(
    `SELECT id, email, status, first_name, last_name FROM ${table('users')} ORDER BY id`
  );

  const [roles] = await connection.query(`
    SELECT
      u.id AS user_id,
      u.email,
      r.code AS role_code,
      r.name AS role_name
    FROM ${table('users')} u
    LEFT JOIN ${table('user_role')} ur ON ur.user_id = u.id
    LEFT JOIN ${table('roles')} r ON r.id = ur.role_id
    ORDER BY u.id, r.id
  `);

  const [admins] = await connection.query(`
    SELECT
      a.user_id,
      a.admin_group_id,
      g.name AS admin_group
    FROM ${table('admins')} a
    LEFT JOIN ${table('admin_groups')} g ON g.id = a.admin_group_id
    ORDER BY a.user_id
  `);

  console.log(JSON.stringify({ users, roles, admins }, null, 2));
  await connection.end();
};

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
