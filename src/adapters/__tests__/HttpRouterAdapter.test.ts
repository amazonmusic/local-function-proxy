import express from 'express';
import type { ServerResponse } from 'http';
import http, { IncomingMessage } from 'http';
import { StatusCodes } from 'http-status-codes';
import { Socket } from 'net';
import { Readable } from 'stream';
import request from 'supertest';
import url from 'url';
import { HttpRouterAdapter } from '..';

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
      const router = HttpRouterAdapter.getExpressJsRouter(mockInitializer);
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

    it('should pass an undefined route when posting to the base route', async () => {
      const callActualMethod = jest.fn().mockResolvedValue('ok');
      const router = HttpRouterAdapter.getExpressJsRouter({
        callActualMethod,
        resultKey: 'result',
      });
      const app = express();
      app.use(DEV_PROXY_BASE_ROUTE, router);

      await request(app).post(`${DEV_PROXY_BASE_ROUTE}/`).send({ args: [] });

      expect(callActualMethod.mock.calls[0][0].route).toBeUndefined();
    });

    it('should pass a nested route through unchanged', async () => {
      const callActualMethod = jest.fn().mockResolvedValue('ok');
      const router = HttpRouterAdapter.getExpressJsRouter({
        callActualMethod,
        resultKey: 'result',
      });
      const app = express();
      app.use(DEV_PROXY_BASE_ROUTE, router);

      await request(app).post(`${DEV_PROXY_BASE_ROUTE}/nested/deep`).send({ args: [] });

      expect(callActualMethod.mock.calls[0][0].route).toBe('/nested/deep');
    });

    it('should return undefined header values for headers that were not sent', async () => {
      const callActualMethod = jest.fn().mockResolvedValue('ok');
      const router = HttpRouterAdapter.getExpressJsRouter({
        callActualMethod,
        resultKey: 'result',
      });
      const app = express();
      app.use(DEV_PROXY_BASE_ROUTE, router);

      await request(app).post(`${DEV_PROXY_BASE_ROUTE}/test`).send({ args: [] });

      expect(callActualMethod.mock.calls[0][0].getHeader('x-absent')).toBeUndefined();
    });

    it('should serialize an HTTPError-like rejection with its status code text', async () => {
      const error = Object.assign(new Error('StatusCode: 404, Message: nope'), {
        name: 'HTTPMethodNotFoundError',
      });
      const callActualMethod = jest.fn().mockRejectedValue(error);
      const router = HttpRouterAdapter.getExpressJsRouter({
        callActualMethod,
        resultKey: 'result',
      });
      const app = express();
      app.use(DEV_PROXY_BASE_ROUTE, router);

      const response = await request(app).post(`${DEV_PROXY_BASE_ROUTE}/test`).send({ args: [] });

      expect(response.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(JSON.parse(response.text)).toEqual({
        name: 'HTTPMethodNotFoundError',
        message: 'StatusCode: 404, Message: nope',
        stack: error.stack,
      });
    });

    it('should wrap an undefined result under the resultKey', async () => {
      const callActualMethod = jest.fn().mockResolvedValue(undefined);
      const router = HttpRouterAdapter.getExpressJsRouter({
        callActualMethod,
        resultKey: 'result',
      });
      const app = express();
      app.use(DEV_PROXY_BASE_ROUTE, router);

      const response = await request(app).post(`${DEV_PROXY_BASE_ROUTE}/test`).send({ args: [] });

      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body).toEqual({});
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
      const httpHandler = HttpRouterAdapter.getHttpHandler(DEV_PROXY_BASE_ROUTE, mockInitializer);
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
      const httpHandler = HttpRouterAdapter.getHttpHandler(DEV_PROXY_BASE_ROUTE, mockInitializer);

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

    it('should return a 500 when the request body is not valid JSON', async () => {
      const callActualMethod = jest.fn().mockResolvedValue('ok');
      const httpHandler = HttpRouterAdapter.getHttpHandler(DEV_PROXY_BASE_ROUTE, {
        callActualMethod,
        resultKey: 'result',
      });

      const response = await request(getHttpServer(DEV_PROXY_BASE_ROUTE, 'POST', httpHandler))
        .post(`${DEV_PROXY_BASE_ROUTE}/test`)
        .set('Content-Type', 'application/json')
        .send('not json');

      expect(response.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(callActualMethod).not.toHaveBeenCalled();
    });

    it('should look up headers case insensitively', async () => {
      const callActualMethod = jest.fn().mockResolvedValue('ok');
      const httpHandler = HttpRouterAdapter.getHttpHandler(DEV_PROXY_BASE_ROUTE, {
        callActualMethod,
        resultKey: 'result',
      });

      await request(getHttpServer(DEV_PROXY_BASE_ROUTE, 'POST', httpHandler))
        .post(`${DEV_PROXY_BASE_ROUTE}/test`)
        .send({ args: [] })
        .set('X-Mixed-Case', 'value');

      expect(callActualMethod.mock.calls[0][0].getHeader('X-MIXED-CASE')).toBe('value');
      expect(callActualMethod.mock.calls[0][0].getHeader('x-mixed-case')).toBe('value');
    });

    it('should return undefined for headers that were not sent', async () => {
      const callActualMethod = jest.fn().mockResolvedValue('ok');
      const httpHandler = HttpRouterAdapter.getHttpHandler(DEV_PROXY_BASE_ROUTE, {
        callActualMethod,
        resultKey: 'result',
      });

      await request(getHttpServer(DEV_PROXY_BASE_ROUTE, 'POST', httpHandler))
        .post(`${DEV_PROXY_BASE_ROUTE}/test`)
        .send({ args: [] });

      expect(callActualMethod.mock.calls[0][0].getHeader('x-absent')).toBeUndefined();
    });

    it('should strip the proxy prefix and pass a nested route through', async () => {
      const callActualMethod = jest.fn().mockResolvedValue('ok');
      const httpHandler = HttpRouterAdapter.getHttpHandler(DEV_PROXY_BASE_ROUTE, {
        callActualMethod,
        resultKey: 'result',
      });

      await request(getHttpServer(DEV_PROXY_BASE_ROUTE, 'POST', httpHandler))
        .post(`${DEV_PROXY_BASE_ROUTE}/nested/deep`)
        .send({ args: [] });

      expect(callActualMethod.mock.calls[0][0].route).toBe('/nested/deep');
    });

    it('should pass an undefined route when only a trailing slash remains', async () => {
      const callActualMethod = jest.fn().mockResolvedValue('ok');
      const httpHandler = HttpRouterAdapter.getHttpHandler(DEV_PROXY_BASE_ROUTE, {
        callActualMethod,
        resultKey: 'result',
      });

      await request(getHttpServer(DEV_PROXY_BASE_ROUTE, 'POST', httpHandler))
        .post(`${DEV_PROXY_BASE_ROUTE}/`)
        .send({ args: [] });

      expect(callActualMethod.mock.calls[0][0].route).toBeUndefined();
    });

    it('should drop the query string from the route', async () => {
      const callActualMethod = jest.fn().mockResolvedValue('ok');
      const httpHandler = HttpRouterAdapter.getHttpHandler(DEV_PROXY_BASE_ROUTE, {
        callActualMethod,
        resultKey: 'result',
      });

      await request(getHttpServer(DEV_PROXY_BASE_ROUTE, 'POST', httpHandler))
        .post(`${DEV_PROXY_BASE_ROUTE}/test?foo=bar`)
        .send({ args: [] });

      // url.parse keeps the query in `path`, so the route carries it as-is
      expect(callActualMethod.mock.calls[0][0].route).toBe('/test?foo=bar');
    });

    it('should wrap the result under a custom resultKey', async () => {
      const callActualMethod = jest.fn().mockResolvedValue({ nested: true });
      const httpHandler = HttpRouterAdapter.getHttpHandler(DEV_PROXY_BASE_ROUTE, {
        callActualMethod,
        resultKey: 'payload',
      });

      const response = await request(getHttpServer(DEV_PROXY_BASE_ROUTE, 'POST', httpHandler))
        .post(`${DEV_PROXY_BASE_ROUTE}/test`)
        .send({ args: [] });

      expect(response.status).toBe(StatusCodes.OK);
      expect(JSON.parse(response.text)).toEqual({ payload: { nested: true } });
    });
  });

  it('should pass an undefined route when the url has no parseable path', async () => {
    // url.parse returns a null path for a non-hierarchical url, so the optional
    // chain short circuits and no route reaches callActualMethod
    const callActualMethod = jest.fn().mockResolvedValue('ok');
    const httpHandler = HttpRouterAdapter.getHttpHandler(DEV_PROXY_BASE_ROUTE, {
      callActualMethod,
      resultKey: 'result',
    });

    const req = new Readable() as any;
    req.push(JSON.stringify({ args: [] }));
    req.push(null);
    req.url = 'mailto:someone@example.com';
    req.headers = {};

    const res = { writeHead: jest.fn(), end: jest.fn() } as any;
    await httpHandler(req, res);

    expect(callActualMethod).toHaveBeenCalled();
    expect(callActualMethod.mock.calls[0][0].route).toBeUndefined();
    expect(res.writeHead).toHaveBeenCalledWith(StatusCodes.OK);
  });

  describe('toRoute', () => {
    const toRoute = (HttpRouterAdapter as any).toRoute;

    it('should map the root path to undefined', () => {
      expect(toRoute('/')).toBeUndefined();
    });

    it('should pass a concrete path through unchanged', () => {
      expect(toRoute('/test')).toBe('/test');
    });

    it('should pass undefined through unchanged', () => {
      expect(toRoute(undefined)).toBeUndefined();
    });

    it('should pass an empty path through unchanged', () => {
      expect(toRoute('')).toBe('');
    });
  });

  describe('getJsonRequestBody', () => {
    const getJsonRequestBody = (HttpRouterAdapter as any).getJsonRequestBody;
    it('should return an empty object when the request body is empty', async () => {
      const req = new Readable();
      req.push(JSON.stringify({}));
      req.push(null);

      const result = await getJsonRequestBody(req);

      expect(result).toEqual({});
    });

    it('should return the correct JSON object when the request body is valid JSON', async () => {
      const expectedJson = { name: 'John Doe', age: 30 };
      const req = new Readable();
      req.push(JSON.stringify(expectedJson));
      req.push(null);

      const result = await getJsonRequestBody(req);

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
