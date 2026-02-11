import Redis from 'ioredis';
import { config } from '../config.js';

export const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});
