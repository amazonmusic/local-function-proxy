import type { SecureConfig } from '../types';

export class SecurityUtil {
  /**
   * Get secure header map for proxy requests
   *
   * @param config The security configuration
   * @returns A header map with security token
   */
  static async getSecureHeaderMap(config?: SecureConfig): Promise<Record<string, string>> {
    if (!config) {
      return {};
    }
    const { headerKey, encrypt } = config;
    return {
      [headerKey]: await encrypt(String(Date.now())),
    };
  }

  /**
   * Validate a proxy header for security
   *
   * @param getHeader Function to get header value
   * @param config The security configuration
   * @returns True if header is valid, false otherwise
   */
  static async validateProxyHeader(
    getHeader: (key: string) => string | undefined,
    config?: SecureConfig,
  ): Promise<boolean> {
    if (!config) {
      return true;
    }
    const { headerKey, decrypt, timeoutMS } = config;
    const value = getHeader(headerKey);
    if (!value) {
      return false;
    }
    try {
      const decrypted = await decrypt(value);
      return SecurityUtil.isWithinTimeout(decrypted, timeoutMS);
    } catch {
      return false;
    }
  }

  /**
   * Check whether a decrypted timestamp token is still within the allowed window
   *
   * @param decrypted The decrypted header value, expected to be epoch millis
   * @param timeoutMS How long a token stays valid, in milliseconds
   * @returns True if the token has not expired, false otherwise
   */
  private static isWithinTimeout(decrypted: string, timeoutMS: number): boolean {
    const date = new Date(Number(decrypted));
    return date.getTime() > Date.now() - timeoutMS;
  }
}
