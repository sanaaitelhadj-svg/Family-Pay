import { Redis } from 'ioredis';
import { logger } from './logger.js';

export const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

redis.on('error', (err: Error) => logger.error('Redis error', { err: err.message }));
redis.on('connect', () => logger.info('Redis connected'));
