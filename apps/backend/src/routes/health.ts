import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  const checks = await Promise.allSettled([
    prisma.$queryRaw`SELECT 1`,
    redis.ping(),
  ]);

  const [db, cache] = checks;

  const status = checks.every((c) => c.status === 'fulfilled') ? 'ok' : 'degraded';

  res.status(status === 'ok' ? 200 : 503).json({
    status,
    timestamp: new Date().toISOString(),
    services: {
      database: db.status === 'fulfilled' ? 'ok' : 'error',
      redis: cache.status === 'fulfilled' ? 'ok' : 'error',
    },
    version: process.env.npm_package_version ?? '0.1.0',
  });
});
