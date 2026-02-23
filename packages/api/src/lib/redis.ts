import Redis from 'ioredis';
import { config } from '../config.js';

export const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

// ─── Cache Helpers ───

/** Get a cached value by key. Returns null if not found or on error. */
export async function getCache(key: string): Promise<string | null> {
  try {
    return await redis.get(key);
  } catch {
    return null;
  }
}

/** Set a cached value with TTL in seconds. Fails silently. */
export async function setCache(key: string, value: string, ttlSeconds: number): Promise<void> {
  try {
    await redis.set(key, value, 'EX', ttlSeconds);
  } catch {
    // non-critical
  }
}

/** Delete one or more cache keys. Fails silently. */
export async function delCache(...keys: string[]): Promise<void> {
  try {
    if (keys.length > 0) await redis.del(...keys);
  } catch {
    // non-critical
  }
}

/** Delete all cache keys matching a pattern. Fails silently. */
export async function delCachePattern(pattern: string): Promise<void> {
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) await redis.del(...keys);
  } catch {
    // non-critical
  }
}
