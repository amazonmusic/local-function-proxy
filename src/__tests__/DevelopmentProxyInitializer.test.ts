/* tslint:disable no-unused-expression */
/* tslint:disable:max-classes-per-file */
import { DevelopmentProxyInitializer } from '..';
import {
  DEFAULT_PROXY_CALL_TIMEOUT_MS,
  DEFAULT_PROXY_SECURITY_TIMEOUT_MS,
  DEFAULT_RESULT_KEY,
  DEFAULT_TARGET_HEADER_KEY,
} from '../constants';
import { ProxyUtil, SecurityUtil } from '../utils';

jest.mock('../utils', () => ({
  ProxyUtil: {
    makeProxyCall: jest.fn(),
  },
  SecurityUtil: {
    validateProxyHeader: jest.fn(),
    getSecureHeaderMap: jest.fn(),
  },
}));

describe('DevelopmentProxyInitializer', () => {
  const mockEncrypt = jest.fn();
  const mockDecrypt = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    // default to a permissive security check unless a test overrides it
    (SecurityUtil.validateProxyHeader as jest.Mock).mockResolvedValue(true);
    (SecurityUtil.getSecureHeaderMap as jest.Mock).mockResolvedValue({});
  });

  describe('constructor and config validation', () => {
    it('should throw error when both isProxyEnv and isTestEnv are true', () => {
      expect(() => {
        new DevelopmentProxyInitializer({
          isProxyEnv: true,
          isTestEnv: true,
          proxyUrl: 'http://localhost',
        } as any);
      }).toThrow("Test environment can't be Proxy environment too");
    });

    it('should throw error when useRuntimeProxyUrl is false and proxyUrl is not provided', () => {
      expect(() => {
        new DevelopmentProxyInitializer({
          isProxyEnv: true,
          isTestEnv: false,
          useRuntimeProxyUrl: false,
        } as any);
      }).toThrow('proxyHost is required argument when useRuntimeProxyUrl is false');
    });

    it('should throw error when neither proxyUrl nor useRuntimeProxyUrl is provided', () => {
      // useRuntimeProxyUrl defaults to false, so proxyUrl becomes mandatory
      expect(() => {
        new DevelopmentProxyInitializer({ isTestEnv: true } as any);
      }).toThrow('proxyHost is required argument when useRuntimeProxyUrl is false');
    });

    it('should not require proxyUrl when useRuntimeProxyUrl is true', () => {
      expect(() => {
        new DevelopmentProxyInitializer({ isTestEnv: true, useRuntimeProxyUrl: true } as any);
      }).not.toThrow();
    });

    it('should throw error when secureConfig is provided without headerKey', () => {
      expect(() => {
        new DevelopmentProxyInitializer({
          isProxyEnv: true,
          proxyUrl: 'http://localhost',
          secureConfig: {
            encrypt: mockEncrypt,
            decrypt: mockDecrypt,
          },
        } as any);
      }).toThrow('secureConfig.headerKey is required');
    });

    it('should throw error when secureConfig is provided without encrypt/decrypt', () => {
      expect(() => {
        new DevelopmentProxyInitializer({
          isProxyEnv: true,
          proxyUrl: 'http://localhost',
          secureConfig: {
            headerKey: 'x-proxy-token',
          },
        } as any);
      }).toThrow('secureConfig.encrypt and secureConfig.decrypt are required');
    });

    it('should throw error when secureConfig provides encrypt but not decrypt', () => {
      expect(() => {
        new DevelopmentProxyInitializer({
          isProxyEnv: true,
          proxyUrl: 'http://localhost',
          secureConfig: { headerKey: 'x-proxy-token', encrypt: mockEncrypt },
        } as any);
      }).toThrow('secureConfig.encrypt and secureConfig.decrypt are required');
    });

    it('should throw error when secureConfig provides decrypt but not encrypt', () => {
      expect(() => {
        new DevelopmentProxyInitializer({
          isProxyEnv: true,
          proxyUrl: 'http://localhost',
          secureConfig: { headerKey: 'x-proxy-token', decrypt: mockDecrypt },
        } as any);
      }).toThrow('secureConfig.encrypt and secureConfig.decrypt are required');
    });

    it('should set default timeoutMS when not provided in secureConfig', () => {
      const initializer = new DevelopmentProxyInitializer({
        isProxyEnv: true,
        proxyUrl: 'http://localhost',
        secureConfig: {
          headerKey: 'x-proxy-token',
          encrypt: mockEncrypt,
          decrypt: mockDecrypt,
        },
      } as any);
      // @ts-expect-error reaching into private config for assertion
      expect(initializer._config.secureConfig!.timeoutMS).toBe(DEFAULT_PROXY_SECURITY_TIMEOUT_MS);
    });

    it('should preserve an explicitly provided secureConfig timeoutMS', () => {
      const initializer = new DevelopmentProxyInitializer({
        isProxyEnv: true,
        proxyUrl: 'http://localhost',
        secureConfig: {
          headerKey: 'x-proxy-token',
          encrypt: mockEncrypt,
          decrypt: mockDecrypt,
          timeoutMS: 1234,
        },
      } as any);
      // @ts-expect-error reaching into private config for assertion
      expect(initializer._config.secureConfig!.timeoutMS).toBe(1234);
    });

    it('should treat a zero secureConfig timeoutMS as unset and apply the default', () => {
      const initializer = new DevelopmentProxyInitializer({
        isProxyEnv: true,
        proxyUrl: 'http://localhost',
        secureConfig: {
          headerKey: 'x-proxy-token',
          encrypt: mockEncrypt,
          decrypt: mockDecrypt,
          timeoutMS: 0,
        },
      } as any);
      // @ts-expect-error reaching into private config for assertion
      expect(initializer._config.secureConfig!.timeoutMS).toBe(DEFAULT_PROXY_SECURITY_TIMEOUT_MS);
    });

    it('should allow both isProxyEnv and isTestEnv to be false', () => {
      expect(() => {
        new DevelopmentProxyInitializer({ proxyUrl: 'http://localhost' } as any);
      }).not.toThrow();
    });
  });

  describe('resultKey', () => {
    it('should expose the default resultKey when none is configured', () => {
      const initializer = new DevelopmentProxyInitializer({
        isProxyEnv: true,
        proxyUrl: 'http://localhost',
      } as any);
      expect(initializer.resultKey).toBe(DEFAULT_RESULT_KEY);
    });

    it('should expose a custom configured resultKey', () => {
      const initializer = new DevelopmentProxyInitializer({
        isProxyEnv: true,
        proxyUrl: 'http://localhost',
        resultKey: 'payload',
      } as any);
      expect(initializer.resultKey).toBe('payload');
    });
  });

  describe('DevelopmentProxy decorator', () => {
    it('should make proxy call in test environment', async () => {
      const initializer = new DevelopmentProxyInitializer({
        isTestEnv: true,
        proxyUrl: 'http://localhost',
      } as any);

      const mockResult = { result: 'test' };
      (ProxyUtil.makeProxyCall as jest.Mock).mockResolvedValue(mockResult);

      const DevelopmentProxy = initializer.DevelopmentProxy.bind(initializer);

      class TestClass {
        @DevelopmentProxy({ route: '/test' })
        async testMethod(_url: string, _param: string) {
          return 'original';
        }
      }

      const instance = new TestClass();
      const result = await instance.testMethod('http://test.com', 'param');

      expect(result).toBe('test');
      expect(ProxyUtil.makeProxyCall).toHaveBeenCalledWith({
        fullProxyUrl: 'http://localhost/test',
        headers: {
          'X-Proxy-Target': 'testMethod',
        },
        timeout: DEFAULT_PROXY_CALL_TIMEOUT_MS,
        args: ['http://test.com', 'param'],
      });
    });

    it('should call with no route suffix and default timeout when decorator gets no input', async () => {
      const initializer = new DevelopmentProxyInitializer({
        isTestEnv: true,
        proxyUrl: 'http://localhost',
      } as any);
      (ProxyUtil.makeProxyCall as jest.Mock).mockResolvedValue({ result: 'ok' });
      const DevelopmentProxy = initializer.DevelopmentProxy.bind(initializer);

      class TestClass {
        @DevelopmentProxy()
        async testMethod() {
          return 'original';
        }
      }

      await new TestClass().testMethod();

      expect(ProxyUtil.makeProxyCall).toHaveBeenCalledWith(
        expect.objectContaining({
          fullProxyUrl: 'http://localhost',
          timeout: DEFAULT_PROXY_CALL_TIMEOUT_MS,
          args: [],
        }),
      );
    });

    it('should prefer the decorator proxyUrl over the configured proxyUrl', async () => {
      const initializer = new DevelopmentProxyInitializer({
        isTestEnv: true,
        proxyUrl: 'http://configured',
      } as any);
      (ProxyUtil.makeProxyCall as jest.Mock).mockResolvedValue({ result: 'ok' });
      const DevelopmentProxy = initializer.DevelopmentProxy.bind(initializer);

      class TestClass {
        @DevelopmentProxy({ proxyUrl: 'http://decorator', route: '/r' })
        async testMethod() {
          return 'original';
        }
      }

      await new TestClass().testMethod();

      expect(ProxyUtil.makeProxyCall).toHaveBeenCalledWith(
        expect.objectContaining({ fullProxyUrl: 'http://decorator/r' }),
      );
    });

    it('should prefer the decorator proxyUrl even when useRuntimeProxyUrl is true', async () => {
      const initializer = new DevelopmentProxyInitializer({
        isTestEnv: true,
        useRuntimeProxyUrl: true,
      } as any);
      (ProxyUtil.makeProxyCall as jest.Mock).mockResolvedValue({ result: 'ok' });
      const DevelopmentProxy = initializer.DevelopmentProxy.bind(initializer);

      class TestClass {
        @DevelopmentProxy({ proxyUrl: 'http://decorator' })
        async testMethod(_url: string) {
          return 'original';
        }
      }

      await new TestClass().testMethod('http://runtime');

      expect(ProxyUtil.makeProxyCall).toHaveBeenCalledWith(
        expect.objectContaining({ fullProxyUrl: 'http://decorator' }),
      );
    });

    it('should use the first argument as proxy url when useRuntimeProxyUrl is true', async () => {
      const initializer = new DevelopmentProxyInitializer({
        isTestEnv: true,
        useRuntimeProxyUrl: true,
      } as any);
      (ProxyUtil.makeProxyCall as jest.Mock).mockResolvedValue({ result: 'ok' });
      const DevelopmentProxy = initializer.DevelopmentProxy.bind(initializer);

      class TestClass {
        @DevelopmentProxy({ route: '/runtime' })
        async testMethod(_url: string, _param: string) {
          return 'original';
        }
      }

      await new TestClass().testMethod('http://runtime-host', 'param');

      expect(ProxyUtil.makeProxyCall).toHaveBeenCalledWith(
        expect.objectContaining({
          fullProxyUrl: 'http://runtime-host/runtime',
          args: ['http://runtime-host', 'param'],
        }),
      );
    });

    it('should honour a custom timeout from the decorator', async () => {
      const initializer = new DevelopmentProxyInitializer({
        isTestEnv: true,
        proxyUrl: 'http://localhost',
      } as any);
      (ProxyUtil.makeProxyCall as jest.Mock).mockResolvedValue({ result: 'ok' });
      const DevelopmentProxy = initializer.DevelopmentProxy.bind(initializer);

      class TestClass {
        @DevelopmentProxy({ timeout: 999 })
        async testMethod() {
          return 'original';
        }
      }

      await new TestClass().testMethod();

      expect(ProxyUtil.makeProxyCall).toHaveBeenCalledWith(
        expect.objectContaining({ timeout: 999 }),
      );
    });

    it('should namespace static methods with their class name', async () => {
      const initializer = new DevelopmentProxyInitializer({
        isTestEnv: true,
        proxyUrl: 'http://localhost',
      } as any);
      (ProxyUtil.makeProxyCall as jest.Mock).mockResolvedValue({ result: 'ok' });
      const DevelopmentProxy = initializer.DevelopmentProxy.bind(initializer);

      class StaticHolder {
        @DevelopmentProxy()
        static async staticMethod() {
          return 'original';
        }
      }

      await StaticHolder.staticMethod();

      expect(ProxyUtil.makeProxyCall).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: { [DEFAULT_TARGET_HEADER_KEY]: 'StaticHolder.staticMethod' },
        }),
      );
    });

    it('should merge secure headers into the proxy call headers', async () => {
      const initializer = new DevelopmentProxyInitializer({
        isTestEnv: true,
        proxyUrl: 'http://localhost',
        secureConfig: {
          headerKey: 'x-proxy-token',
          encrypt: mockEncrypt,
          decrypt: mockDecrypt,
        },
      } as any);
      (ProxyUtil.makeProxyCall as jest.Mock).mockResolvedValue({ result: 'ok' });
      (SecurityUtil.getSecureHeaderMap as jest.Mock).mockResolvedValue({
        'x-proxy-token': 'signed',
      });
      const DevelopmentProxy = initializer.DevelopmentProxy.bind(initializer);

      class TestClass {
        @DevelopmentProxy()
        async testMethod() {
          return 'original';
        }
      }

      await new TestClass().testMethod();

      expect(ProxyUtil.makeProxyCall).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: {
            [DEFAULT_TARGET_HEADER_KEY]: 'testMethod',
            'x-proxy-token': 'signed',
          },
        }),
      );
    });

    it('should read the result from a custom resultKey and use a custom target header', async () => {
      const initializer = new DevelopmentProxyInitializer({
        isTestEnv: true,
        proxyUrl: 'http://localhost',
        resultKey: 'payload',
        targetHeaderKey: 'X-Custom-Target',
      } as any);
      (ProxyUtil.makeProxyCall as jest.Mock).mockResolvedValue({ payload: 'custom-result' });
      const DevelopmentProxy = initializer.DevelopmentProxy.bind(initializer);

      class TestClass {
        @DevelopmentProxy()
        async testMethod() {
          return 'original';
        }
      }

      const result = await new TestClass().testMethod();

      expect(result).toBe('custom-result');
      expect(ProxyUtil.makeProxyCall).toHaveBeenCalledWith(
        expect.objectContaining({ headers: { 'X-Custom-Target': 'testMethod' } }),
      );
    });

    it('should resolve to undefined when the proxy response lacks the resultKey', async () => {
      const initializer = new DevelopmentProxyInitializer({
        isTestEnv: true,
        proxyUrl: 'http://localhost',
      } as any);
      (ProxyUtil.makeProxyCall as jest.Mock).mockResolvedValue({});
      const DevelopmentProxy = initializer.DevelopmentProxy.bind(initializer);

      class TestClass {
        @DevelopmentProxy()
        async testMethod() {
          return 'original';
        }
      }

      await expect(new TestClass().testMethod()).resolves.toBeUndefined();
    });

    it('should propagate errors raised by the proxy call', async () => {
      const initializer = new DevelopmentProxyInitializer({
        isTestEnv: true,
        proxyUrl: 'http://localhost',
      } as any);
      (ProxyUtil.makeProxyCall as jest.Mock).mockRejectedValue(new Error('proxy down'));
      const DevelopmentProxy = initializer.DevelopmentProxy.bind(initializer);

      class TestClass {
        @DevelopmentProxy()
        async testMethod() {
          return 'original';
        }
      }

      await expect(new TestClass().testMethod()).rejects.toThrow('proxy down');
    });

    it('should keep the original method when neither test nor proxy env is enabled', async () => {
      const initializer = new DevelopmentProxyInitializer({
        proxyUrl: 'http://localhost',
      } as any);
      const DevelopmentProxy = initializer.DevelopmentProxy.bind(initializer);

      class TestClass {
        @DevelopmentProxy({ route: '/test' })
        async testMethod() {
          return 'original';
        }
      }

      await expect(new TestClass().testMethod()).resolves.toBe('original');
      expect(ProxyUtil.makeProxyCall).not.toHaveBeenCalled();
    });

    it('should keep the original method in proxy environment', async () => {
      const initializer = new DevelopmentProxyInitializer({
        isProxyEnv: true,
        proxyUrl: 'http://localhost',
      } as any);
      const DevelopmentProxy = initializer.DevelopmentProxy.bind(initializer);

      class TestClass {
        @DevelopmentProxy({ route: '/keep-original' })
        async testMethod() {
          return 'original';
        }
      }

      await expect(new TestClass().testMethod()).resolves.toBe('original');
      expect(ProxyUtil.makeProxyCall).not.toHaveBeenCalled();
    });

    it('should throw on duplicate registrations of the same method and route in proxy env', () => {
      const initializer = new DevelopmentProxyInitializer({
        isProxyEnv: true,
        proxyUrl: 'http://localhost',
      } as any);
      const DevelopmentProxy = initializer.DevelopmentProxy.bind(initializer);

      expect(() => {
        class First {
          @DevelopmentProxy({ route: '/dup' })
          async sameName() {
            return 'first';
          }
        }
        class Second {
          @DevelopmentProxy({ route: '/dup' })
          async sameName() {
            return 'second';
          }
        }
        return [First, Second];
      }).toThrow('Duplicate targetMethodName: sameName route: /dup');
    });

    it('should return the descriptor from the decorator', () => {
      const initializer = new DevelopmentProxyInitializer({
        isTestEnv: true,
        proxyUrl: 'http://localhost',
      } as any);
      const decorate = initializer.DevelopmentProxy({ route: '/x' });
      const descriptor = { value: async () => 'original' };

      const returned = decorate({}, 'someMethod', descriptor as any);

      expect(returned).toBe(descriptor);
    });

    it('should not register a resolver for a static method whose descriptor has no value', () => {
      const initializer = new DevelopmentProxyInitializer({
        isProxyEnv: true,
        proxyUrl: 'http://localhost',
      } as any);
      const decorate = initializer.DevelopmentProxy({ route: '/static-no-value' });
      class Holder {}

      expect(() => decorate(Holder, 'valueless', { value: undefined } as any)).not.toThrow();
      // @ts-expect-error reaching into the private resolver manager for assertion
      const registered = initializer._methodResolverManager.get(
        'Holder.valueless',
        '/static-no-value',
      );
      expect(registered).toBeUndefined();
    });

    it('should not register a resolver in proxy env when the descriptor has no value', () => {
      const initializer = new DevelopmentProxyInitializer({
        isProxyEnv: true,
        proxyUrl: 'http://localhost',
      } as any);
      const decorate = initializer.DevelopmentProxy({ route: '/no-value' });

      expect(() => decorate({}, 'valueless', { value: undefined } as any)).not.toThrow();
      // @ts-expect-error reaching into the private resolver manager for assertion
      expect(initializer._methodResolverManager.get('valueless', '/no-value')).toBeUndefined();
    });
  });

  describe('callActualMethod', () => {
    const initializer = new DevelopmentProxyInitializer({
      isProxyEnv: true,
      proxyUrl: 'http://localhost',
    } as any);

    const DevelopmentProxy = initializer.DevelopmentProxy.bind(initializer);

    // @ts-expect-error This is for testing purposes
    class _TestClass {
      @DevelopmentProxy({ route: '/test' })
      async testMethod(_url: string, _param: string) {
        return 'original';
      }
    }

    it('should throw error when the target header is missing', async () => {
      await expect(
        initializer.callActualMethod({
          getHeader: () => undefined,
          getBody: () => ({ args: [] }),
          route: '/test',
        }),
      ).rejects.toThrow('Invalid target proxy header');
    });

    it('should throw error when the target header is an empty string', async () => {
      await expect(
        initializer.callActualMethod({
          getHeader: () => '',
          getBody: () => ({ args: [] }),
          route: '/test',
        }),
      ).rejects.toThrow('Invalid target proxy header');
    });

    it('should throw error when resolver is not found', async () => {
      await expect(
        initializer.callActualMethod({
          getHeader: () => 'testMethod',
          getBody: () => ({ args: [] }),
          route: '/unknown',
        }),
      ).rejects.toThrow(
        'Unable to find resolver for targetMethodName: testMethod and route: /unknown',
      );
    });

    it('should throw error when the method name is unknown', async () => {
      await expect(
        initializer.callActualMethod({
          getHeader: () => 'noSuchMethod',
          getBody: () => ({ args: [] }),
          route: '/test',
        }),
      ).rejects.toThrow(
        'Unable to find resolver for targetMethodName: noSuchMethod and route: /test',
      );
    });

    it('should throw error when body is not available', async () => {
      await expect(
        initializer.callActualMethod({
          getHeader: () => 'testMethod',
          getBody: () => null as any,
          route: '/test',
        }),
      ).rejects.toThrow('request body is not available');
    });

    it('should throw error when args is not available or not an array', async () => {
      (SecurityUtil.validateProxyHeader as jest.Mock).mockReturnValue(true);
      await expect(
        initializer.callActualMethod({
          getHeader: () => 'testMethod',
          getBody: () => ({}),
          route: '/test',
        }),
      ).rejects.toThrow('"args" is not available in request body or not an Array');
    });

    it('should throw error when args is not an array', async () => {
      await expect(
        initializer.callActualMethod({
          getHeader: () => 'testMethod',
          getBody: () => ({ args: 'not-an-array' }),
          route: '/test',
        }),
      ).rejects.toThrow('"args" is not available in request body or not an Array');
    });

    it('should throw error when proxy header is invalid', async () => {
      (SecurityUtil.validateProxyHeader as jest.Mock).mockReturnValue(false);

      await expect(
        initializer.callActualMethod({
          getHeader: jest.fn(),
          getBody: () => ({ args: [] }),
          route: '/test',
        }),
      ).rejects.toThrow('Invalid target proxy header');
    });

    it('should throw unauthorized when the security header fails validation', async () => {
      (SecurityUtil.validateProxyHeader as jest.Mock).mockResolvedValue(false);

      await expect(
        initializer.callActualMethod({
          getHeader: () => 'testMethod',
          getBody: () => ({ args: [] }),
          route: '/test',
        }),
      ).rejects.toThrow('Invalid security proxy header');
    });

    it('should validate security before inspecting args', async () => {
      // an unauthorized request must not leak whether the body was well formed
      (SecurityUtil.validateProxyHeader as jest.Mock).mockResolvedValue(false);

      await expect(
        initializer.callActualMethod({
          getHeader: () => 'testMethod',
          getBody: () => ({}),
          route: '/test',
        }),
      ).rejects.toThrow('Invalid security proxy header');
    });

    it('should invoke the registered resolver with the request args', async () => {
      const result = await initializer.callActualMethod({
        getHeader: () => 'testMethod',
        getBody: () => ({ args: ['http://test.com', 'param'] }),
        route: '/test',
      });

      expect(result).toBe('original');
    });

    it('should resolve via the default route when no route is provided', async () => {
      const result = await initializer.callActualMethod({
        getHeader: () => 'testMethod',
        getBody: () => ({ args: [] }),
      });

      expect(result).toBe('original');
    });

    it('should accept an empty args array', async () => {
      await expect(
        initializer.callActualMethod({
          getHeader: () => 'testMethod',
          getBody: () => ({ args: [] }),
          route: '/test',
        }),
      ).resolves.toBe('original');
    });

    it('should propagate errors thrown by the resolver', async () => {
      const throwingInitializer = new DevelopmentProxyInitializer({
        isProxyEnv: true,
        proxyUrl: 'http://localhost',
      } as any);
      const Decorate = throwingInitializer.DevelopmentProxy.bind(throwingInitializer);

      // @ts-expect-error class is only declared for its decorator side effect
      class _Throwing {
        @Decorate({ route: '/boom' })
        async boom() {
          throw new Error('resolver exploded');
        }
      }

      await expect(
        throwingInitializer.callActualMethod({
          getHeader: () => 'boom',
          getBody: () => ({ args: [] }),
          route: '/boom',
        }),
      ).rejects.toThrow('resolver exploded');
    });

    it('should pass the configured targetHeaderKey to getHeader', async () => {
      const customInitializer = new DevelopmentProxyInitializer({
        isProxyEnv: true,
        proxyUrl: 'http://localhost',
        targetHeaderKey: 'X-Custom-Target',
      } as any);
      const getHeader = jest.fn().mockReturnValue(undefined);

      await expect(
        customInitializer.callActualMethod({ getHeader, getBody: () => ({ args: [] }) }),
      ).rejects.toThrow('Invalid target proxy header');
      expect(getHeader).toHaveBeenCalledWith('X-Custom-Target');
    });

    it('should resolve static methods registered under their class name', async () => {
      const staticInitializer = new DevelopmentProxyInitializer({
        isProxyEnv: true,
        proxyUrl: 'http://localhost',
      } as any);
      const Decorate = staticInitializer.DevelopmentProxy.bind(staticInitializer);

      class StaticHolder {
        @Decorate({ route: '/static' })
        static async staticMethod(value: string) {
          return `static:${value}`;
        }
      }
      // reference the class so it is not elided
      expect(StaticHolder).toBeDefined();

      const result = await staticInitializer.callActualMethod({
        getHeader: () => 'StaticHolder.staticMethod',
        getBody: () => ({ args: ['value'] }),
        route: '/static',
      });

      expect(result).toBe('static:value');
    });
  });
});
