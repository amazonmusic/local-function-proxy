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
      const error = err as Error;
      if ('isAxiosError' in error) {
        const axiosError = err as AxiosError;
        const status = (axiosError.status ?? axiosError.response?.status) as StatusCodes;
        if (status === StatusCodes.INTERNAL_SERVER_ERROR && axiosError.response) {
          const errorData = axiosError.response.data as Record<string, unknown>;
          throw ErrorUtil.deserializeError(errorData);
        }
      }
      throw err;
    }
  }
}
