import { sdkBuilder } from '../../src/lib/SdkBuilder';
import { RedisCacheProvider } from '../../src/cache/redisProvider';
import Redis from 'ioredis';

const weChatSdk = sdkBuilder({
  baseUrl: 'https://api.weixin.qq.com',
  cacheProvider: new RedisCacheProvider(new Redis()),
  placeholders: {
    access_token: '{access_token}',
  },
  config: {
    appId: 'wx95e5a58207fb5f67',
    appSecret: '282323a19761e2baba5e5b24ad60fa0f',
  }
});

const routes = {
  'getAccessToken': 'GET /cgi-bin/token', // Get access token
  'getJsapiTicket': 'GET /cgi-bin/ticket/getticket', // Get JS API ticket
  'getOAuthAccessToken': 'GET /sns/oauth2/access_token', // OAuth2.0 access token
  'getOAuthUserInfo': 'GET /sns/oauth2/userinfo', // Get user info from OAuth2.0

  // Messaging and Template Messages
  'sendTemplateMessage': 'POST /cgi-bin/message/template/send', // Send template message
  'sendCustomMessage': 'POST /cgi-bin/message/custom/send', // Send custom message
  'sendMassMessage': 'POST /cgi-bin/message/mass/send', // Send mass message (broadcast)

  // User Management
  'getUserInfo': 'GET /cgi-bin/user/info', // Get user info (openId)
  'batchGetUserInfo': 'POST /cgi-bin/user/info/batchget', // Batch get user info
  'getUserList': 'GET /cgi-bin/user/get', // Get user list (list of subscribers)
  'getBlacklist': 'GET /cgi-bin/tags/members/getblacklist', // Get the blacklisted users

  // Menu Management
  'createMenu': 'POST /cgi-bin/menu/create', // Create custom menu
  'getMenu': 'GET /cgi-bin/menu/get', // Get current custom menu
  'deleteMenu': 'GET /cgi-bin/menu/delete', // Delete custom menu

  // Tags Management
  'createTag': 'POST /cgi-bin/tags/create', // Create tag
  'getTags': 'GET /cgi-bin/tags/get', // Get tags list
  'updateTag': 'POST /cgi-bin/tags/update', // Update tag
  'deleteTag': 'POST /cgi-bin/tags/delete', // Delete tag
  'tagUser': 'POST /cgi-bin/tags/members/batchtagging', // Add users to a tag
  'untagUser': 'POST /cgi-bin/tags/members/batchuntagging', // Remove users from a tag

  // Material Management
  'uploadMedia': 'POST /cgi-bin/media/upload', // Upload media (image/video/etc.)
  'getMedia': 'GET /cgi-bin/media/get', // Get media (file by mediaId)
  'uploadNews': 'POST /cgi-bin/material/add_news', // Upload news articles (permanent material)
  'getNews': 'GET /cgi-bin/material/get_material', // Get permanent material
  'deleteMaterial': 'POST /cgi-bin/material/del_material', // Delete material

  // Customer Service
  'sendCustomerServiceMessage': 'POST /cgi-bin/message/custom/send', // Send custom service message to user
  'getKfAccountList': 'GET /cgi-bin/customservice/getkflist', // Get the list of customer service accounts
  'addKfAccount': 'POST /cgi-bin/customservice/addkfaccount', // Add customer service account
  'updateKfAccount': 'POST /cgi-bin/customservice/updatekfalias', // Update customer service account alias
  'deleteKfAccount': 'POST /cgi-bin/customservice/delkfalias', // Delete customer service account

  // Analytics & Data
  'getUserSummary': 'GET /cgi-bin/datacube/getusersummary', // Get user summary data
  'getUserCumulate': 'GET /cgi-bin/datacube/getusercumulate', // Get cumulative user data
  'getArticleSummary': 'GET /cgi-bin/datacube/getarticlesummary', // Get article summary data
  'getArticleData': 'GET /cgi-bin/datacube/getarticledatainfo', // Get article reading data

  // Others
  'shorturl': 'POST /cgi-bin/shorturl', // Generate short URL
  'setIndustry': 'POST /cgi-bin/template/api_set_industry', // Set industry for template messages
  'getIndustry': 'GET /cgi-bin/template/get_industry', // Get current industry settings
  'addWhitelist': 'POST /cgi-bin/template/api_add_to_template', // Add template to whitelist
};
for (const [key, value] of Object.entries(routes)) {
  const [method, path] = value.split(' ');
  weChatSdk.r(key, path, method);
}


// Register the auth method
weChatSdk.r('auth', async (config: any) => {
  const appId = config.appId;
  const appSecret = config.appSecret
  const cacheKey = `wechat_access_token_${appId}`;
  const cachedToken = await weChatSdk.cacheProvider?.get(cacheKey);
  if (cachedToken) {
    return cachedToken.value;
  }
  const response = await weChatSdk.request('getAccessToken', { appid: appId, secret: appSecret, grant_type: 'client_credential' });
  // const accessToken = response.access_token;
  const expiresIn = response.expires_in || 7200;
  await weChatSdk.cacheProvider?.set(cacheKey, response, 'json', expiresIn);
  return response;
})



export { weChatSdk, routes };


