import { CacheProvider } from '../cache/cacheProvider';
import { ResponseTransformer } from '../transformers/responseTransformer';

interface SdkBuilderConfig {
  method?: string;
  baseUrl: string;
  defaultHeaders?: Record<string, string>;
  timeout?: number;
  responseFormat?: 'json' | 'xml' | 'text' | 'blob';
  cacheProvider: CacheProvider;
  customResponseTransformer?: ResponseTransformer;
  placeholders?: Record<string, string>;
  config?: Record<string, any>;
}

interface EndpointConfig {
  method: string;
  path: string;
}

export class SdkBuilder {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;
  private timeout: number;
  private responseFormat: 'json' | 'xml' | 'text' | 'blob';
  public cacheProvider: CacheProvider;
  private customResponseTransformer?: ResponseTransformer;
  private endpoints: Record<string, EndpointConfig>;
  private placeholders: Record<string, string>;
  [key: string]: any;

  constructor(config: SdkBuilderConfig) {
    this.baseUrl = config.baseUrl;
    this.defaultHeaders = config.defaultHeaders || {};
    this.timeout = config.timeout || 5000;
    this.responseFormat = config.responseFormat || 'json'; // Default to 'json'
    this.cacheProvider = config.cacheProvider;
    this.method = config.method || 'POST';
    this.customResponseTransformer = config.customResponseTransformer;
    this.placeholders = config.placeholders || {};
    this.config = config.config || {};
    this.endpoints = {};
  }

  // Generic method to register any endpoint
  registerEndpoint(name: string, path: string, method?: string): void {
    method = method || this.method;
    this.endpoints[name] = { method: method || 'POST', path };
    (this as any)[name] = async (...args: any[]) => {
      return this.callApi(name, ...args);
    };
  }

  // Register registerEndpoint shortcut methods for GET and POST requests
  r(name: string, path: string | Function, method?: string): void {
    if (typeof path === 'function') {
      (this as any)['_' + name] = path;
      (this as any)[name] = async (callback: any) => {
        const res = await this['_' + name](this.config);
        callback(res);
      }
      return;
    }
    this.registerEndpoint(name, path, method);
  }


  // Resolves dynamic placeholders in paths (e.g., {access_token} or {openid})
  private async resolvePath(path: string, body: Record<string, any> = {}, method: string, params: Record<string, any> = {}): Promise<string> {
    let url = path;

    let origialParams = { ...body };

    // get cacheProvider token and add to the body
    if (this.cacheProvider) {
      origialParams['token'] = await this.cacheProvider.get('token');
    }

    const holders = { ...this.placeholders };
    if (Object.keys(holders).length > 0) {
      // replace holders values with body values
      for (const [key, value] of Object.entries(holders)) {
        holders[key] = holders[key].replace(`{${key}}`, origialParams[value]);
      }
    }
    let mixParams = { };
    if (method === 'GET') {
      mixParams = { ...holders, ...origialParams };
    } else {
      mixParams = { ...holders, ...params };
    }

    // If the request is a GET request, append body as URL parameters (query parameters)
    if (Object.keys(mixParams).length > 0) {
      const queryParams = new URLSearchParams(origialParams).toString();
      if (queryParams) {
        url += `?${queryParams}`;
      }
    }
    return url;
  }

  request(endpointName: string, body: Record<string, any> = {}, params?: Record<string, any>): Promise<any> {
    return this.callApi(endpointName, body, params);
  }
  auth(callback: (config: any) => void): void {
    // callback(this.config)
    this._auth = callback;
    this._auth(this.config);
  }
  // Method to handle API call execution
  private async callApi(endpointName: string, body: Record<string, any> = {}, params: Record<string, any> = {}): Promise<any> {
    const endpoint = this.endpoints[endpointName];
    if (!endpoint) {
      throw new Error(`Endpoint ${endpointName} not registered`);
    }

    // Merge default headers with headers from body (if provided)
    const headers = { ...this.defaultHeaders };

    const subUrl = await this.resolvePath(endpoint.path, body, endpoint.method, params);

    // Resolve URL path (handling GET query params and dynamic placeholders)
    const url = this.baseUrl + subUrl

    const requestOptions: RequestInit = {
      method: endpoint.method,
      headers: headers,
      body: endpoint.method === 'POST' ? JSON.stringify(body) : undefined, // POST: send body as JSON
    };

    // If GET request, we don't need to include the body in the requestOptions; the body is part of the URL.
    if (endpoint.method === 'GET') {
      delete requestOptions.body; // Remove body for GET requests
    } else if (body instanceof FormData) {
      // Handle FormData for file uploads
      requestOptions.body = body;
      delete headers['Content-Type']; // Allow FormData to set its own Content-Type
    } else {
      requestOptions.body = JSON.stringify(body);
      // Set Content-Type for non-GET requests

      headers['Content-Type'] = 'application/json';
    }

    requestOptions.headers = headers


    // Perform the fetch call
    const response = await fetch(url, requestOptions);
    let data;
    switch (this.responseFormat) {
      case 'json':
        data = await response.json();
        break;
      case 'text':
        data = await response.text();
        break;
      case 'blob':
        data = await response.blob();
        break;
      default:
        throw new Error('Unsupported response format.');
    }

    return this.customResponseTransformer
      ? this.customResponseTransformer(data, this.responseFormat)
      : data;
  }
}

export const sdkBuilder = (config: SdkBuilderConfig) => new SdkBuilder(config);
