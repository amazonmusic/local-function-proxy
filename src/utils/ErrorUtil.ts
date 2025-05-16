import { AxiosError } from 'axios';

export class ErrorUtil {
  static serializeError(error: Error): { [key: string]: any } {
    if ((error as AxiosError).isAxiosError) {
      return ErrorUtil.serializeAxiosError(error as AxiosError);
    }
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  static deserializeError(obj: { [key: string]: any }): Error {
    if (obj.isAxiosError) {
      return ErrorUtil.deserializeAxiosError(obj);
    }
    const error = new Error(obj.message as string);
    error.stack = obj.stack as string | undefined;
    error.name = obj.name as string;
    return error;
  }

  private static serializeAxiosError(error: AxiosError): { [key: string]: any } {
    const axiosError = {
      isAxiosError: true,
      ...error.toJSON(),
      response: error.response && {
        status: error.response.status,
        statusText: error.response.statusText,
        headers: error.response.headers,
        data: error.response.data,
      },
    };
    if ((axiosError as any).config) {
      // strip out http and https Agent
      (axiosError as any).config.httpAgent = undefined;
      (axiosError as any).config.httpsAgent = undefined;
    }
    return axiosError;
  }

  private static deserializeAxiosError(obj: { [key: string]: any }): AxiosError {
    const error = new AxiosError(obj.message, obj.code, obj.config, obj.request, obj.response);
    error.stack = obj.stack as string | undefined;
    return error;
  }
}
