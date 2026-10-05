const { spawnSync } = require('child_process');
const path = require('path');
require('dotenv').config();

if (!process.env.DATABASE_URL) {
  const user = encodeURIComponent(process.env.DB_USER || 'root');
  const password = encodeURIComponent(process.env.DB_PASSWORD || '');
  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || '3306';
  const database = process.env.DB_NAME || 'sendq';
  process.env.DATABASE_URL = `mysql://${user}:${password}@${host}:${port}/${database}`;
}

const prismaBin = path.join(
  __dirname,
  '..',
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'prisma.cmd' : 'prisma',
);

const result = spawnSync(prismaBin, process.argv.slice(2), {
  cwd: path.join(__dirname, '..'),
  env: process.env,
  stdio: 'inherit',
  shell: false,
});

process.exit(result.status || 0);
