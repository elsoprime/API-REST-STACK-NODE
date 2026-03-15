import Redis from 'ioredis';

import { env } from '@/config/env';
import { logger } from '@/infrastructure/logger/logger';

let redisClient: Redis | null = null;
let redisInitAttempted = false;

function buildRedisClient(): Redis {
  const client = new Redis(env.REDIS_URL ?? '', {
    enableReadyCheck: true,
    lazyConnect: false,
    maxRetriesPerRequest: 2
  });

  client.on('error', (error) => {
    logger.warn(
      {
        scope: 'redis.error',
        message: error.message
      },
      'Redis client emitted an error.'
    );
  });

  client.on('reconnecting', () => {
    logger.warn({ scope: 'redis.reconnecting' }, 'Redis client attempting to reconnect.');
  });

  client.on('ready', () => {
    logger.info({ scope: 'redis.ready' }, 'Redis client connection established.');
  });

  return client;
}

export function isRedisEnabled(): boolean {
  return Boolean(env.REDIS_URL);
}

export function getRedisClient(): Redis | null {
  if (!env.REDIS_URL) {
    return null;
  }

  if (!redisClient) {
    redisInitAttempted = true;
    redisClient = buildRedisClient();
  }

  return redisClient;
}

export async function closeRedisClient(): Promise<void> {
  if (!redisClient) {
    return;
  }

  try {
    await redisClient.quit();
  } catch {
    redisClient.disconnect();
  } finally {
    redisClient = null;
    redisInitAttempted = false;
  }
}

export function hasRedisInitializationAttempted(): boolean {
  return redisInitAttempted;
}
