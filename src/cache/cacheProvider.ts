export interface CacheProvider {
  get(key: string): Promise<any>;
  set(key: string, value: any, format: string, ttl: number): Promise<void>;
  delete(key: string): Promise<void>;
}
