import Redis from 'ioredis';
import { logger } from './logger.js';

export const redis = new Redis({
  host: process.env.REDIS_HOST ?? 'localhost',
  port: parseInt(process.env.REDIS_PORT ?? '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

redis.on('error', (err) => logger.error('Redis error', { err: err.message }));
redis.on('connect', () => logger.info('Redis connected'));
