import crypto from 'crypto';
import { SecureConfigAdapter } from '..';
import { DEFAULT_PROXY_SECURITY_TIMEOUT_MS } from '../../constants';
import { SecurityUtil } from '../../utils';

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

    it('should encrypt and decrypt data correctly', async () => {
      const secureConfig = SecureConfigAdapter.getPublicPrivateKeyPairSecureConfig(
        mockPrivateKey,
        mockCertificate,
        mockHeaderKey,
      );
      const encryptedData = await secureConfig.encrypt(plainText);
      const decryptedData = await secureConfig.decrypt(encryptedData);
      expect(decryptedData).toBe(plainText);
    });

    it('should throw an error when private key is not provided for encryption', async () => {
      const secureConfig = SecureConfigAdapter.getPublicPrivateKeyPairSecureConfig(
        '',
        mockCertificate,
        mockHeaderKey,
      );
      await expect(secureConfig.encrypt(plainText)).rejects.toThrow('Private key is not provided');
    });

    it('should throw an error when cert is not provided for decryption', async () => {
      const secureConfig = SecureConfigAdapter.getPublicPrivateKeyPairSecureConfig(
        mockPrivateKey,
        '',
        mockHeaderKey,
      );
      const encryptedData = await secureConfig.encrypt(plainText);
      await expect(secureConfig.decrypt(encryptedData)).rejects.toThrow('Cert is not provided');
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

    it('should expose the provided headerKey', () => {
      const secureConfig = SecureConfigAdapter.getPublicPrivateKeyPairSecureConfig(
        mockPrivateKey,
        mockCertificate,
        mockHeaderKey,
      );
      expect(secureConfig.headerKey).toBe(mockHeaderKey);
    });

    it('should produce a different ciphertext than the plaintext', async () => {
      const secureConfig = SecureConfigAdapter.getPublicPrivateKeyPairSecureConfig(
        mockPrivateKey,
        mockCertificate,
        mockHeaderKey,
      );
      const encryptedData = await secureConfig.encrypt(plainText);
      expect(encryptedData).not.toBe(plainText);
    });

    it('should produce base64 encoded ciphertext', async () => {
      const secureConfig = SecureConfigAdapter.getPublicPrivateKeyPairSecureConfig(
        mockPrivateKey,
        mockCertificate,
        mockHeaderKey,
      );
      const encryptedData = await secureConfig.encrypt(plainText);
      expect(encryptedData).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    });

    it('should round trip a timestamp string as used by SecurityUtil', async () => {
      const secureConfig = SecureConfigAdapter.getPublicPrivateKeyPairSecureConfig(
        mockPrivateKey,
        mockCertificate,
        mockHeaderKey,
      );
      const timestamp = String(1643673600000);
      const encrypted = await secureConfig.encrypt(timestamp);
      await expect(secureConfig.decrypt(encrypted)).resolves.toBe(timestamp);
    });

    it('should throw synchronously when decrypting an empty encrypted payload', async () => {
      // RSA cannot recover an empty payload, and crypto raises this synchronously
      // rather than as a rejected promise
      const secureConfig = SecureConfigAdapter.getPublicPrivateKeyPairSecureConfig(
        mockPrivateKey,
        mockCertificate,
        mockHeaderKey,
      );
      const encrypted = await secureConfig.encrypt('');
      expect(() => secureConfig.decrypt(encrypted)).toThrow();
    });

    it('should throw synchronously when decrypting data not encrypted with the key pair', () => {
      const secureConfig = SecureConfigAdapter.getPublicPrivateKeyPairSecureConfig(
        mockPrivateKey,
        mockCertificate,
        mockHeaderKey,
      );
      expect(() => secureConfig.decrypt(Buffer.from('garbage').toString('base64'))).toThrow();
    });

    it('should throw synchronously when decrypting with a mismatched public key', async () => {
      const otherKeyPair = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });
      const encrypting = SecureConfigAdapter.getPublicPrivateKeyPairSecureConfig(
        mockPrivateKey,
        mockCertificate,
        mockHeaderKey,
      );
      const decrypting = SecureConfigAdapter.getPublicPrivateKeyPairSecureConfig(
        mockPrivateKey,
        otherKeyPair.publicKey,
        mockHeaderKey,
      );

      const encrypted = await encrypting.encrypt(plainText);
      expect(() => decrypting.decrypt(encrypted)).toThrow();
    });

    it('should throw synchronously when the private key is malformed', () => {
      const secureConfig = SecureConfigAdapter.getPublicPrivateKeyPairSecureConfig(
        'not-a-key',
        mockCertificate,
        mockHeaderKey,
      );
      expect(() => secureConfig.encrypt(plainText)).toThrow();
    });

    it('should let SecurityUtil treat a synchronous decrypt failure as invalid', async () => {
      // guards the contract that validateProxyHeader relies on: a throwing
      // decrypt must not escape as an unhandled error
      const secureConfig = SecureConfigAdapter.getPublicPrivateKeyPairSecureConfig(
        mockPrivateKey,
        mockCertificate,
        mockHeaderKey,
      );
      await expect(
        SecurityUtil.validateProxyHeader(() => 'not-valid-ciphertext', secureConfig),
      ).resolves.toBe(false);
    });
  });
});
