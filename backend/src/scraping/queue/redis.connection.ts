import IORedis, { RedisOptions } from 'ioredis';

export const QUEUE_NAME = process.env.SCRAPING_QUEUE_NAME ?? 'scraping';

export function buildRedisOptions(): RedisOptions {
  return {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT ?? 6379),
    maxRetriesPerRequest: null,
  };
}

export function createRedisConnection(): IORedis {
  return new IORedis(buildRedisOptions());
}
