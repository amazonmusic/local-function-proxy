import type { AxiosRequestHeaders } from 'axios';
import { AxiosError } from 'axios';
import { ErrorUtil } from '../../utils';

describe('ErrorUtil', () => {
  describe('serializeError', () => {
    it('should serialize regular Error', () => {
      const error = new Error('Test error');
      const serialized = ErrorUtil.serializeError(error);

      expect(serialized).toEqual({
        name: 'Error',
        message: 'Test error',
        stack: error.stack,
      });
    });

    it('should serialize AxiosError', () => {
      const axiosError = new AxiosError(
        'Network error',
        'ERR_NETWORK',
        {
          url: 'https://api.example.com',
          method: 'GET',
          headers: { 'Content-Type': 'application/json' } as AxiosRequestHeaders,
          data: { foo: 'bar' },
        },
        {},
        {
          status: 404,
          statusText: 'Not Found',
          headers: { 'content-type': 'application/json' },
          data: { error: 'Resource not found' },
          config: {} as any,
          request: {},
        },
      );

      const serialized = ErrorUtil.serializeError(axiosError);

      expect(serialized).toEqual({
        isAxiosError: true,
        code: 'ERR_NETWORK',
        message: 'Network error',
        name: 'AxiosError',
        stack: axiosError.stack,
        config: {
          url: 'https://api.example.com',
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          data: { foo: 'bar' },
        },
        response: {
          status: 404,
          statusText: 'Not Found',
          headers: { 'content-type': 'application/json' },
          data: { error: 'Resource not found' },
        },
        status: 404,
      });
    });
  });

  describe('deserializeError', () => {
    it('should deserialize regular Error', () => {
      const serializedError = {
        message: 'Test error',
        stack: 'Error: Test error\n    at Object.<anonymous>',
      };

      const deserialized = ErrorUtil.deserializeError(serializedError);

      expect(deserialized).toBeInstanceOf(Error);
      expect(deserialized.message).toBe('Test error');
      expect(deserialized.stack).toBe(serializedError.stack);
    });

    it('should deserialize AxiosError', () => {
      const serializedAxiosError = {
        isAxiosError: true,
        code: 'ERR_NETWORK',
        message: 'Network error',
        stack: 'Error: Network error\n    at Object.<anonymous>',
        config: {
          url: 'https://api.example.com',
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          data: { foo: 'bar' },
        },
        response: {
          status: 404,
          statusText: 'Not Found',
          headers: { 'content-type': 'application/json' },
          data: { error: 'Resource not found' },
        },
      };

      const deserialized = ErrorUtil.deserializeError(serializedAxiosError) as AxiosError;

      expect(deserialized).toBeInstanceOf(AxiosError);
      expect(deserialized.message).toBe('Network error');
      expect(deserialized.code).toBe('ERR_NETWORK');
      expect(deserialized.stack).toBe(serializedAxiosError.stack);
      expect(deserialized.config).toEqual(serializedAxiosError.config);
      expect(deserialized.response).toEqual(serializedAxiosError.response);
    });
  });

  describe('Edge cases', () => {
    it('should handle AxiosError with minimal data', () => {
      const minimalAxiosError = new AxiosError('Minimal error');
      const serialized = ErrorUtil.serializeError(minimalAxiosError);
      const deserialized = ErrorUtil.deserializeError(serialized);

      expect(deserialized).toBeInstanceOf(AxiosError);
      expect(deserialized.message).toBe('Minimal error');
    });

    it('should handle AxiosError with null config and response', () => {
      const axiosError = new AxiosError('Test error');
      axiosError.config = null as any;

      const serialized = ErrorUtil.serializeError(axiosError);

      expect(serialized.config).toEqual(null);
      expect(serialized.response).toBeUndefined();
    });
  });
});
