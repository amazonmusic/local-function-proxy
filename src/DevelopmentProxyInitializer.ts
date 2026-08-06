import {
  DEFAULT_PROXY_CALL_TIMEOUT_MS,
  DEFAULT_PROXY_SECURITY_TIMEOUT_MS,
  DEFAULT_RESULT_KEY,
  DEFAULT_TARGET_HEADER_KEY,
} from './constants';
import type { Resolver } from './models';
import { MethodResolverManager } from './models';
import type { ProxyConfig, RequestConfig } from './types';
import { HTTPBadRequestError, HTTPMethodNotFoundError, HTTPUnauthorizedError } from './types';
import { ProxyUtil, SecurityUtil } from './utils';

export type ProxyDecoratorInput = {
  /**
   * This is preferred for this call, if passed
   */
  proxyUrl?: string;
  route?: string;
  timeout?: number;
};

/**
 * Signature of the method decorator produced by {@link DevelopmentProxyInitializer.DevelopmentProxy}
 */
type MethodDecorator = <T extends (...args: any[]) => Promise<any>>(
  target: any,
  propertyKey: string,
  descriptor: TypedPropertyDescriptor<T>,
) => TypedPropertyDescriptor<T> | void;

export class DevelopmentProxyInitializer {
  private static DEFAULT_CONFIG: Partial<ProxyConfig> = {
    isProxyEnv: false,
    isTestEnv: false,
    useRuntimeProxyUrl: false,
    resultKey: DEFAULT_RESULT_KEY,
    targetHeaderKey: DEFAULT_TARGET_HEADER_KEY,
  };

  private _config: ProxyConfig;
  private _methodResolverManager: MethodResolverManager;

  constructor(config: ProxyConfig) {
    this._config = DevelopmentProxyInitializer.validateConfig({
      ...DevelopmentProxyInitializer.DEFAULT_CONFIG,
      ...config,
    });

    this._methodResolverManager = new MethodResolverManager();
  }

  /**
   * Help validate config passed in constructor
   *
   * @param config config passed in Initializer constructor
   * @returns validated config
   */
  private static validateConfig(config: ProxyConfig): ProxyConfig {
    if (config.isProxyEnv && config.isTestEnv) {
      throw new Error("Test environment can't be Proxy environment too");
    }
    if (!config.useRuntimeProxyUrl && !config.proxyUrl) {
      throw new Error('proxyHost is required argument when useRuntimeProxyUrl is false');
    }
    if (config.secureConfig) {
      DevelopmentProxyInitializer.validateSecureConfig(config.secureConfig);
    }
    return config;
  }

  /**
   * Validate the optional secureConfig and apply its default timeout in place
   *
   * @param secureConfig secureConfig passed in Initializer constructor
   * @returns void
   */
  private static validateSecureConfig(
    secureConfig: NonNullable<ProxyConfig['secureConfig']>,
  ): void {
    if (!secureConfig.headerKey) {
      throw new Error('secureConfig.headerKey is required');
    }
    if (!secureConfig.encrypt || !secureConfig.decrypt) {
      throw new Error('secureConfig.encrypt and secureConfig.decrypt are required');
    }
    if (!secureConfig.timeoutMS) {
      secureConfig.timeoutMS = DEFAULT_PROXY_SECURITY_TIMEOUT_MS;
    }
  }

  /**
   * Build the fully qualified name a method is registered/looked up under
   *
   * Static methods are namespaced with their class name to avoid collisions
   *
   * @param target decorator target: the constructor for static methods, the prototype otherwise
   * @param propertyKey name of the decorated method
   * @returns target method name used as the proxy target header value
   */
  private static getTargetMethodName(target: any, propertyKey: string): string {
    const isStaticMethodInClass = typeof target === 'function';
    return `${isStaticMethodInClass ? `${(target as FunctionConstructor).name}.` : ''}${String(
      propertyKey,
    )}`;
  }

  /**
   * resultKey used for returning result from proxy call
   * Proxy call from Test environment expect response body from Proxy as {[resultKey]: actualResult}
   *
   * @returns resultKey set in config during initialization
   */
  get resultKey(): string {
    return this._config.resultKey;
  }

  /**
   * Resolve the proxy url to call for a single proxied invocation
   *
   * Precedence: url passed to the decorator, then the runtime url (first method
   * argument) when useRuntimeProxyUrl is set, then the statically configured url
   *
   * @param decoratorProxyUrl proxyUrl passed to the decorator, if any
   * @param args arguments the decorated method was invoked with
   * @param route route suffix appended to the resolved base url
   * @returns full url to POST the proxied call to
   */
  private resolveFullProxyUrl(
    decoratorProxyUrl: string | undefined,
    args: any[],
    route: string,
  ): string {
    const runtimeProxyUrl = args[0] as string;
    return (
      (decoratorProxyUrl ??
        (this._config.useRuntimeProxyUrl ? runtimeProxyUrl : this._config.proxyUrl!)) + route
    );
  }

  /**
   * Use this decorator to wrap method to bypass the actual execution in Proxy environment
   *
   * Note: First argument of actual async method should be always be ProxyUrl if useRuntimeProxyUrl is true
   */
  DevelopmentProxy = ({
    proxyUrl,
    route = '',
    timeout = DEFAULT_PROXY_CALL_TIMEOUT_MS,
  }: ProxyDecoratorInput = {}): MethodDecorator => {
    return <T extends Resolver>(
      target: any,
      propertyKey: string,
      descriptor: TypedPropertyDescriptor<T>,
    ): TypedPropertyDescriptor<T> | void => {
      const isStaticMethodInClass = typeof target === 'function';
      const targetMethodName = DevelopmentProxyInitializer.getTargetMethodName(target, propertyKey);
      const originalMethod = isStaticMethodInClass
        ? descriptor.value?.bind(target)
        : descriptor.value;
      const { isTestEnv, isProxyEnv, resultKey, targetHeaderKey, secureConfig } = this._config;
      if (isTestEnv) {
        // make HTTP call to proxy route with arguments
        const resolver = async <R>(...args: any[]): Promise<R> => {
          const fullProxyUrl = this.resolveFullProxyUrl(proxyUrl, args, route);
          const secureHeaderMap = await SecurityUtil.getSecureHeaderMap(secureConfig);
          const { [resultKey]: result } = await ProxyUtil.makeProxyCall({
            fullProxyUrl,
            headers: {
              [targetHeaderKey]: targetMethodName,
              ...secureHeaderMap,
            },
            timeout,
            args,
          });
          return result as R;
        };
        descriptor.value = resolver as T;
      }
      if (isProxyEnv && originalMethod) {
        // add resolver to map to be able to call by Dev proxy router
        this._methodResolverManager.add(targetMethodName, originalMethod, route);
      }
      return descriptor;
    };
  };

  /**
   * Use this method inside proxy environment to call actual method and return response to Test environment
   *
   * @param requestConfig The request configuration containing getHeader, getBody function and route
   * @returns The result of the actual method call
   */
  callActualMethod = async ({ getHeader, getBody, route }: RequestConfig): Promise<unknown> => {
    const { targetHeaderKey, secureConfig } = this._config;
    const targetMethodName = getHeader(targetHeaderKey);
    if (!targetMethodName) {
      throw new HTTPMethodNotFoundError('Invalid target proxy header');
    }
    const resolver = this._methodResolverManager.get(targetMethodName, route);
    if (!resolver) {
      throw new HTTPMethodNotFoundError(
        `Unable to find resolver for targetMethodName: ${targetMethodName} and route: ${route}`,
      );
    }
    const body = getBody();
    if (!body) {
      throw new HTTPBadRequestError('request body is not available');
    }
    if (
      // only allow requests those contains valid proxy token
      !(await SecurityUtil.validateProxyHeader(getHeader, secureConfig))
    ) {
      throw new HTTPUnauthorizedError('Invalid security proxy header');
    }
    const { args } = body;
    if (!args || !Array.isArray(args)) {
      throw new HTTPBadRequestError('"args" is not available in request body or not an Array');
    }
    return resolver(...args);
  };
}
