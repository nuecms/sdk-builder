import { CacheProvider } from './cacheProvider';
import Redis from 'ioredis';

export class RedisCacheProvider implements CacheProvider {
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  async get(key: string): Promise<any> {
    const value = await this.redis.get(key);
    return value ? JSON.parse(value) : null;
  }

  async set(key: string, value: any, format: string = 'json', ttl: number = 3600): Promise<void> {
    await this.redis.set(key, JSON.stringify({ value, format }), 'EX', ttl);
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }
}
