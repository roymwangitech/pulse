import Redis from 'ioredis';

let redis: Redis | null = null;

if (process.env.REDIS_URL) {
  try {
    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 5000,
      lazyConnect: true,
    });
    redis.on('error', (err) => {
      console.warn('Redis client connection error:', err.message);
    });
  } catch (err) {
    console.error('Failed to initialize Redis:', err);
  }
} else {
  console.warn('REDIS_URL not set. Redis caching will be bypassed.');
}

export async function getCache<T = unknown>(key: string): Promise<T | null> {
  if (!redis) return null;
  try {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.error('Redis get error:', e);
    return null;
  }
}

export async function setCache<T>(key: string, value: T, ttlSeconds: number = 60): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (e) {
    console.error('Redis set error:', e);
  }
}

export async function delCache(key: string): Promise<void> {
  if (!redis) return;
  try {
    await redis.del(key);
  } catch (e) {
    console.error('Redis del error:', e);
  }
}

export async function invalidateCachePattern(pattern: string): Promise<void> {
  if (!redis) return;
  try {
    let cursor = '0';
    do {
      const reply = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = reply[0];
      const keys = reply[1];
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== '0');
  } catch (e) {
    console.error('Redis scan/del error:', e);
  }
}
