import type { SecureConfig } from './SecureConfig';

export type ProxyConfig = {
  /**
   * If true, the actual method will be called in this environment.
   *
   * For Example: If you are proxying Local Env to Gamma environment, then
   * set to true for gamma environment
   *
   * @default false
   */
  isProxyEnv: boolean;
  /**
   * If true, the actual method will be proxied to Proxy environment
   *
   * For Example: If you are proxying Local Env to Gamma environment, then
   * set to true for local environment
   *
   * @default false
   */
  isTestEnv: boolean;
  /**
   * Key to be used to identify the result of proxy call
   * Same should be used in response body of Dev Proxy Handler inside Proxy Env
   *
   * Such as `{"result": "Proxy method string response"}`
   *
   * @default "result"
   */
  resultKey: string;
  /**
   * Header key to be used to identify the request is from proxy and also used for securely accept request from Test environment
   *
   * Note: Please make sure to allow this header to flow from test environment to Proxy environment
   *
   * @default "X-Proxy-Target"
   */
  targetHeaderKey: string;
  /**
   * Help determine whether to use first argument of method as Proxy Host or static Proxy Host
   *
   * If true, then make sure to set first argument of actual method as proxy environment Host
   * If false, then make sure to set proxyHost property
   *
   * @default false
   */
  useRuntimeProxyUrl: boolean;
  /**
   * Base Url to be used for proxying request
   * Example: http://www.example-gamma.com/dev-proxy
   *
   * Required if useRuntimeProxyUrl is false
   */
  proxyUrl?: string;
  /**
   * Interface of encrypt/decrypt method to secure the Test->Proxy env communication
   *
   * @default "No Security"
   */
  secureConfig?: SecureConfig;
};
