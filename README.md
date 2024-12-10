# **SDK Builder**

An advanced, modular SDK Builder for Node.js applications that simplifies API client creation. Supports dynamic endpoints, caching, custom response handling, and more — fully written in TypeScript for type safety and developer-friendly integration.

---

## **Features**

- **Dynamic Endpoints**: Easily register and manage API endpoints with placeholder support (`{id}`).
- **Caching Support**: Integrate with caching providers like Redis for optimized performance.
- **Flexible Response Formats**: Built-in support for `JSON`, `XML`, and `TEXT` formats with custom transformations.
- **Error Handling**: Graceful error handling and detailed error messages for debugging.
- **Path Placeholder Resolution**: Automatically replace placeholders like `{token}` with dynamic values.
- **TypeScript Ready**: Fully typed for robust, error-free coding.

---

## **Table of Contents**

- [**SDK Builder**](#sdk-builder)
  - [**Features**](#features)
  - [**Table of Contents**](#table-of-contents)
  - [**Installation**](#installation)
  - [**Quick Start**](#quick-start)
    - [1. Import and Initialize the SDK Builder](#1-import-and-initialize-the-sdk-builder)
    - [2. Register API Endpoints](#2-register-api-endpoints)
    - [3. Make API Calls](#3-make-api-calls)
  - [**Usage Examples**](#usage-examples)
    - [Registering Endpoints](#registering-endpoints)
    - [Making API Calls](#making-api-calls)
    - [Response Formats](#response-formats)
    - [Caching with Redis](#caching-with-redis)
  - [**Advanced Features**](#advanced-features)
    - [Custom Response Transformation](#custom-response-transformation)
  - [**Contributing**](#contributing)
  - [**License**](#license)

---

## **Installation**

Install the SDK using `pnpm` or `yarn`:

```bash
pnpm add @nuecms/sdk-builder
# or
yarn add @nuecms/sdk-builder
```

---

## **Quick Start**

### 1. Import and Initialize the SDK Builder

```typescript
import { SdkBuilder } from '@nuecms/sdk-builder';

const apiClient = new SdkBuilder({
  baseUrl: 'https://api.example.com',
  defaultHeaders: {
    Authorization: 'Bearer {access_token}',
    'Content-Type': 'application/json',
  },
  timeout: 5000,
});
```

### 2. Register API Endpoints

```typescript
apiClient.r('getUser', '/users/{id}', 'GET');
apiClient.r('createUser', '/users', 'POST');
```

### 3. Make API Calls

```typescript
const user = await apiClient.getUser({ id: '12345' });
console.log(user);
```

---

## **Usage Examples**

### Registering Endpoints

Register endpoints with their HTTP method, path, and dynamic placeholders (e.g., `{id}`):

```typescript
apiClient.r('getUser', '/users/{id}', 'GET');
apiClient.r('deleteUser', '/users/{id}', 'DELETE');
apiClient.r('createUser', '/users', 'POST');
```

### Making API Calls

Call the registered endpoints dynamically with placeholders and additional options:

```typescript
const userDetails = await apiClient.getUser({ id: '12345' });

console.log(userDetails);
```

### Response Formats

The SDK supports multiple response formats:

- **JSON** (default)
- **Blob**
- **TEXT**

You can specify a format per request or set a global default:

```typescript
const apiClient = new SdkBuilder({
  baseUrl: 'https://api.example.com',
  defaultHeaders: {
    Authorization: 'Bearer {access_token}',
    'Content-Type': 'application/json',
  },
  timeout: 5000,
  responseFormat: 'json', // Default response format
});

```

### Caching with Redis

Integrate caching with `ioredis` or any custom provider:

```typescript
import Redis from 'ioredis';
import { RedisCacheProvider } from '@nuecms/sdk-builder';

const apiClient = new SdkBuilder({
  baseUrl: 'https://api.example.com',
  defaultHeaders: {
    Authorization: 'Bearer {access_token}',
    'Content-Type': 'application/json',
  },
  cacheProvider: new RedisCacheProvider(new Redis()),
});

// Example: Cache a response
await apiClient.cacheProvider.set('user:12345', JSON.stringify(userDetails), 'json', 3600);

// Example: Retrieve a cached response
const cachedUser = await apiClient.cacheProvider.get('user:12345');
console.log(cachedUser);
```

---

## **Advanced Features**

### Custom Response Transformation

Transform API responses dynamically based on the format:

```typescript
const customTransformer = (data: any, format: string) => {
  if (format === 'json' && data?.user) {
    data.user.name = data.user.name.toUpperCase(); // Custom transformation
  }
  return data;
};

const apiClient = new SdkBuilder({
  baseUrl: 'https://api.example.com',
  customResponseTransformer: customTransformer,
});
```



---

## **Contributing**

We welcome contributions to improve this SDK! To get started:

1. Fork the repository.
2. Create a new branch (`git checkout -b feature-name`).
3. Commit your changes (`git commit -m "Add feature X"`).
4. Push to the branch (`git push origin feature-name`).
5. Open a pull request.

---

## **License**

This SDK is released under the **MIT License**. You’re free to use, modify, and distribute this project. See the `LICENSE` file for more details.

