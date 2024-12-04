import { CacheProvider } from './cacheProvider';

export class BrowserCacheProvider implements CacheProvider {
  get(key: string): Promise<any> {
    const value = localStorage.getItem(key);
    return Promise.resolve(value ? JSON.parse(value) : null);
  }

  set(key: string, value: any, format: string = 'json', ttl: number = 3600): Promise<void> {
    const expiry = Date.now() + ttl * 1000;
    localStorage.setItem(key, JSON.stringify({ value, format, expiry }));
    return Promise.resolve();
  }

  delete(key: string): Promise<void> {
    localStorage.removeItem(key);
    return Promise.resolve();
  }
}
