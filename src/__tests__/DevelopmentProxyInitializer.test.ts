/* tslint:disable no-unused-expression */
/* tslint:disable:max-classes-per-file */
import { DevelopmentProxyInitializer } from '..';
import { DEFAULT_PROXY_CALL_TIMEOUT_MS, DEFAULT_PROXY_SECURITY_TIMEOUT_MS } from '../constants';
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
      // @ts-ignore
      expect(initializer._config.secureConfig!.timeoutMS).toBe(DEFAULT_PROXY_SECURITY_TIMEOUT_MS);
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
  });
});
