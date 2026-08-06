import type { AxiosError } from 'axios';
import axios from 'axios';
import { StatusCodes } from 'http-status-codes';
import { ErrorUtil } from './ErrorUtil';

export interface DevProxyConfig {
  fullProxyUrl: string;
  headers: { [key: string]: string };
  timeout: number;
  args: unknown[];
}

export class ProxyUtil {
  /**
   * Make a call to the proxy environment
   *
   * @param config The proxy configuration
   * @returns Response from the actual method call by making call to Proxy Env
   */
  static async makeProxyCall({
    fullProxyUrl,
    headers,
    timeout,
    args,
  }: DevProxyConfig): Promise<Record<string, unknown>> {
    try {
      const response = await axios.post(
        fullProxyUrl,
        { args },
        {
          timeout,
          headers,
        },
      );
      return response.data as Record<string, unknown>;
    } catch (err) {
      throw ProxyUtil.toProxyCallError(err);
    }
  }

  /**
   * Map an error thrown by the proxy call onto the error to surface to the caller
   *
   * A 500 from the proxy env carries the serialized error thrown by the actual
   * method, so it is revived into the original error. Anything else is rethrown
   * as-is.
   *
   * @param err The error thrown while making the proxy call
   * @returns The error to throw to the caller
   */
  private static toProxyCallError(err: unknown): unknown {
    const error = err as Error;
    if ('isAxiosError' in error) {
      const axiosError = err as AxiosError;
      const status = (axiosError.status ?? axiosError.response?.status) as StatusCodes;
      if (status === StatusCodes.INTERNAL_SERVER_ERROR && axiosError.response) {
        const errorData = axiosError.response.data as Record<string, unknown>;
        return ErrorUtil.deserializeError(errorData);
      }
    }
    return err;
  }
}
