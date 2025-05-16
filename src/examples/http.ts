/* tslint:disable:max-classes-per-file */
import fs from 'fs';
import type { IncomingMessage, ServerResponse } from 'http';
import http from 'http';
import { StatusCodes } from 'http-status-codes';
import path from 'path';
import url from 'url';
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

export const { DevelopmentProxy, callActualMethod, resultKey } = new DevelopmentProxyInitializer({
  isProxyEnv: process.env.NODE_ENV === 'proxy',
  // Note: update below if you are testing with deployment
  isTestEnv: process.env.NODE_ENV === 'local',
  resultKey: 'result',
  useRuntimeProxyUrl: false,
  targetHeaderKey: 'X-Proxy-Target-Test',
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

const PORT = process.env.PORT || 3000;

http
  .createServer(async (req: IncomingMessage, res: ServerResponse<IncomingMessage>) => {
    try {
      if (!req.url) {
        throw new Error('Invalid URL');
      }
      const baseURI = url.parse(req.url, true);
      if (req.method === 'POST' && baseURI.path?.startsWith('/dev-proxy')) {
        await HttpRouterAdapter.getHttpHandler('/dev-proxy', { callActualMethod, resultKey })(
          req,
          res,
        );
      } else if (baseURI.path === '/test') {
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
        res.writeHead(StatusCodes.OK);
        res.end(
          JSON.stringify({
            sumResult,
            minusResult,
            multiplicationResult,
            duplicateMultiplicationResult,
          }),
        );
        console.log('------------------------------------------------------------');
      } else {
        throw new HTTPMethodNotFoundError(`${baseURI.path} does not have any handler attached!!`);
      }
    } catch (error) {
      res.writeHead((error as HTTPError).statusCode || StatusCodes.INTERNAL_SERVER_ERROR);
      res.end(
        JSON.stringify({
          message: (error as Error).message,
          stack: (error as Error).stack,
        }),
      );
    }
  })
  .listen(PORT, () => {
    log(`Server started at ${PORT}\n`);
    if (process.env.NODE_ENV === 'proxy') {
      log(`Please Hit http://localhost:${PORT}/test to Test Direct Proxy Hit\n`);
    }
    if (process.env.NODE_ENV === 'local') {
      log(`Please Hit http://localhost:${PORT}/test to Test Local-->Proxy Connection\n`);
    }
  });
