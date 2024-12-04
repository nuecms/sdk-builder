import { describe, it, beforeEach, expect, vi } from 'vitest';
import { SdkBuilder } from '../../src/api/SdkBuilder';
import { BrowserCacheProvider } from '../../src/cache/browserProvider';

// Mock the response for WeChat API calls
vi.mock('cross-fetch', async () => {
  const actualFetch = (await import('cross-fetch')).default;
  return {
    ...actualFetch,
    default: vi.fn(),
  };
});



describe('WeChat SDK Builder Tests', () => {
  let weChatSdk: SdkBuilder;
  let mockFetch: any;

  beforeEach(() => {
    mockFetch = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({
        access_token: 'mocked-access-token',
        expires_in: 7200,
      }),
    });

    globalThis.fetch = mockFetch; // Use mockFetch globally
  });

  it('should fetch access token and return it', async () => {
    const appId = 'your-app-id';
    const appSecret = 'your-app-secret';

    // Call the SDK method
    const accessToken = await weChatSdk.getAccessToken({ appid: appId, secret: appSecret });

    // Assertions
    expect(accessToken).toBe('mocked-access-token');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.weixin.qq.com/cgi-bin/token?appid=your-app-id&secret=your-app-secret&grant_type=client_credential',
      expect.objectContaining({
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });

  it('should send template message successfully', async () => {
    const messagePayload = {
      touser: 'user-open-id',
      template_id: 'template-id',
      url: 'https://example.com',
      data: {
        first: { value: 'Hello', color: '#173177' },
        keyword1: { value: 'WeChat SDK', color: '#173177' },
      },
    };

    // Mock the response for sendTemplateMessage
    mockFetch.mockResolvedValueOnce({
      json: vi.fn().mockResolvedValue({ errcode: 0, errmsg: 'ok' }),
    });

    const sendResult = await weChatSdk.sendTemplateMessage(messagePayload);

    expect(sendResult.errcode).toBe(0);
    expect(sendResult.errmsg).toBe('ok');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.weixin.qq.com/cgi-bin/message/template/send',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messagePayload),
      })
    );
  });

  it('should get user information successfully', async () => {
    const openid = 'user-open-id';
    const userInfo = { nickname: 'John Doe', openid: openid };

    // Mock the response for getUserInfo
    mockFetch.mockResolvedValueOnce({
      json: vi.fn().mockResolvedValue(userInfo),
    });

    const result = await weChatSdk.getUserInfo({ openid });

    expect(result.nickname).toBe('John Doe');
    expect(result.openid).toBe(openid);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.weixin.qq.com/cgi-bin/user/info?openid=user-open-id',
      expect.objectContaining({
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });

  it('should cache access token and reuse it', async () => {
    const appId = 'your-app-id';
    const appSecret = 'your-app-secret';

    // Mock the cache provider
    const cacheProvider = new BrowserCacheProvider();
    vi.spyOn(cacheProvider, 'get').mockResolvedValueOnce(null); // Simulate no cache hit
    vi.spyOn(cacheProvider, 'set').mockResolvedValueOnce(undefined); // Simulate setting cache

    // Fetch access token and cache it
    const accessToken = await weChatSdk.getAccessToken({ appid: appId, secret: appSecret });

    // Check that the token was cached
    expect(accessToken).toBe('mocked-access-token');
    expect(cacheProvider.get).toHaveBeenCalledTimes(1);
    expect(cacheProvider.set).toHaveBeenCalledTimes(1);

    // Simulate cache hit
    vi.spyOn(cacheProvider, 'get').mockResolvedValueOnce({ value: 'mocked-access-token' });

    const cachedToken = await weChatSdk.getAccessToken({ appid: appId, secret: appSecret });
    expect(cachedToken).toBe('mocked-access-token');
    expect(cacheProvider.get).toHaveBeenCalledTimes(2);
    expect(cacheProvider.set).toHaveBeenCalledTimes(1); // set should only be called once
  });
});
