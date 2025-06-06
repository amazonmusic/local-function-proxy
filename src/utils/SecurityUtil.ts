import type { SecureConfig } from '../types';

export class SecurityUtil {
  /**
   * Get secure header map for proxy requests
   *
   * @param config The security configuration
   * @returns A header map with security token
   */
  static getSecureHeaderMap(config?: SecureConfig): Record<string, string> {
    if (!config) {
      return {};
    }
    const { headerKey, encrypt } = config;
    return {
      [headerKey]: encrypt(String(Date.now())),
    };
  }

  /**
   * Validate a proxy header for security
   *
   * @param getHeader Function to get header value
   * @param config The security configuration
   * @returns True if header is valid, false otherwise
   */
  static validateProxyHeader(
    getHeader: (key: string) => string | undefined,
    config?: SecureConfig,
  ): boolean {
    if (!config) {
      return true;
    }
    const { headerKey, decrypt, timeoutMS } = config;
    const value = getHeader(headerKey);
    if (!value) {
      return false;
    }
    try {
      const decrypted = decrypt(value);
      const date = new Date(Number(decrypted));
      return date.getTime() > Date.now() - timeoutMS;
    } catch {
      return false;
    }
  }
}
