import type { Request, Response } from 'express';
import express, { Router } from 'express';
import type { IncomingMessage, ServerResponse } from 'http';
import { StatusCodes } from 'http-status-codes';
import url from 'url';
import type { RequestConfig } from '../types';
import { ErrorUtil } from '../utils';

export interface ProxyRoutingConfig {
  callActualMethod: (config: RequestConfig) => Promise<unknown>;
  resultKey: string;
}

/**
 * Route value meaning "no specific route", i.e. use the default resolver
 */
const ROOT_PATH = '/';

export class HttpRouterAdapter {
  /**
   * Get an Express router for handling proxy requests
   *
   * @param config The proxy routing configuration
   * @returns An Express router
   */
  static getExpressJsRouter({ callActualMethod, resultKey }: ProxyRoutingConfig): Router {
    const router = Router();
    router.use(express.json());
    router.post('/*', (req: Request, res: Response) => {
      callActualMethod({
        getHeader: (key: string) => req.get(key),
        getBody: () => req.body as Record<string, unknown>,
        route: HttpRouterAdapter.toRoute(req.path),
      })
        .then((result) => {
          res.status(StatusCodes.OK).send({ [resultKey]: result });
        })
        .catch((error) => {
          res
            .status(StatusCodes.INTERNAL_SERVER_ERROR)
            .send(ErrorUtil.serializeError(error as Error));
        });
    });
    return router;
  }

  /**
   * Get an HTTP handler for handling proxy requests
   *
   * @param proxyPrefixPath The prefix path for proxy requests
   * @param config The proxy routing configuration
   * @returns An HTTP request handler function
   */
  static getHttpHandler(
    proxyPrefixPath: string,
    { callActualMethod, resultKey }: ProxyRoutingConfig,
  ): (req: IncomingMessage, res: ServerResponse<IncomingMessage>) => Promise<void> {
    return async (req: IncomingMessage, res: ServerResponse<IncomingMessage>) => {
      try {
        const baseURI = url.parse(this.getUrlFromRequestObject(req), true);
        const path = baseURI.path?.replace(proxyPrefixPath, '');
        const body = await this.getJsonRequestBody(req);
        const result = await callActualMethod({
          getHeader: (key: string) => req.headers[key.toLowerCase()] as string | undefined,
          getBody: () => body,
          route: HttpRouterAdapter.toRoute(path),
        });
        res.writeHead(StatusCodes.OK);
        res.end(JSON.stringify({ [resultKey]: result }));
      } catch (error) {
        res.writeHead(StatusCodes.INTERNAL_SERVER_ERROR);
        res.end(JSON.stringify(ErrorUtil.serializeError(error as Error)));
      }
    };
  }

  /**
   * Normalize a request path into the route used for resolver lookup
   *
   * The root path carries no routing information, so it maps to undefined and
   * lets the default resolver handle the call
   *
   * @param path The request path, relative to the proxy prefix
   * @returns The route, or undefined when the path is the root path
   */
  private static toRoute(path: string | undefined): string | undefined {
    return path !== ROOT_PATH ? path : undefined;
  }

  /**
   * Parse JSON request body from an HTTP request
   *
   * @param req The HTTP request
   * @returns The parsed JSON body
   */
  private static async getJsonRequestBody(req: IncomingMessage): Promise<Record<string, unknown>> {
    const buffers: Uint8Array[] = [];
    for await (const chunk of req) {
      buffers.push(chunk);
    }
    const data = Buffer.concat(buffers).toString();
    return JSON.parse(data) as Record<string, unknown>;
  }

  /**
   * Get the URL from an HTTP request object
   *
   * @param req The HTTP request
   * @returns The URL string
   */
  private static getUrlFromRequestObject(req: IncomingMessage): string {
    return req.url || ROOT_PATH;
  }
}
