require('dotenv').config();
const createApp = require('./bootstrap/app');
const prisma = require('./config/database.config');
const { startWorkers, stopWorkers } = require('./workers/index');

const PORT = process.env.PORT || 5000;

const start = async () => {
  try {
    await prisma.$connect();
    const app = createApp();

    const server = app.listen(PORT, () => {
      console.log(`SendQ API server running on http://localhost:${PORT}`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use.`);
        process.exit(1);
      }
      throw err;
    });

    startWorkers();

    const shutdown = async (signal) => {
      console.log(`\n[server] ${signal} received, shutting down...`);
      server.close(async () => {
        await stopWorkers();
        await prisma.$disconnect();
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

start();
