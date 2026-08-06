import { HTTPBadRequestError, HTTPError, HTTPMethodNotFoundError, HTTPUnauthorizedError } from '..';

describe('HTTPError', () => {
  describe('HTTPError base class', () => {
    it('should expose the status code and message it was built with', () => {
      const error = new HTTPError(418, "I'm a teapot");
      expect(error.statusCode).toEqual(418);
      expect(error.message).toEqual("I'm a teapot");
    });

    it('should be an instance of Error', () => {
      expect(new HTTPError(500, 'boom')).toBeInstanceOf(Error);
    });

    it('should keep a stack trace', () => {
      expect(new HTTPError(500, 'boom').stack).toBeDefined();
    });
  });

  describe('HTTPBadRequestError', () => {
    it('should have 400 as Status Code', () => {
      expect(new HTTPBadRequestError().statusCode).toEqual(400);
    });

    it('should default the message to Bad Request', () => {
      expect(new HTTPBadRequestError().message).toEqual('Bad Request');
    });

    it('should keep a custom message', () => {
      expect(new HTTPBadRequestError('args missing').message).toEqual('args missing');
    });

    it('should be an instance of HTTPError', () => {
      expect(new HTTPBadRequestError()).toBeInstanceOf(HTTPError);
    });
  });

  describe('HTTPUnauthorizedError', () => {
    it('should have 401 as Status Code', () => {
      expect(new HTTPUnauthorizedError().statusCode).toEqual(401);
    });

    it('should default the message to Unauthorized', () => {
      expect(new HTTPUnauthorizedError().message).toEqual('Unauthorized');
    });

    it('should keep a custom message', () => {
      expect(new HTTPUnauthorizedError('bad token').message).toEqual('bad token');
    });

    it('should be an instance of HTTPError', () => {
      expect(new HTTPUnauthorizedError()).toBeInstanceOf(HTTPError);
    });
  });

  describe('HTTPMethodNotFoundError', () => {
    it('should have 404 as Status Code', () => {
      expect(new HTTPMethodNotFoundError().statusCode).toEqual(404);
    });

    it('should default the message to Method Not Found', () => {
      expect(new HTTPMethodNotFoundError().message).toEqual('Method Not Found');
    });

    it('should keep a custom message', () => {
      expect(new HTTPMethodNotFoundError('no resolver').message).toEqual('no resolver');
    });

    it('should be an instance of HTTPError', () => {
      expect(new HTTPMethodNotFoundError()).toBeInstanceOf(HTTPError);
    });
  });
});
