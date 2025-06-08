# Local Function Proxy - `@amazon/local-function-proxy`

[![npm version](https://img.shields.io/npm/v/@amazon/local-function-proxy.svg)](https://www.npmjs.com/package/@amazon/local-function-proxy)
[![Node.js CI](https://github.com/amazonmusic/local-function-proxy/actions/workflows/ci.yml/badge.svg)](https://github.com/amazonmusic/local-function-proxy/actions)
[![Downloads](https://img.shields.io/npm/dm/@amazon/local-function-proxy.svg)](https://www.npmjs.com/package/@amazon/local-function-proxy)

A TypeScript decorator library that enables seamless method call proxying between local and proxy environments. Perfect for developers who want to avoid complex local environment setups by proxying specific method calls to a fully configured environment.

## 📋 Overview

This library solves the common development challenge of needing a fully configured environment to test certain functionality. Instead of setting up complex dependencies locally, you can use this library to proxy specific method calls to a remote environment while keeping your local development simple.

## 🌟 Features

- 🚀 Proxy method calls from local to remote environment
- 🔒 Secure communication with SSL/TLS
- 🎯 Support for both static and instance methods
- 🛠️ Custom route configuration
- ⚡ Express.js integration
- 📘 Full TypeScript support
- 🔄 Automatic request/response handling
- 🌐 Dynamic and static proxy URL support
- ⏱️ Configurable timeout per method

## 📘 Quick Example

Go to [`src/examples/express.ts`](src/examples/express.ts) to see ExpressJS based Example.

Or Go to [`src/examples/http.ts`](src/examples/http.ts) to see HTTP Server based Example.

To run locally follow below commands

```sh
# For ExpressJS based example
npm run example:express:start

# For HTTP Server based example
npm run example:http:start
```

## 🔧 Basic Setup

### 1. Initialize the Proxy Decorator

There are multiple ways to configure the proxy behavior:

#### Global Configuration with Static Proxy URL Configuration
```ts
import { DevelopmentProxyInitializer, SecureConfigAdapter } from '@amazon/local-function-proxy';

const { DevelopmentProxy, callActualMethod, resultKey } = new DevelopmentProxyInitializer({
    isProxyEnv: process.env.NODE_ENV === 'proxy',
    isTestEnv: process.env.NODE_ENV === 'local',
    resultKey: 'result',
    targetHeaderKey: 'X-Proxy-Header', // Used for uniquely identifying actual method
    useRuntimeProxyUrl: false,
    proxyUrl: 'http://your-proxy-server.com/proxy', // Global Static proxy URL
    secureConfig: SecureConfigAdapter.getPublicPrivateKeyPairSecureConfig(
        privateKeyContent,
        publicCertContent,
        'X-Custom-Header' // Used for passing secure token
    )
});
```
#### Dynamic Proxy URL Configuration
```ts
const { DevelopmentProxy, callActualMethod, resultKey } = new DevelopmentProxyInitializer({
    isProxyEnv: process.env.NODE_ENV === 'proxy',
    isTestEnv: process.env.NODE_ENV === 'local',
    resultKey: 'result',
    targetHeaderKey: 'X-Proxy-Header',
    useRuntimeProxyUrl: true,  // Enable dynamic proxy URL
    secureConfig: SecureConfigAdapter.getPublicPrivateKeyPairSecureConfig(
        privateKeyContent,
        publicCertContent,
        'X-Custom-Header'
    )
});
```
### 2. Set Up Express Server (Proxy Environment)
```ts
import express from 'express';
import { HttpRouterAdapter } from '@amazon/local-function-proxy';

const app = express();

// Configure proxy router
app.use('/proxy', HttpRouterAdapter.getExpressJsRouter({ 
    callActualMethod, 
    resultKey 
}));

app.listen(3000, () => {
    console.log('Proxy server running on port 3000');
});
```

## 💡 Usage Examples
The @DevelopmentProxy decorator accepts an optional configuration object:
```ts
interface ProxyConfig {
    route?: string;      // Custom route for method disambiguation, required when multiple non-static methods with same name exist
    proxyUrl?: string;   // Static proxy URL for this specific method (overrides global configuration)
    timeout?: number;    // Timeout in milliseconds for this method's proxy calls
}
```

Static Proxy URL (useRuntimeProxyUrl: false)
```ts
// Service class with proxied methods
class UserService {
    // Static method with proxy by using proxy Url passed in global config
    @DevelopmentProxy()
    static async getUserCount(): Promise<number> {
        // This will run in proxy environment
        return await Database.getUserCount();
    }

    // Method-specific proxy URL and timeout
    @DevelopmentProxy({
        proxyUrl: 'http://user-service-proxy:3000/proxy',
        timeout: 5000  // 5 seconds timeout
    })
    async getUserDetails(userId: string): Promise<UserDetails> {
        // This will run in proxy environment
        return await Database.getUserDetails(userId);
    }

    // Custom route with specific timeout
    @DevelopmentProxy({
        route: '/user/preferences',
        timeout: 10000  // 10 seconds timeout
    })
    async getUserPreferences(userId: string): Promise<UserPreferences> {
        // This will run in proxy environment
        return await Database.getUserPreferences(userId);
    }
}

// Usage
const count = await UserService.getUserCount();
const details = await new UserService().getUserDetails('user123');
const preference = await new UserService().getUserPreferences('user123');
```
Dynamic Proxy URL (useRuntimeProxyUrl: true)
```ts
class UserService {
    @DevelopmentProxy()
    static async getUserCount(proxyUrl: string): Promise<number> {
        // This will run in proxy environment
        return await Database.getUserCount();
    }

    @DevelopmentProxy()
    async getUserDetails(proxyUrl: string, userId: string): Promise<UserDetails> {
        // This will run in proxy environment
        return await Database.getUserDetails(userId);
    }
}

// Usage
const count = await UserService.getUserCount('http://proxy-server:3000/proxy');
const details = await new UserService().getUserDetails('http://proxy-server:3000/proxy', 'user123');

```

Custom Route Configuration with Dynamic Proxy URL
```ts
class PaymentService {
    @DevelopmentProxy({ route: '/payment/process' })
    async processPayment(proxyUrl: string, amount: number): Promise<PaymentResult> {
        // This will run in proxy environment
        return await PaymentGateway.process(amount);
    }
}

// Usage
const paymentService = new PaymentService();
const result = await paymentService.processPayment('http://proxy-server:3000/proxy', 100);
```

## 🔐 Security Configuration

The library provides robust security options to ensure your proxy communications are secure:

### Setting up SSL/TLS
```ts
import fs from 'fs';
import path from 'path';

const secureConfig = SecureConfigAdapter.getPublicPrivateKeyPairSecureConfig(
    fs.readFileSync(path.join(__dirname, 'private-key.pem'), 'utf8'),
    fs.readFileSync(path.join(__dirname, 'public-cert.pem'), 'utf8'),
    'X-Security-Header'
);
```

## 🌍 Environment Configuration

### Local Environment (.env.local)
```sh
NODE_ENV=local
PROXY_URL=http://proxy-server.com/proxy
```

### Proxy Environment (.env.proxy)
```sh
NODE_ENV=proxy
PORT=3000
```

## ⚙️ Configuration Options

| Option | Type | Description |
|--------|------|-------------|
| isProxyEnv | boolean | Indicates if current environment is proxy |
| isTestEnv | boolean | Indicates if current environment is local/test |
| resultKey | string | Key used for method results in response |
| targetHeaderKey | string | Custom header for proxy identification |
| proxyUrl | string | URL of the proxy server |
| useRuntimeProxyUrl | boolean | Enable dynamic proxy URL as first parameter |
| secureConfig | SecurityConfig | SSL/TLS configuration |

### Error Handling

The library provides built-in error handling mechanisms:

```ts
try {
  const result = await userService.getUserDetails('user123');
} catch (error) {
  // Error from proxy or actual method execution
  console.error('Error occurred:', error);
}
```

### Timeout Configuration

You can configure timeouts globally or per method:

```ts
// Global timeout in initializer
const { DevelopmentProxy } = new DevelopmentProxyInitializer({
  // ... other options
  timeout: 30000, // 30 seconds global timeout
});

// Method-specific timeout
@DevelopmentProxy({ timeout: 5000 }) // 5 seconds timeout for this method
async getUserProfile(userId: string): Promise<UserProfile> {
  // Method implementation
}
```

## 🧪 Testing

To run the test suite:

```sh
npm test
```

This will execute all tests and generate coverage reports. The library aims to maintain high test coverage to ensure reliability.

## 🔍 Linting

To check for lint issues:

```sh
npm run lint:ci
```

To automatically fix lint issues where possible:

```sh
npm run lint
```

## 📦 Installation

```sh
npm install @amazon/local-function-proxy
```

## 🛡️ Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## 🔖 License

This project is licensed under the Apache-2.0 License.

