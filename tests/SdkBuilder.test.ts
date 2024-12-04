import { describe, it, expect, vi } from 'vitest';
import { sdkBuilder } from '../src/api/SdkBuilder';
import Redis from 'ioredis';
import { RedisCacheProvider } from '../src/cache/redisProvider';

// Extended Redis interface to include a delete method
interface ExtendedRedis extends Redis {
  delete(key: string): Promise<void>;
}



describe('SdkBuilder', () => {
  // Mock Redis implementation
  const mockRedis: Partial<ExtendedRedis> = {
    get: vi.fn().mockResolvedValue('cachedValue'),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(undefined), // Corrected method to `del` for Redis
  };

  // Create an instance of SdkBuilder with the RedisCacheProvider
  const apiClient = sdkBuilder({
    baseUrl: 'https://api.example.com',
    cacheProvider: new RedisCacheProvider(mockRedis as ExtendedRedis), // Injecting custom provider
    responseFormat: 'json',
    placeholders: {
      token: '{token}',
    }
  });

  it('should register and call an endpoint', async () => {
    // Register an endpoint
    apiClient.registerEndpoint('getUser', 'GET', '/users/{token}');

    // Mock Axios and inject it into the apiClient instance
    const mockAxios = vi.fn().mockResolvedValue({ data: { id: '123', name: 'John' } });
    (apiClient as any).axios = mockAxios;

    // Make a call to the registered endpoint
    const response = await apiClient.request('getUser', { token: 'user123' });

    // Verify Axios was called with the correct arguments
    expect(mockAxios).toHaveBeenCalledWith({
      url: 'https://api.example.com/users/user123',
      method: 'GET',
      headers: {},
      params: {},
      data: {},
      timeout: 5000,
    });

    // Verify the response
    expect(response).toEqual({ id: '123', name: 'John' });
  });

  it('should handle response format transformation', async () => {
    // Mock Axios with a string response
    const mockAxios = vi.fn().mockResolvedValue({ data: '{"id":"123","name":"John"}' });
    (apiClient as any).axios = mockAxios;

    // Make a call with a custom response format
    const response = await apiClient.request('getUser', {
      placeholders: { token: 'user123' },
      responseFormat: 'json',
    });

    // Verify the transformed response
    expect(response).toEqual({ id: '123', name: 'John' });
  });

  it('should interact with the cache provider', async () => {
    // Test the RedisCacheProvider interactions
    const cacheKey = 'testKey';
    const cacheValue = 'testValue';

    // Test setting a value in the cache
    await apiClient.cacheProvider.set(cacheKey, cacheValue, 'json', 3600);
    expect(mockRedis.set).toHaveBeenCalledWith(cacheKey, cacheValue);

    // Test retrieving a value from the cache
    const value = await apiClient.cacheProvider.get(cacheKey);
    expect(mockRedis.get).toHaveBeenCalledWith(cacheKey);
    expect(value).toBe('cachedValue');

    // Test deleting a value from the cache
    await apiClient.cacheProvider.delete(cacheKey);
    expect(mockRedis.del).toHaveBeenCalledWith(cacheKey);
  });
});
