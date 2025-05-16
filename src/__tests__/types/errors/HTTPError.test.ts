import {
  HTTPBadRequestError,
  HTTPMethodNotFoundError,
  HTTPUnauthorizedError,
} from '../../../types';

describe('HTTPError', () => {
  describe('HTTPBadRequestError', () => {
    it('should have 400 as Status Code', () => {
      expect(new HTTPBadRequestError().statusCode).toEqual(400);
    });
  });

  describe('HTTPUnauthorizedError', () => {
    it('should have 401 as Status Code', () => {
      expect(new HTTPUnauthorizedError().statusCode).toEqual(401);
    });
  });

  describe('HTTPMethodNotFoundError', () => {
    it('should have 404 as Status Code', () => {
      expect(new HTTPMethodNotFoundError().statusCode).toEqual(404);
    });
  });
});
