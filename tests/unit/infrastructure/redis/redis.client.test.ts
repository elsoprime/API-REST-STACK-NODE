const envMock = {
  REDIS_URL: null as string | null
};

const loggerWarn = vi.fn();
const loggerInfo = vi.fn();
const redisConstructor = vi.fn();

vi.mock('@/config/env', () => ({
  env: envMock
}));

vi.mock('@/infrastructure/logger/logger', () => ({
  logger: {
    warn: loggerWarn,
    info: loggerInfo
  }
}));

vi.mock('ioredis', () => ({
  default: redisConstructor
}));

async function loadRedisModule() {
  vi.resetModules();
  return import('@/infrastructure/redis/redis.client');
}

describe('redis client', () => {
  beforeEach(() => {
    envMock.REDIS_URL = null;
    redisConstructor.mockReset();
    loggerWarn.mockReset();
    loggerInfo.mockReset();
  });

  it('reports redis disabled when REDIS_URL is missing', async () => {
    const redis = await loadRedisModule();

    expect(redis.isRedisEnabled()).toBe(false);
    expect(redis.getRedisClient()).toBeNull();
    expect(redis.hasRedisInitializationAttempted()).toBe(false);
    expect(redisConstructor).not.toHaveBeenCalled();
  });

  it('initializes redis client once and tracks initialization attempt', async () => {
    const on = vi.fn();
    const redisInstance = {
      on,
      quit: vi.fn(),
      disconnect: vi.fn()
    };
    redisConstructor.mockReturnValue(redisInstance);
    envMock.REDIS_URL = 'redis://localhost:6379/0';
    const redis = await loadRedisModule();

    const first = redis.getRedisClient();
    const second = redis.getRedisClient();

    expect(first).toBe(redisInstance);
    expect(second).toBe(redisInstance);
    expect(redis.hasRedisInitializationAttempted()).toBe(true);
    expect(redisConstructor).toHaveBeenCalledTimes(1);
    expect(redisConstructor).toHaveBeenCalledWith('redis://localhost:6379/0', {
      enableReadyCheck: true,
      lazyConnect: false,
      maxRetriesPerRequest: 2
    });
    expect(on).toHaveBeenCalledWith('error', expect.any(Function));
    expect(on).toHaveBeenCalledWith('reconnecting', expect.any(Function));
    expect(on).toHaveBeenCalledWith('ready', expect.any(Function));
  });

  it('closes redis gracefully with quit and resets singleton state', async () => {
    const redisInstance = {
      on: vi.fn(),
      quit: vi.fn().mockResolvedValue('OK'),
      disconnect: vi.fn()
    };
    redisConstructor.mockReturnValue(redisInstance);
    envMock.REDIS_URL = 'redis://localhost:6379/0';
    const redis = await loadRedisModule();

    redis.getRedisClient();
    await redis.closeRedisClient();

    expect(redisInstance.quit).toHaveBeenCalledTimes(1);
    expect(redisInstance.disconnect).not.toHaveBeenCalled();
    expect(redis.hasRedisInitializationAttempted()).toBe(false);

    const rebuilt = redis.getRedisClient();
    expect(rebuilt).toBe(redisInstance);
    expect(redisConstructor).toHaveBeenCalledTimes(2);
  });

  it('falls back to disconnect when quit fails', async () => {
    const redisInstance = {
      on: vi.fn(),
      quit: vi.fn().mockRejectedValue(new Error('quit failed')),
      disconnect: vi.fn()
    };
    redisConstructor.mockReturnValue(redisInstance);
    envMock.REDIS_URL = 'redis://localhost:6379/0';
    const redis = await loadRedisModule();

    redis.getRedisClient();
    await redis.closeRedisClient();

    expect(redisInstance.quit).toHaveBeenCalledTimes(1);
    expect(redisInstance.disconnect).toHaveBeenCalledTimes(1);
    expect(redis.hasRedisInitializationAttempted()).toBe(false);
  });
});
