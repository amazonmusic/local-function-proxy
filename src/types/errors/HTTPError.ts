/* tslint:disable:max-classes-per-file */
import StatusCodes from 'http-status-codes';

export class HTTPError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
  ) {
    super(`StatusCode: ${statusCode}, Message: ${message}`);
  }
}

/**
 * Thrown when the proxy request is malformed, e.g. missing body or args
 */
export class HTTPBadRequestError extends HTTPError {
  constructor(public message: string = 'Bad Request') {
    super(StatusCodes.BAD_REQUEST, message);
  }
}

/**
 * Thrown when the proxy request carries a missing or expired security token
 */
export class HTTPUnauthorizedError extends HTTPError {
  constructor(public message: string = 'Unauthorized') {
    super(StatusCodes.UNAUTHORIZED, message);
  }
}

/**
 * Thrown when no resolver is registered for the requested method and route
 */
export class HTTPMethodNotFoundError extends HTTPError {
  constructor(public message: string = 'Method Not Found') {
    super(StatusCodes.NOT_FOUND, message);
  }
}
