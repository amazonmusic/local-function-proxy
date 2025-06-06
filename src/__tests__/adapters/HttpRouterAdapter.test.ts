import express from 'express';
import type { ServerResponse } from 'http';
import http, { IncomingMessage } from 'http';
import { StatusCodes } from 'http-status-codes';
import { Socket } from 'net';
import { Readable } from 'stream';
import request from 'supertest';
import url from 'url';
import { HttpRouterAdapter } from '../../adapters';

describe('HttpRouterAdapter', () => {
  const DEV_PROXY_BASE_ROUTE = '/dev-proxy';
  const PROXY_HEADER = 'test-header';

  describe('getExpressJsRouter', () => {
    it('should call methodCaller with correct arguments', async () => {
      const callActualMethod = jest.fn().mockResolvedValue({ data: 'test data' });
      const mockInitializer = {
        callActualMethod,
        proxyHeaderKey: 'test-header',
        resultKey: 'test-result',
      };
      const router = HttpRouterAdapter.getExpressJsRouter(mockInitializer as any);
      const app = express();
      app.use(DEV_PROXY_BASE_ROUTE, router);

      const response = await request(app)
        .post(`${DEV_PROXY_BASE_ROUTE}/test`)
        .send({ key: 'value' })
        .set(PROXY_HEADER, 'test-header-value');

      const callArgs = callActualMethod.mock.calls[0][0];
      expect(callArgs.getHeader('test-header')).toBe('test-header-value');
      expect(JSON.stringify(callArgs.getBody())).toBe(JSON.stringify({ key: 'value' }));
      expect(callArgs.route).toBe('/test');
      expect(response.status).toBe(StatusCodes.OK);
      expect(response.text).toBe(JSON.stringify({ 'test-result': { data: 'test data' } }));
    });

    it('should not call methodCaller when incorrect base route is called', async () => {
      const callActualMethod = jest.fn().mockResolvedValue({ data: 'test data' });
      const mockInitializer = { callActualMethod, proxyHeaderKey: 'test-header' };
      const router = HttpRouterAdapter.getExpressJsRouter(mockInitializer as any);
      const app = express();
      app.use(DEV_PROXY_BASE_ROUTE, router);

      const incorrectBasePath = '/incorrect-base-route';

      const response = await request(app)
        .post(`${incorrectBasePath}/test`)
        .send({ key: 'value' })
        .set(PROXY_HEADER, 'test-header-value');

      expect(callActualMethod).not.toHaveBeenCalled();
      expect(response.status).toBe(StatusCodes.NOT_FOUND);
      const notFoundResponse = [
        '<!DOCTYPE html>',
        '<html lang="en">',
        '<head>',
        '<meta charset="utf-8">',
        '<title>Error</title>',
        '</head>',
        '<body>',
        `<pre>Cannot POST ${incorrectBasePath}/test</pre>`,
        '</body>',
        '</html>\n',
      ].join('\n');
      expect(response.text).toEqual(notFoundResponse);
    });

    it('should handle errors correctly', async () => {
      const error = new Error('Test error');
      const callActualMethod = jest.fn().mockRejectedValue(error);
      const mockInitializer = { callActualMethod, proxyHeaderKey: PROXY_HEADER };
      const router = HttpRouterAdapter.getExpressJsRouter(mockInitializer as any);
      const app = express();
      app.use(DEV_PROXY_BASE_ROUTE, router);

      const response = await request(app)
        .post(`${DEV_PROXY_BASE_ROUTE}/test`)
        .send({ key: 'value' })
        .set(PROXY_HEADER, 'test-header-value');

      expect(response.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(response.text).toBe(
        JSON.stringify({
          name: error.name,
          message: error.message,
          stack: error.stack,
        }),
      );
    });
  });

  describe('getHttpHandler', () => {
    it('should call methodCaller with correct arguments', async () => {
      const callActualMethod = jest.fn().mockResolvedValue({ data: 'test data' });
      const mockInitializer = {
        callActualMethod,
        proxyHeaderKey: 'test-header',
        resultKey: 'test-result',
      };
      const httpHandler = HttpRouterAdapter.getHttpHandler(
        DEV_PROXY_BASE_ROUTE,
        mockInitializer as any,
      );
      const response = await request(getHttpServer(DEV_PROXY_BASE_ROUTE, 'POST', httpHandler))
        .post(`${DEV_PROXY_BASE_ROUTE}/test`)
        .send({ key: 'value' })
        .set(PROXY_HEADER, 'test-header-value');

      const callArgs = callActualMethod.mock.calls[0][0];
      expect(callArgs.getHeader('test-header')).toBe('test-header-value');
      expect(JSON.stringify(callArgs.getBody())).toBe(JSON.stringify({ key: 'value' }));
      expect(callArgs.route).toBe('/test');
      expect(response.status).toBe(StatusCodes.OK);
      expect(response.text).toBe(JSON.stringify({ 'test-result': { data: 'test data' } }));
    });

    it('should not call methodCaller when incorrect base route is called', async () => {
      const callActualMethod = jest.fn().mockResolvedValue({ data: 'test data' });
      const mockInitializer = { callActualMethod, proxyHeaderKey: 'test-header' };
      const httpHandler = HttpRouterAdapter.getHttpHandler(
        DEV_PROXY_BASE_ROUTE,
        mockInitializer as any,
      );
      const incorrectBasePath = '/incorrect-base-route';

      const response = await request(getHttpServer(DEV_PROXY_BASE_ROUTE, 'POST', httpHandler))
        .post(`${incorrectBasePath}/test`)
        .send({ key: 'value' })
        .set(PROXY_HEADER, 'test-header-value');

      expect(callActualMethod).not.toHaveBeenCalled();
      expect(response.status).toBe(StatusCodes.NOT_FOUND);
    });

    it('should also call methodCaller when no proxy route is passed', async () => {
      const callActualMethod = jest.fn().mockResolvedValue({ data: 'test data' });
      const mockInitializer = { callActualMethod, resultKey: 'testKey' };
      const httpHandler = HttpRouterAdapter.getHttpHandler(
        DEV_PROXY_BASE_ROUTE,
        mockInitializer as any,
      );

      const response = await request(getHttpServer(DEV_PROXY_BASE_ROUTE, 'POST', httpHandler))
        .post(`${DEV_PROXY_BASE_ROUTE}`)
        .send({ key: 'value' })
        .set(PROXY_HEADER, 'test-header-value');

      expect(callActualMethod).toHaveBeenCalled();
      expect(response.status).toBe(StatusCodes.OK);
      expect(response.text).toContain(JSON.stringify({ testKey: { data: 'test data' } }));
    });

    it('should handle errors correctly', async () => {
      const error = new Error('Test error');
      const callActualMethod = jest.fn().mockRejectedValue(error);
      const mockInitializer = { callActualMethod, proxyHeaderKey: PROXY_HEADER };
      const httpHandler = HttpRouterAdapter.getHttpHandler(
        DEV_PROXY_BASE_ROUTE,
        mockInitializer as any,
      );

      const response = await request(getHttpServer(DEV_PROXY_BASE_ROUTE, 'POST', httpHandler))
        .post(`${DEV_PROXY_BASE_ROUTE}/test`)
        .send({ key: 'value' })
        .set(PROXY_HEADER, 'test-header-value');

      expect(response.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(response.text).toBe(
        JSON.stringify({
          name: error.name,
          message: error.message,
          stack: error.stack,
        }),
      );
    });
  });

  describe('getJsonRequestBody', () => {
    const getJsonRequestBody = (HttpRouterAdapter as any).getJsonRequestBody;
    it('should return an empty object when the request body is empty', async () => {
      const req = new Readable();
      req.push(JSON.stringify({}));
      req.push(null);

      const result = await getJsonRequestBody(req as unknown as IncomingMessage);

      expect(result).toEqual({});
    });

    it('should return the correct JSON object when the request body is valid JSON', async () => {
      const expectedJson = { name: 'John Doe', age: 30 };
      const req = new Readable();
      req.push(JSON.stringify(expectedJson));
      req.push(null);

      const result = await getJsonRequestBody(req as unknown as IncomingMessage);

      expect(result).toEqual(expectedJson);
    });

    it('should throw an error when the request body is not valid JSON', async () => {
      const invalidJson = 'invalid json';
      const req = new Readable();
      req.push(invalidJson);
      req.push(null);

      await expect(getJsonRequestBody(req as unknown as IncomingMessage)).rejects.toThrow();
    });
  });

  describe('getUrlFromRequestObject', () => {
    const getUrlFromRequestObject = (HttpRouterAdapter as any).getUrlFromRequestObject;
    it('should return the URL from the request object', () => {
      const mockReq = new IncomingMessage(new Socket());
      mockReq.url = '/test';
      const result = getUrlFromRequestObject(mockReq);
      expect(result).toBe('/test');
    });

    it('should return an empty string if the request object has no URL', () => {
      const mockReq = new IncomingMessage(new Socket());
      const result = getUrlFromRequestObject(mockReq);
      expect(result).toBe('/');
    });
  });
});

function getHttpServer(
  initialPath: string,
  method: string,
  httpHandler: (req: IncomingMessage, res: ServerResponse<IncomingMessage>) => Promise<void>,
) {
  return http.createServer((req: IncomingMessage, res: ServerResponse<IncomingMessage>) => {
    const baseURI = url.parse(req.url!, true);
    if (req.method === method && baseURI.path?.startsWith(initialPath)) {
      httpHandler(req, res).then(console.log).catch(console.error);
    } else {
      res.writeHead(StatusCodes.NOT_FOUND);
      res.end();
    }
  });
}
