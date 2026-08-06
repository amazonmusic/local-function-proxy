export const DEFAULT_PROXY_CALL_TIMEOUT_MS = 5000; // 5 seconds

export const DEFAULT_PROXY_SECURITY_TIMEOUT_MS = 60000; // 1 minute

/**
 * Default key under which the proxy response body carries the actual result
 */
export const DEFAULT_RESULT_KEY = 'result';

/**
 * Default header key used to identify which proxied method to invoke
 */
export const DEFAULT_TARGET_HEADER_KEY = 'X-Proxy-Target';
