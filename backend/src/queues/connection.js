const { Redis } = require('ioredis');

let connection;

const getConnection = () => {
  if (!connection) {
    connection = new Redis({
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      db: Number(process.env.REDIS_DB) || 0,
      maxRetriesPerRequest: null, // required by BullMQ
    });

    connection.on('error', (err) => {
      console.error('[Redis] Connection error:', err.message);
    });
  }
  return connection;
};

module.exports = { getConnection };
