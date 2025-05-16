import type { SecureConfig } from '../..';
import { SecurityUtil } from '../../utils';

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
    it('should return empty object when config is undefined', () => {
      const result = SecurityUtil.getSecureHeaderMap();
      expect(result).toEqual({});
    });

    it('should return header map with encrypted timestamp', () => {
      const mockConfig: SecureConfig = {
        headerKey: 'X-Security',
        encrypt: (value: string) => `encrypted_${value}`,
        decrypt: jest.fn(),
        timeoutMS: 1000,
      };

      const result = SecurityUtil.getSecureHeaderMap(mockConfig);
      expect(result).toEqual({
        'X-Security': `encrypted_${NOW}`,
      });
    });
  });

  describe('validateProxyHeader', () => {
    const mockHeaderKey = 'X-Security';
    const mockConfig: SecureConfig = {
      headerKey: mockHeaderKey,
      encrypt: jest.fn(),
      decrypt: (value: string) => value.replace('encrypted_', ''),
      timeoutMS: 1000,
    };

    it('should return true when config is undefined', () => {
      const mockGetHeader = jest.fn();
      const result = SecurityUtil.validateProxyHeader(mockGetHeader);
      expect(result).toBe(true);
    });

    it('should return false when header value is missing', () => {
      const mockGetHeader = jest.fn().mockReturnValue(undefined);
      const result = SecurityUtil.validateProxyHeader(mockGetHeader, mockConfig);
      expect(result).toBe(false);
    });

    it('should return false when decryption fails', () => {
      const mockGetHeader = jest.fn().mockReturnValue('invalid_value');
      const mockConfigWithFailingDecrypt: SecureConfig = {
        ...mockConfig,
        decrypt: () => {
          throw new Error('Decryption failed');
        },
      };
      const result = SecurityUtil.validateProxyHeader(mockGetHeader, mockConfigWithFailingDecrypt);
      expect(result).toBe(false);
    });

    it('should return true for valid timestamp within timeout', () => {
      const validTimestamp = NOW - 500; // Within timeout
      const mockGetHeader = jest.fn().mockReturnValue(`encrypted_${validTimestamp}`);
      const result = SecurityUtil.validateProxyHeader(mockGetHeader, mockConfig);
      expect(result).toBe(true);
    });

    it('should return false for expired timestamp', () => {
      const expiredTimestamp = NOW - 1500; // Outside timeout
      const mockGetHeader = jest.fn().mockReturnValue(`encrypted_${expiredTimestamp}`);
      const result = SecurityUtil.validateProxyHeader(mockGetHeader, mockConfig);
      expect(result).toBe(false);
    });
  });
});
