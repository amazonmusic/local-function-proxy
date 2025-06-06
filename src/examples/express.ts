/* tslint:disable:max-classes-per-file */
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import express from 'express';
import fs from 'fs';
import http from 'http';
import { StatusCodes } from 'http-status-codes';
import path from 'path';
import type { HTTPError } from '..';
import {
  DevelopmentProxyInitializer,
  HttpRouterAdapter,
  HTTPMethodNotFoundError,
  SecureConfigAdapter,
} from '..';

const log = (...args: unknown[]): void =>
  console.log(`${process.env.NODE_ENV?.toUpperCase()} Env:`, ...args);

const PROXY_HEADER = 'X-Proxy-Header';

function asyncHandler(fn: RequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    return Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export const { DevelopmentProxy, callActualMethod, resultKey } = new DevelopmentProxyInitializer({
  isProxyEnv: process.env.NODE_ENV === 'proxy',
  // Note: update below if you are testing with deployment
  isTestEnv: process.env.NODE_ENV === 'local',
  resultKey: 'result',
  targetHeaderKey: 'X-Proxy-Target-Test',
  useRuntimeProxyUrl: false,
  proxyUrl: 'http://localhost:8080/dev-proxy',
  secureConfig: SecureConfigAdapter.getPublicPrivateKeyPairSecureConfig(
    fs.readFileSync(path.join(process.cwd(), './credentials/testKey.pem'), 'utf8'),
    fs.readFileSync(path.join(process.cwd(), './credentials/testCert.pem'), 'utf8'),
    PROXY_HEADER,
  ),
});

class ArithmeticClass {
  @DevelopmentProxy.call(null)
  static async sum(a: number, b: number): Promise<number> {
    log('sum called with', a, b);
    return a + b;
  }

  @DevelopmentProxy.call(null)
  async minus(a: number, b: number): Promise<number> {
    log('minus called with', a, b);
    return a - b;
  }

  /**
   * need to pass route as there is duplicate non-static method in application
   * not passing route of any of the method could result in non-expecting behavior
   */
  @DevelopmentProxy.call(null, { route: '/original' })
  async multiply(a: number, b: number): Promise<number> {
    log('original multiply called with', a, b);
    return a * b;
  }
}

class DuplicateArithmaticClass {
  @DevelopmentProxy.call(null, { route: '/duplicate' })
  async multiply(a: number, b: number): Promise<number> {
    log('duplicate multiply called with', a, b);
    return a * b;
  }
}

const app = express();

app.use('/dev-proxy', HttpRouterAdapter.getExpressJsRouter({ callActualMethod, resultKey }));

app.get(
  '/test',
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    log('Request received');
    const [a, b] = [Math.random(), Math.random()];
    log('Calling ArithmeticClass.sum()...');
    const sumResult = await ArithmeticClass.sum(a, b);
    log('Calling new ArithmeticClass().minus()...');
    const minusResult = await new ArithmeticClass().minus(a, b);
    log('Calling new ArithmeticClass().multiply()...');
    const multiplicationResult = await new ArithmeticClass().multiply(a, b);
    log('Calling new DuplicateArithmaticClass().multiply()...');
    const duplicateMultiplicationResult = await new DuplicateArithmaticClass().multiply(a, b);
    res.send({ sumResult, minusResult, multiplicationResult, duplicateMultiplicationResult });
    console.log('------------------------------------------------------------');
  }),
);

app.use((req: Request, res: Response, next: NextFunction) => {
  throw new HTTPMethodNotFoundError(`${req.path} does not have any handler attached!!`);
});

app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  const statusCode = (error as HTTPError).statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
  res.status(statusCode).send({
    message: error.message,
    stack: error.stack,
  });
});

const PORT = process.env.PORT || 3000;
http.createServer(app).listen(PORT, () => {
  log(`Server started at ${PORT}\n`);
  if (process.env.NODE_ENV === 'proxy') {
    log(`Please Hit http://localhost:${PORT}/test to Test Direct Proxy Hit\n`);
  }
  if (process.env.NODE_ENV === 'local') {
    log(`Please Hit http://localhost:${PORT}/test to Test Local-->Proxy Connection\n`);
  }
});
