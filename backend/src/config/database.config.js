const { PrismaClient } = require('@prisma/client');

if (!process.env.DATABASE_URL) {
  const user = encodeURIComponent(process.env.DB_USER || 'root');
  const password = encodeURIComponent(process.env.DB_PASSWORD || '');
  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || '3306';
  const database = process.env.DB_NAME || 'sendq';
  process.env.DATABASE_URL = `mysql://${user}:${password}@${host}:${port}/${database}`;
}

const prisma = new PrismaClient();

module.exports = prisma;
