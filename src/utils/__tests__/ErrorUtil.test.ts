import type { AxiosRequestHeaders } from 'axios';
import { AxiosError } from 'axios';
import { ErrorUtil } from '..';

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

    it('should strip http and https agents from the serialized config', () => {
      const axiosError = new AxiosError('Test error', 'ERR_BAD_REQUEST', {
        url: 'https://api.example.com',
        headers: {} as AxiosRequestHeaders,
        httpAgent: { keepAlive: true },
        httpsAgent: { keepAlive: true },
      } as any);

      const serialized = ErrorUtil.serializeError(axiosError);

      expect(serialized.config.httpAgent).toBeUndefined();
      expect(serialized.config.httpsAgent).toBeUndefined();
      expect(serialized.config.url).toBe('https://api.example.com');
    });

    it('should produce a JSON-safe payload for an AxiosError with agents', () => {
      const axiosError = new AxiosError('Test error', 'ERR_BAD_REQUEST', {
        headers: {} as AxiosRequestHeaders,
        httpAgent: { keepAlive: true },
      } as any);

      expect(() => JSON.stringify(ErrorUtil.serializeError(axiosError))).not.toThrow();
    });

    it('should preserve a custom error name through a round trip', () => {
      const error = new Error('custom failure');
      error.name = 'CustomError';

      const deserialized = ErrorUtil.deserializeError(ErrorUtil.serializeError(error));

      expect(deserialized.name).toBe('CustomError');
      expect(deserialized.message).toBe('custom failure');
      expect(deserialized.stack).toBe(error.stack);
    });

    it('should round trip an error with an empty message', () => {
      const deserialized = ErrorUtil.deserializeError(ErrorUtil.serializeError(new Error()));

      expect(deserialized).toBeInstanceOf(Error);
      expect(deserialized.message).toBe('');
    });

    it('should deserialize an empty object into an Error', () => {
      const deserialized = ErrorUtil.deserializeError({});

      expect(deserialized).toBeInstanceOf(Error);
      expect(deserialized.message).toBe('');
      expect(deserialized.stack).toBeUndefined();
    });

    it('should not treat a falsy isAxiosError flag as an AxiosError', () => {
      const deserialized = ErrorUtil.deserializeError({
        isAxiosError: false,
        message: 'plain error',
      });

      expect(deserialized).not.toBeInstanceOf(AxiosError);
      expect(deserialized.message).toBe('plain error');
    });

    it('should mark serialized AxiosErrors with the isAxiosError flag', () => {
      const serialized = ErrorUtil.serializeError(new AxiosError('flagged'));
      expect(serialized.isAxiosError).toBe(true);
    });

    it('should preserve the response of an AxiosError through a round trip', () => {
      const axiosError = new AxiosError('Server error', 'ERR_BAD_RESPONSE', undefined, {}, {
        status: 500,
        statusText: 'Internal Server Error',
        headers: { 'content-type': 'application/json' },
        data: { reason: 'exploded' },
        config: {} as any,
        request: {},
      } as any);

      const deserialized = ErrorUtil.deserializeError(
        ErrorUtil.serializeError(axiosError),
      ) as AxiosError;

      expect(deserialized).toBeInstanceOf(AxiosError);
      expect(deserialized.response?.status).toBe(500);
      expect(deserialized.response?.data).toEqual({ reason: 'exploded' });
    });

    it('should keep HTTPError-shaped errors readable after a round trip', () => {
      const error = new Error('StatusCode: 404, Message: not found');
      error.name = 'HTTPMethodNotFoundError';

      const deserialized = ErrorUtil.deserializeError(ErrorUtil.serializeError(error));

      expect(deserialized.name).toBe('HTTPMethodNotFoundError');
      expect(deserialized.message).toBe('StatusCode: 404, Message: not found');
    });
  });
});
