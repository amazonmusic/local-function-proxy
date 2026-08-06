import crypto from 'crypto';
import { DEFAULT_PROXY_SECURITY_TIMEOUT_MS } from '../constants';
import type { SecureConfig } from '../types';

export class SecureConfigAdapter {
  /**
   * In-built adapter to quickly return Private/Public key pair
   * based on SecureConfig interface
   *
   * @param privateKey Private Key
   * @param cert Public Key
   * @param headerKey Header key to be used for sending secure token
   * @param timeoutMS Default 1 minute
   * @returns Returns Private/Public Key pair based Secure config
   */
  static getPublicPrivateKeyPairSecureConfig(
    privateKey: string,
    cert: string,
    headerKey: string,
    timeoutMS: number = DEFAULT_PROXY_SECURITY_TIMEOUT_MS,
  ): SecureConfig {
    return {
      encrypt: (data: string): Promise<string> => {
        if (!privateKey) {
          return Promise.reject(new Error('Private key is not provided'));
        }
        return Promise.resolve(
          crypto.privateEncrypt(privateKey, Buffer.from(data, 'utf8')).toString('base64'),
        );
      },
      decrypt: (encryptedData: string): Promise<string> => {
        if (!cert) {
          return Promise.reject(new Error('Cert is not provided'));
        }
        return Promise.resolve(
          crypto.publicDecrypt(cert, Buffer.from(encryptedData, 'base64')).toString('utf8'),
        );
      },
      headerKey,
      timeoutMS,
    };
  }
}
