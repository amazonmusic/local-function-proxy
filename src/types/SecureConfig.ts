export type SecureConfig = {
  /**
   * Encrypt the string header for the request
   *
   * Used inside Test Env
   *
   * @param data - The string to encrypt
   */
  encrypt(data: string): string;
  /**
   * Decrypt the string header for the request
   *
   * Used inside Proxy Env
   *
   * @param encryptedData - The string to decrypt
   */
  decrypt(encryptedData: string): string;
  /**
   * Header to be used to identify the request is from proxy and also used for securely accept request from Test environment
   *
   * Note: Please make sure to allow this header to flow from test environment to Proxy environment
   */
  headerKey: string;
  /**
   * Secure timeout in milliseconds for Proxy call to invalidate
   *
   * If proxy call from Test Env to Proxy took more than timeoutMS,
   * then it won't be successful (should be set based on Test->Proxy Env Network Latency)
   */
  timeoutMS: number;
};
