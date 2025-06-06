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

export class HTTPBadRequestError extends HTTPError {
  constructor(public message: string = 'Bad Request') {
    super(StatusCodes.BAD_REQUEST, message);
  }
}

export class HTTPUnauthorizedError extends HTTPError {
  constructor(public message: string = 'Unauthorized') {
    super(StatusCodes.UNAUTHORIZED, message);
  }
}

export class HTTPMethodNotFoundError extends HTTPError {
  constructor(public message: string = 'Method Not Found') {
    super(StatusCodes.NOT_FOUND, message);
  }
}
