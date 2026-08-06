import { AxiosError } from 'axios';

/**
 * Plain JSON-safe representation of an Error, as sent over the proxy wire
 */
export type SerializedError = { [key: string]: any };

export class ErrorUtil {
  /**
   * Convert an Error into a JSON-safe object to send back to the Test env
   *
   * @param error The error to serialize
   * @returns A JSON-safe representation of the error
   */
  static serializeError(error: Error): SerializedError {
    if ((error as AxiosError).isAxiosError) {
      return ErrorUtil.serializeAxiosError(error as AxiosError);
    }
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  /**
   * Revive an Error from its serialized representation
   *
   * @param obj The serialized error
   * @returns The reconstructed error
   */
  static deserializeError(obj: SerializedError): Error {
    if (obj.isAxiosError) {
      return ErrorUtil.deserializeAxiosError(obj);
    }
    const error = new Error(obj.message as string);
    error.stack = obj.stack as string | undefined;
    error.name = obj.name as string;
    return error;
  }

  /**
   * Serialize an AxiosError, keeping only the JSON-safe parts of its response
   *
   * @param error The AxiosError to serialize
   * @returns A JSON-safe representation of the AxiosError
   */
  private static serializeAxiosError(error: AxiosError): SerializedError {
    const axiosError: SerializedError = {
      isAxiosError: true,
      ...error.toJSON(),
      response: error.response && {
        status: error.response.status,
        statusText: error.response.statusText,
        headers: error.response.headers,
        data: error.response.data,
      },
    };
    if (axiosError.config) {
      // strip out http and https Agent
      axiosError.config.httpAgent = undefined;
      axiosError.config.httpsAgent = undefined;
    }
    return axiosError;
  }

  /**
   * Revive an AxiosError from its serialized representation
   *
   * @param obj The serialized AxiosError
   * @returns The reconstructed AxiosError
   */
  private static deserializeAxiosError(obj: SerializedError): AxiosError {
    const error = new AxiosError(obj.message, obj.code, obj.config, obj.request, obj.response);
    error.stack = obj.stack as string | undefined;
    return error;
  }
}
