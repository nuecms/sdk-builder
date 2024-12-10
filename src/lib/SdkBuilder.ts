import { CacheProvider } from '../cache/cacheProvider';
import { ResponseTransformer } from '../transformers/responseTransformer';

export interface SdkBuilderConfig {
  retryDelay?: number;
  maxRetries?: number;
  method?: string;
  baseUrl: string;
  defaultHeaders?: Record<string, string>;
  timeout?: number;
  type?: 'json' | 'text' | 'blob';
  responseFormat?: 'json' | 'text' | 'blob' | 'buffer';
  cacheProvider: CacheProvider;
  customResponseTransformer?: ResponseTransformer;
  placeholders?: Record<string, string>;
  config?: Record<string, any>;
  authCheckStatus?: (status: number, response?: object) => boolean;
}

interface EndpointConfig {
  method: string;
  path: string;
}


type Params = Record<string, any>;
type Response = any;
type EndpointPureFunction<Params = any, Response = any> = (config: Record<string, any>, params?: Params) => Promise<Response>;
type EndpointAFunction<Params = any, Response = any> = (params?: Params) => Promise<Response>;
type EndpointBFunction<Params = any, Response = any> = (params: Params, extParams?: any) => Promise<Response>;


export const defaultConfig = {
  defaultHeaders: {
    'Content-Type': 'application/json',
  },
  timeout: 5000,
  type: 'json',
  responseFormat: 'json' as const,
  maxRetries: 3,
  retryDelay: 500,
  method: 'POST',
  config: {},
  placeholders: {},
  authCheckStatus: (status: number) => status === 401,
};

export const updateDefaultConfig = (config: SdkBuilderConfig): void => {
  Object.assign(defaultConfig, config);
}

export class SdkBuilder {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;
  private timeout: number;
  private responseFormat: 'json' | 'text' | 'blob' | 'buffer';
  private customResponseTransformer?: ResponseTransformer;
  private endpoints: Record<string, EndpointConfig>;
  private placeholders: Record<string, string>;
  private config: Record<string, any>;
  private type: string;
  private maxRetries: number;
  private retryDelay: number;
  private method: string;
  public cacheProvider: CacheProvider;
  [x: string]: any;
  authCheckStatus: (status: number, response?: object) => boolean;

  constructor(config: SdkBuilderConfig) {
    this.baseUrl = config.baseUrl || '';
    this.type = config.type ?? defaultConfig.type;
    this.timeout = config.timeout || defaultConfig.timeout;
    this.maxRetries = config.maxRetries || defaultConfig.maxRetries;
    this.retryDelay = config.retryDelay || defaultConfig.retryDelay;
    this.responseFormat = config.responseFormat  || defaultConfig.responseFormat;
    this.defaultHeaders = config.defaultHeaders || {};
    this.cacheProvider = config.cacheProvider as CacheProvider;
    this.method = config.method || defaultConfig.method;
    this.customResponseTransformer = config.customResponseTransformer;
    this.authCheckStatus = config.authCheckStatus || defaultConfig.authCheckStatus;
    this.placeholders = config.placeholders || defaultConfig.placeholders;
    this.config = config.config || defaultConfig.config;

    this.endpoints = {};
    if (this.type === 'json') {
      this.defaultHeaders['Content-Type'] = 'application/json';
    }
  }

  /**
   * Registers a new endpoint.
   */
  public r<
    K extends string,
    P extends string,
  > (
    name: K,
    path: P,
    method: string = this.method
  ): asserts this is this & Record<K, EndpointBFunction<Params, Response>> {
    // Register standard API endpoint
    this.endpoints[name] = { method, path };
    (this as any)[name] = async (params: Params, extParams: any) => {
      return this.callApi<Params, Response>(name, params, extParams);
    };
    return this as any;
  }

  /**
   * Registers a new endpoint with options.
   */
  public z<
    K extends string,
    P extends Record<string, any>,
  > (
    name: K,
    opt: P,
  ): asserts this is this & Record<K, EndpointBFunction<Params, Response>> {
    // Register standard API endpoint
    this.endpoints[name] = { ...opt, method: opt.method, path: opt.path };
    (this as any)[name] = async (params: Params, extParams: any) => {
      return this.callApi<Params, Response>(name, params, extParams);
    };
    return this as any;
  }

  /**
   * Registers a custom function.
   */
    public rx<
    K extends string,
    P extends EndpointPureFunction<Params, Response>
  > (
    name: K,
    path: P
  ): asserts this is this & Record<K, EndpointAFunction<Params, Response>>  {
    if (typeof path === 'function') {
      // Register custom function endpoint that uses `this` context
      (this as any)[name] = async (params?: Params) => {
        // Bind the current instance context to the `path` function
        return path.call(this, this.config, params);
      };
    }
    return this as any;
  }

  /**
   * Enhances the current configuration with new values.
   */
  public async enhanceConfig(config: Record<string, any>): Promise<void> {
    this.config = { ...this.config, ...config };
  }

  // Set the request interceptor
  public async requestInterceptor(req: any): Promise<any> {
    if (this.reqInterceptor) {
      return this.reqInterceptor(req);
    }
    return req;
  }
  // Handle authentication errors
  private async handleAuthError(endpointName: string, body: Record<string, any>, params: Record<string, any>) {
    if (this.authenticate) {
      try {
        // Attempt to re-authenticate
        const config = await this.authenticate();
        this.enhanceConfig(config); // Update placeholders with new token
        // Retry the original request with updated placeholders
        return this.callApi(endpointName, body, params);
      } catch (error: any) {
        throw new Error('Re-authentication failed: ' + error.message);
      }
    }
    throw new Error('Authentication error and no authentication hook provided');
  }
  // Call the API with retries and timeouts
  private async callApi<Params extends Record<string, any>, Response>(
    endpointName: string,
    body: Params,
    params: Record<string, any>
  ): Promise<Response | undefined> {
    const endpoint = this.endpoints[endpointName];
    if (!endpoint) {
      throw new Error(`Endpoint ${endpointName} not registered`);
    }

    let headers = { ...this.defaultHeaders };
    let path = endpoint.path;

    // hooks for intercepting requests
    if (this.requestInterceptor) {
      const modifiedReq = await this.requestInterceptor({
        name: endpointName,
        endpoint: endpoint,
        path: endpoint.path,
        method: endpoint.method,
        body,
        headers: headers,
        params,
      });
      if (modifiedReq.body) {
        body = modifiedReq.body;
      }
      if (modifiedReq.headers) {
        headers = modifiedReq.headers;
      }
      if (modifiedReq.path) {
        path = modifiedReq.path;
      }
    }

    headers = await this.resolveHeaders(headers, {...body, ...params});
    const subUrl = await this.resolvePath(path, body, endpoint.method, params);
    const url = this.baseUrl + subUrl;

    const requestOptions: RequestInit = {
      method: endpoint.method,
      headers,
      body: endpoint.method === 'POST' ? JSON.stringify(body) : undefined,
    };

    if (endpoint.method === 'GET') {
      delete requestOptions.body;
    } else if (body instanceof FormData) {
      requestOptions.body = body;
      delete headers['Content-Type'];
    } else {
      headers['Content-Type'] = 'application/json';
    }

    requestOptions.headers = headers;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        requestOptions.signal = controller.signal;

        const response = await fetch(url, requestOptions);
        clearTimeout(timeoutId);

        // Check for non-2xx responses
        if (this.authCheckStatus(response.status, response)) {
          // Handle authentication error (401 Unauthorized)
          return this.handleAuthError(endpointName, body, params) as unknown as Response | undefined;
        }

        if (!response.ok) {
          if (response.status >= 500 && attempt < this.maxRetries) {
            await this.delay(this.retryDelay);
            continue;
          }
          throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
        }

        const contentType = response.headers.get('Content-Type') || '';
        const detectedFormat = this.getResponseFormat(contentType) || this.responseFormat;

        let responseData;
        switch (detectedFormat) {
          case 'json':
            responseData = await response.json();
            break;
          case 'text':
            responseData = await response.text();
            break;
          case 'blob':
            responseData = await response.blob();
            break;
          case 'buffer':
            const resBuffer = await response.arrayBuffer();
            responseData = Buffer.from(resBuffer);
            break;
          default:
            throw new Error('Unsupported response format.');
        }

        if (this.customResponseTransformer) {
          responseData = this.customResponseTransformer(responseData, requestOptions);
        }

        return responseData;
      } catch (error) {
        if (attempt >= this.maxRetries) {
          throw new Error(
            `Request failed after ${this.maxRetries + 1} attempts: ${(error as Error).message}`
          );
        }
        if ((error as Error).name === 'AbortError') {
          throw new Error(`Request timed out after ${this.timeout}ms`);
        }
        await this.delay(this.retryDelay);
      }
    }
  }
  // Resolves placeholders in the headers with values from the config or body
  private async resolveHeaders(headers: Record<string, string>, body: Record<string, any>): Promise<Record<string, string>> {
    const resolvedHeaders = { ...headers };
    for (const [key, value] of Object.entries(resolvedHeaders)) {
      resolvedHeaders[key] = value.replace(/{([^}]+)}/g, (_, match) => body[match]);
    }
    return resolvedHeaders;
  }

  // Determine response format based on the Content-Type header
  private getResponseFormat(contentType: string): 'json' | 'text' | 'blob' | 'buffer' | undefined {
    if (contentType.includes('application/json')) {
      return 'json';
    } else if (contentType.includes('text/')) {
      return 'text';
    } else if (contentType.includes('application/octet-stream')) {
      return 'buffer';
    } else if (contentType.includes('image/') || contentType.includes('application/pdf')) {
      return 'blob';
    }
    // throw new Error('Unsupported Content-Type for response format.');
  }

  // Resolves placeholders in the path with values from the config or body
  private async resolvePath(
    path: string,
    body: Record<string, any> = {},
    method: string,
    params: Record<string, any> = {}
  ): Promise<string> {
    let url = path;

    const origialParams = { ...this.config, ...body };

    const holders = { ...this.placeholders };
    if (Object.keys(holders).length > 0) {
      for (const [key, _value] of Object.entries(holders)) {
        holders[key] = holders[key].replace(`{${key}}`, origialParams[key] || '');
      }
    }
    // make sure holders obj not exist ''
    for (const [key, value] of Object.entries(holders)) {
      if (value === '') {
        delete holders[key];
      }
    }
    let mixParams = {};
    if (method === 'GET') {
      mixParams = { ...holders, ...body };
    } else {
      mixParams = { ...holders, ...params };
    }

    if (Object.keys(mixParams).length > 0) {
      const queryParams = new URLSearchParams(mixParams).toString();
      if (queryParams) {
        if (url.includes('?')) {
          url += `&${queryParams}`;
        } else {
          url += `?${queryParams}`;
        }
      }
    }
    return url;
  }
  // Delay function for retries
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const sdkBuilder = (config: SdkBuilderConfig): SdkBuilder & Record<string, any> => new SdkBuilder(config);

