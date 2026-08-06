import type { SecureConfig } from '../..';
import { SecurityUtil } from '..';

describe('SecurityUtil', () => {
  // Mock Date.now() to return a fixed timestamp
  const NOW = 1643673600000; // Example timestamp
  let originalDateNow: () => number;

  beforeAll(() => {
    originalDateNow = Date.now;
    Date.now = jest.fn(() => NOW);
  });

  afterAll(() => {
    Date.now = originalDateNow;
  });

  describe('getSecureHeaderMap', () => {
    it('should return empty object when config is undefined', async () => {
      const result = await SecurityUtil.getSecureHeaderMap();
      expect(result).toEqual({});
    });

    it('should return header map with encrypted timestamp', async () => {
      const mockConfig: SecureConfig = {
        headerKey: 'X-Security',
        encrypt: (value: string) => Promise.resolve(`encrypted_${value}`),
        decrypt: jest.fn(),
        timeoutMS: 1000,
      };

      const result = await SecurityUtil.getSecureHeaderMap(mockConfig);
      expect(result).toEqual({
        'X-Security': `encrypted_${NOW}`,
      });
    });

    it('should encrypt the current timestamp as a string', async () => {
      const encrypt = jest.fn().mockResolvedValue('token');
      await SecurityUtil.getSecureHeaderMap({
        headerKey: 'X-Security',
        encrypt,
        decrypt: jest.fn(),
        timeoutMS: 1000,
      });

      expect(encrypt).toHaveBeenCalledWith(String(NOW));
    });

    it('should propagate a rejection from encrypt', async () => {
      await expect(
        SecurityUtil.getSecureHeaderMap({
          headerKey: 'X-Security',
          encrypt: () => Promise.reject(new Error('encryption failed')),
          decrypt: jest.fn(),
          timeoutMS: 1000,
        }),
      ).rejects.toThrow('encryption failed');
    });

    it('should use the configured headerKey as the map key', async () => {
      const result = await SecurityUtil.getSecureHeaderMap({
        headerKey: 'X-Custom-Token',
        encrypt: () => Promise.resolve('signed'),
        decrypt: jest.fn(),
        timeoutMS: 1000,
      });

      expect(result).toEqual({ 'X-Custom-Token': 'signed' });
    });
  });

  describe('validateProxyHeader', () => {
    const mockHeaderKey = 'X-Security';
    const mockConfig: SecureConfig = {
      headerKey: mockHeaderKey,
      encrypt: jest.fn(),
      decrypt: (value: string) => Promise.resolve(value.replace('encrypted_', '')),
      timeoutMS: 1000,
    };

    it('should return true when config is undefined', async () => {
      const mockGetHeader = jest.fn();
      const result = await SecurityUtil.validateProxyHeader(mockGetHeader);
      expect(result).toBe(true);
    });

    it('should not read any header when config is undefined', async () => {
      const mockGetHeader = jest.fn();
      await SecurityUtil.validateProxyHeader(mockGetHeader);
      expect(mockGetHeader).not.toHaveBeenCalled();
    });

    it('should read the header using the configured headerKey', async () => {
      const mockGetHeader = jest.fn().mockReturnValue(`encrypted_${NOW}`);
      await SecurityUtil.validateProxyHeader(mockGetHeader, mockConfig);
      expect(mockGetHeader).toHaveBeenCalledWith(mockHeaderKey);
    });

    it('should return false when header value is missing', async () => {
      const mockGetHeader = jest.fn().mockReturnValue(undefined);
      const result = await SecurityUtil.validateProxyHeader(mockGetHeader, mockConfig);
      expect(result).toBe(false);
    });

    it('should return false when header value is an empty string', async () => {
      const mockGetHeader = jest.fn().mockReturnValue('');
      const result = await SecurityUtil.validateProxyHeader(mockGetHeader, mockConfig);
      expect(result).toBe(false);
    });

    it('should return false when async decryption rejects', async () => {
      const mockGetHeader = jest.fn().mockReturnValue('invalid_value');
      const mockConfigWithRejectingDecrypt: SecureConfig = {
        ...mockConfig,
        decrypt: () => Promise.reject(new Error('Decryption failed')),
      };
      const result = await SecurityUtil.validateProxyHeader(
        mockGetHeader,
        mockConfigWithRejectingDecrypt,
      );
      expect(result).toBe(false);
    });

    it('should return false when decryption throws synchronously', async () => {
      const mockGetHeader = jest.fn().mockReturnValue('invalid_value');
      const result = await SecurityUtil.validateProxyHeader(mockGetHeader, {
        ...mockConfig,
        decrypt: () => {
          throw new Error('boom');
        },
      });
      expect(result).toBe(false);
    });

    it('should return false when the decrypted value is not a number', async () => {
      const mockGetHeader = jest.fn().mockReturnValue('encrypted_not-a-number');
      const result = await SecurityUtil.validateProxyHeader(mockGetHeader, mockConfig);
      expect(result).toBe(false);
    });

    it('should return true for valid timestamp within timeout', async () => {
      const validTimestamp = NOW - 500; // Within timeout
      const mockGetHeader = jest.fn().mockReturnValue(`encrypted_${validTimestamp}`);
      const result = await SecurityUtil.validateProxyHeader(mockGetHeader, mockConfig);
      expect(result).toBe(true);
    });

    it('should return true for a timestamp equal to now', async () => {
      const mockGetHeader = jest.fn().mockReturnValue(`encrypted_${NOW}`);
      const result = await SecurityUtil.validateProxyHeader(mockGetHeader, mockConfig);
      expect(result).toBe(true);
    });

    it('should return true for a future timestamp', async () => {
      const mockGetHeader = jest.fn().mockReturnValue(`encrypted_${NOW + 5000}`);
      const result = await SecurityUtil.validateProxyHeader(mockGetHeader, mockConfig);
      expect(result).toBe(true);
    });

    it('should return false for expired timestamp', async () => {
      const expiredTimestamp = NOW - 1500; // Outside timeout
      const mockGetHeader = jest.fn().mockReturnValue(`encrypted_${expiredTimestamp}`);
      const result = await SecurityUtil.validateProxyHeader(mockGetHeader, mockConfig);
      expect(result).toBe(false);
    });

    it('should return false for a timestamp exactly at the timeout boundary', async () => {
      // the window is exclusive: now - timeoutMS is already expired
      const mockGetHeader = jest.fn().mockReturnValue(`encrypted_${NOW - 1000}`);
      const result = await SecurityUtil.validateProxyHeader(mockGetHeader, mockConfig);
      expect(result).toBe(false);
    });

    it('should return true just inside the timeout boundary', async () => {
      const mockGetHeader = jest.fn().mockReturnValue(`encrypted_${NOW - 999}`);
      const result = await SecurityUtil.validateProxyHeader(mockGetHeader, mockConfig);
      expect(result).toBe(true);
    });
  });
});
