import { describe, it, beforeEach, expect, vi, afterEach } from 'vitest';
import { wechatSDK, envs } from './wxsdk';

vi.mock('cross-fetch', async () => {
  const actualFetch = (await import('cross-fetch')).default;
  return {
    ...actualFetch,
    default: vi.fn(),
  };
});

describe('WeChat SDK Builder Tests', () => {
  let mockFetch: any;
  beforeEach(() => {
    mockFetch = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({
        access_token: 'mocked-access-token',
        expires_in: 7200,
      }),
      status: 200,
      ok: true,
      headers: {
        get: vi.fn().mockReturnValue('application/json'),
      }
    });

    globalThis.fetch = mockFetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should fetch access token and return it', async () => {
    const response = await wechatSDK.getAccessToken({
      appid: envs.appId,
      secret: envs.appSecret,
      grant_type: 'client_credential',
    });

    expect(response.access_token).toBe('mocked-access-token');
    expect(mockFetch).toHaveBeenCalledWith(
      `https://api.weixin.qq.com/cgi-bin/token?appid=${envs.appId}&secret=${envs.appSecret}&grant_type=client_credential`,
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

    mockFetch.mockResolvedValueOnce({
      json: vi.fn().mockResolvedValue({ errcode: 0, errmsg: 'ok' }),
      status: 200,
      ok: true,
      headers: {
        get: vi.fn().mockReturnValue('application/json'),
      }
    });

    const sendResult = await wechatSDK.sendTemplateMessage(messagePayload);

    expect(sendResult.errcode).toBe(0);
    expect(sendResult.errmsg).toBe('ok');
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

    mockFetch.mockResolvedValueOnce({
      json: vi.fn().mockResolvedValue(userInfo),
      status: 200,
      ok: true,
      headers: {
        get: vi.fn().mockReturnValue('application/json'),
      }
    });

    const result = await wechatSDK.getUserInfo({ openid });

    expect(result.nickname).toBe('John Doe');
    expect(result.openid).toBe(openid);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.weixin.qq.com/cgi-bin/user/info?openid=user-open-id',
      expect.objectContaining({
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });
});
