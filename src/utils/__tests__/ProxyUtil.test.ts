import axios from 'axios';
import { StatusCodes } from 'http-status-codes';
import type { DevProxyConfig } from '..';
import { ErrorUtil, ProxyUtil, SecurityUtil } from '..';

// Mock axios and other dependencies
jest.mock('axios');
jest.mock('../../utils/SecurityUtil');
jest.mock('../../utils/ErrorUtil');

describe('ProxyUtil', () => {
  // Reset all mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockConfig = {
    fullProxyUrl: 'http://test-proxy.com/test-route',
    headers: {},
    timeout: 5000,
    args: ['arg1', 'arg2'],
  } as DevProxyConfig;

  describe('makeProxyCall', () => {
    it('should make successful proxy call and return data', async () => {
      const mockResponse = { data: { result: 'success' } };
      const mockSecureHeaders = {};

      (SecurityUtil.getSecureHeaderMap as jest.Mock).mockReturnValue(mockSecureHeaders);
      (axios.post as jest.Mock).mockResolvedValue(mockResponse);

      const result = await ProxyUtil.makeProxyCall(mockConfig);

      expect(axios.post).toHaveBeenCalledWith(
        'http://test-proxy.com/test-route',
        { args: ['arg1', 'arg2'] },
        {
          timeout: 5000,
          headers: mockSecureHeaders,
        },
      );
      expect(result).toEqual(mockResponse.data);
    });

    it('should handle internal server error with error deserialization', async () => {
      const mockError = {
        isAxiosError: true,
        response: {
          status: StatusCodes.INTERNAL_SERVER_ERROR,
          data: { message: 'Internal server error' },
        },
      };
      const deserializedError = new Error('Deserialized error');

      (SecurityUtil.getSecureHeaderMap as jest.Mock).mockReturnValue({});
      (axios.post as jest.Mock).mockRejectedValue(mockError);
      (ErrorUtil.deserializeError as jest.Mock).mockReturnValue(deserializedError);

      await expect(ProxyUtil.makeProxyCall(mockConfig)).rejects.toEqual(deserializedError);

      expect(ErrorUtil.deserializeError).toHaveBeenCalledWith(mockError.response.data);
    });

    it('should handle axios error without response', async () => {
      const mockError = {
        isAxiosError: true,
        message: 'Network error',
      };

      (SecurityUtil.getSecureHeaderMap as jest.Mock).mockReturnValue({});
      (axios.post as jest.Mock).mockRejectedValue(mockError);

      await expect(ProxyUtil.makeProxyCall(mockConfig)).rejects.toEqual(mockError);
    });

    it('should handle non-axios errors', async () => {
      const mockError = new Error('Generic error');

      (SecurityUtil.getSecureHeaderMap as jest.Mock).mockReturnValue({});
      (axios.post as jest.Mock).mockRejectedValue(mockError);

      await expect(ProxyUtil.makeProxyCall(mockConfig)).rejects.toEqual(mockError);
    });

    it('should make call without secure config', async () => {
      const configWithoutSecurity = {
        ...mockConfig,
        secureConfig: undefined,
      };
      const mockResponse = { data: { result: 'success' } };

      (SecurityUtil.getSecureHeaderMap as jest.Mock).mockReturnValue({});
      (axios.post as jest.Mock).mockResolvedValue(mockResponse);

      const result = await ProxyUtil.makeProxyCall(configWithoutSecurity);

      expect(axios.post).toHaveBeenCalledWith(
        'http://test-proxy.com/test-route',
        { args: ['arg1', 'arg2'] },
        {
          timeout: 5000,
          headers: {},
        },
      );
      expect(result).toEqual(mockResponse.data);
    });
  });
});
