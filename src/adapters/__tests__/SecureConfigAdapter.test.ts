import crypto from 'crypto';
import { SecureConfigAdapter } from '..';
import { DEFAULT_PROXY_SECURITY_TIMEOUT_MS } from '../../constants';

describe('SecureConfigAdapter', () => {
  const keyPair = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  });

  const mockCertificate = keyPair.publicKey;
  const mockPrivateKey = keyPair.privateKey;
  const mockHeaderKey = 'X-Proxy-Token';
  const plainText = 'Hello, World!';

  describe('getPublicPrivateKeyPairSecureConfig', () => {
    it('should return a SecureConfig object', () => {
      const secureConfig = SecureConfigAdapter.getPublicPrivateKeyPairSecureConfig(
        mockPrivateKey,
        mockCertificate,
        mockHeaderKey,
      );
      expect(secureConfig).toHaveProperty('encrypt');
      expect(secureConfig).toHaveProperty('decrypt');
      expect(secureConfig).toHaveProperty('timeoutMS', DEFAULT_PROXY_SECURITY_TIMEOUT_MS);
    });

    it('should encrypt and decrypt data correctly', () => {
      const secureConfig = SecureConfigAdapter.getPublicPrivateKeyPairSecureConfig(
        mockPrivateKey,
        mockCertificate,
        mockHeaderKey,
      );
      const encryptedData = secureConfig.encrypt(plainText);
      const decryptedData = secureConfig.decrypt(encryptedData);
      expect(decryptedData).toBe(plainText);
    });

    it('should throw an error when private key is not provided for encryption', () => {
      const secureConfig = SecureConfigAdapter.getPublicPrivateKeyPairSecureConfig(
        '',
        mockCertificate,
        mockHeaderKey,
      );
      expect(() => secureConfig.encrypt(plainText)).toThrow('Private key is not provided');
    });

    it('should throw an error when cert is not provided for decryption', () => {
      const secureConfig = SecureConfigAdapter.getPublicPrivateKeyPairSecureConfig(
        mockPrivateKey,
        '',
        mockHeaderKey,
      );
      const encryptedData = secureConfig.encrypt(plainText);
      expect(() => secureConfig.decrypt(encryptedData)).toThrow('Cert is not provided');
    });

    it('should use the provided timeout value', () => {
      const customTimeout = 5000;
      const secureConfig = SecureConfigAdapter.getPublicPrivateKeyPairSecureConfig(
        mockPrivateKey,
        mockCertificate,
        mockHeaderKey,
        customTimeout,
      );
      expect(secureConfig.timeoutMS).toBe(customTimeout);
    });
  });
});
