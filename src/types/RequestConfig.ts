export type RequestConfig = {
  /**
   * Function to retrieve a header value from the request
   *
   * @param key The header key to retrieve
   * @returns The header value if found, undefined otherwise
   */
  getHeader: (key: string) => string | undefined;

  /**
   * Function to retrieve the request body
   *
   * @returns The parsed request body as a record
   */
  getBody: () => Record<string, unknown>;

  /**
   * Optional route path from the request URL
   * Used to differentiate between multiple methods with the same name
   */
  route?: string;
};
