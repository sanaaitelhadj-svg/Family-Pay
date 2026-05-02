import 'dotenv/config';
import { createApp } from './app.js';
import { createServer } from 'http';
import { initSocket } from './socket.js';
import { logger } from './lib/logger.js';
import { redis } from './lib/redis.js';
import { prisma } from './lib/prisma.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 4000;

async function bootstrap() {
  await prisma.$connect();
  logger.info('PostgreSQL connected');

  await redis.ping();
  logger.info('Redis connected');

  const app = createApp();
  const httpServer = createServer(app);
  initSocket(httpServer);

  httpServer.listen(PORT, () => {
    logger.info(`FamilyPay API running on http://localhost:${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV ?? 'development'}`);
  });
}

bootstrap().catch((err) => {
  logger.error('Fatal startup error', err);
  process.exit(1);
});
