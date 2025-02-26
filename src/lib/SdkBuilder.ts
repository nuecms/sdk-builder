import { CacheProvider } from '../cache/cacheProvider';
import { ResponseTransformer } from '../transformers/responseTransformer';

export interface FetchContext<Params = Record<string, any>> {
  body: Params;
  headers: Record<string, string>;
  path: string;
  method: string;
  endpointName: string;
  url: string;
  params: Record<string, any>;
  extParams?: Record<string, any>;
  config: Record<string, any>;
}

export interface SdkBuilderConfig {
  retryStatus?: (status: number) => boolean;
  validateStatus?: (status: number) => boolean;
  retryDelay?: number;
  maxRetries?: number;
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  baseUrl: string;
  defaultHeaders?: Record<string, string>;
  timeout?: number;
  type?: 'json' | 'text' | 'blob';
  responseFormat?: 'json' | 'text' | 'blob' | 'buffer';
  cacheProvider?: CacheProvider;
  customResponseTransformer?: ResponseTransformer<FetchContext>;
  placeholders?: Record<string, string>;
  config?: Record<string, any>;
  authCheckStatus?: (status: number, response?: object, fetchContext?: FetchContext) => boolean;
}

interface EndpointConfig {
  method: string;
  path: string;
}

interface ExecuteApiCallOptions<Params> {
  method: string;
  body?: Params;
  headers?: Record<string, string>;
  params?: Record<string, any>;
  extParams?: Record<string, any>;
  endpointName: string;
  dataType?: string;
  contentType?: string;
  stringifyBody?: (body: Record<string, any>) => string;
  retryDelay?: number;
  maxRetries?: number;
}

type Params = Record<string, any>;
// argument params
type ArgumentParams = Array<any>;
type Response = any;
type EndpointPureFunction<ArgumentParams extends any[] = any[], Response = any> = (config: Record<string, any>, ...params: ArgumentParams) => Promise<Response>;
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
  validateStatus: function (status: number) {
    return status >= 200 && status < 300; // default
  },
  retryStatus: function (status: number) {
    return status >= 500; // default
  }
};

export const updateDefaultConfig = (config: SdkBuilderConfig): void => {
  Object.assign(defaultConfig, config);
}

export class RequestError extends Error {}

export class SdkBuilder {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;
  private timeout: number;
  private responseFormat: 'json' | 'text' | 'blob' | 'buffer';
  private customResponseTransformer?: ResponseTransformer<FetchContext>;
  private endpoints: Record<string, EndpointConfig>;
  private placeholders: Record<string, string>;
  private config: Record<string, any>;
  private type: string;
  private maxRetries: number;
  private retryDelay: number;
  private method: string;
  public cacheProvider: CacheProvider;
  [x: string]: any;
  authCheckStatus: (status: number, response?: object, fetchContext?: FetchContext) => boolean;

  constructor(config: SdkBuilderConfig) {
    this.baseUrl = config.baseUrl || '';
    this.type = config.type ?? defaultConfig.type;
    this.timeout = config.timeout || defaultConfig.timeout;
    this.maxRetries = config.maxRetries ?? defaultConfig.maxRetries;
    this.retryDelay = config.retryDelay ?? defaultConfig.retryDelay;
    this.responseFormat = config.responseFormat  || defaultConfig.responseFormat;
    this.defaultHeaders = config.defaultHeaders || {};
    this.cacheProvider = config.cacheProvider as CacheProvider;
    this.method = config.method || defaultConfig.method;
    this.customResponseTransformer = config.customResponseTransformer;
    this.authCheckStatus = config.authCheckStatus || defaultConfig.authCheckStatus;
    this.validateStatus = config.validateStatus || defaultConfig.validateStatus;
    this.retryStatus = config.retryStatus || defaultConfig.retryStatus;
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
    P extends EndpointPureFunction<ArgumentParams, Response>
  > (
    name: K,
    path: P
  ): asserts this is this & Record<K, EndpointAFunction<ArgumentParams, Response>>  {
    if (typeof path === 'function') {
      // Register custom function endpoint that uses `this` context
      (this as any)[name] = async (...params: ArgumentParams) => {
        // Bind the current instance context to the `path` function
        return path.apply(this, [this.config, ...params]);
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

  private async executeApiCall<Params extends Record<string, any>, Response>(
    path: string,
    options: ExecuteApiCallOptions<Params>
  ): Promise<Response | undefined> {

    let { method, endpointName, dataType, contentType, stringifyBody, headers: initHeaders, extParams, retryDelay, maxRetries } = options;
    let headers = { ...this.defaultHeaders, ...initHeaders };
    stringifyBody = stringifyBody || ((body: Record<string, any>) => new URLSearchParams(body).toString());
    let body = (options.body ?? {}) as Params;
    let params = (options.params ?? {}) as Record<string, any>;

    // Use options retryDelay and maxRetries if provided, otherwise use instance values
    const usedRetryDelay = retryDelay ?? this.retryDelay;
    const usedMaxRetries = maxRetries ?? this.maxRetries;

    // hooks for intercepting requests
    if (this.requestInterceptor) {
      const modifiedReq = await this.requestInterceptor({
        name: endpointName,
        endpoint: { method, path },
        path,
        method,
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

    headers = await this.resolveHeaders(headers, { ...body, ...params });
    const subUrl = await this.resolvePath(path, body, method, params);
    const url = this.baseUrl + subUrl;

    const requestOptions: any = {
      method,
      headers,
      body
    };

    if (method === 'GET') {
      delete requestOptions.body;
    } else {
      if (body instanceof FormData) {
        delete headers['Content-Type'];
      } else {
        contentType = contentType || dataType || this.type;
        if (contentType === 'json') {
          headers['Content-Type'] = 'application/json';
          requestOptions.body = JSON.stringify(body);
        } else {
          if (contentType.indexOf('/') !== -1) {
            headers['Content-Type'] = contentType;
          } else {
            headers['Content-Type'] = 'application/x-www-form-urlencoded;charset=UTF-8';
          }
          requestOptions.body = stringifyBody(body);
        }
      }
    }

    requestOptions.headers = headers;

    const fetchContext: FetchContext = {
      body, headers, path, method, endpointName, url, params, config: this.config, extParams
    }

    for (let attempt = 0; attempt <= usedMaxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        requestOptions.signal = controller.signal;

        const response = await fetch(url, requestOptions);
        clearTimeout(timeoutId);

        // Check for non-2xx responses
        if (this.authCheckStatus(response.status, response, fetchContext)) {
          // Handle authentication error (401 Unauthorized)
          return this.handleAuthError(endpointName, body, params) as unknown as Response | undefined;
        }

        if(this.validateStatus(response.status)) {
          const resType = response.headers.get('Content-Type') || '';
          const detectedFormat = dataType || this.getResponseFormat(resType) || this.responseFormat;
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
            responseData = this.customResponseTransformer(responseData, fetchContext, response);
          }
          return responseData;
        }
        // sever error
        if (this.retryStatus(response.status) && attempt < usedMaxRetries) {
          await this.delay(usedRetryDelay);
          continue;
        }

        if (response.status === 400) {
          const s = await response.text()
          throw new RequestError(`HTTP Error: ${response.status} ${response.statusText} ${s}`);
        }
      } catch (error) {
        if (usedMaxRetries && attempt >= usedMaxRetries) {
          throw new Error(
            `Request failed after ${usedMaxRetries + 1} attempts: ${(error as Error).message}`
          );
        }
        if ((error as Error).name === 'AbortError') {
          throw new Error(`Request timed out after ${this.timeout}ms`);
        }

        if (error instanceof RequestError) {
          throw error;
        }
        await this.delay(usedRetryDelay);
      }
    }
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
    return this.executeApiCall(endpoint.path, { method: endpoint.method, body, params, endpointName });
  }

  /**
   * Call the API without an endpoint name.
   */
  public async callApiWithoutEndpoint<Params extends Record<string, any>, Response>(
    path: string,
    options: Omit<ExecuteApiCallOptions<Params>, 'endpointName'>
  ): Promise<Response | undefined> {
    return this.executeApiCall(path, { ...options, endpointName: 'custom' });
  }

  /**
   * Public method to make a POST request.
   */
  public async post<Params extends Record<string, any>, Response>(
    path: string,
    options: Omit<ExecuteApiCallOptions<Params>, 'method' | 'endpointName'> & { body: Params }
  ): Promise<Response | undefined> {
    return this.executeApiCall(path, { method: 'POST', ...options, endpointName: 'custom' });
  }

  /**
   * Public method to make a GET request.
   */
  public async get<Params extends Record<string, any>, Response>(
    path: string,
    options: Omit<ExecuteApiCallOptions<Params>, 'method' | 'endpointName'> & { params: Record<string, any>  }
  ): Promise<Response | undefined> {
    return this.executeApiCall(path, { method: 'GET', ...options, endpointName: 'custom' });
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

