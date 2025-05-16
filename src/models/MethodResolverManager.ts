export type Resolver = (...args: any[]) => Promise<any>;

const DEFAULT_ROUTE = '/default';

export class MethodResolverManager {
  private _devProxyRouteToResolverMap: Map<string, Map<string, Resolver>>;

  constructor() {
    this._devProxyRouteToResolverMap = new Map<string, Map<string, Resolver>>();
  }

  /**
   * Add a resolver for a target method name and route
   *
   * @param targetMethodName The name of the target method
   * @param resolver The resolver function
   * @param route Optional route for the resolver
   * @returns void
   */
  add(targetMethodName: string, resolver: Resolver, route?: string): void {
    if (!this._devProxyRouteToResolverMap.has(targetMethodName)) {
      this._devProxyRouteToResolverMap.set(targetMethodName, new Map<string, Resolver>());
    }
    const targetMethodNameMap = this._devProxyRouteToResolverMap.get(targetMethodName)!;
    if (!route) {
      if (targetMethodNameMap.has(DEFAULT_ROUTE)) {
        throw new Error(`Duplicate targetMethodName: ${targetMethodName}`);
      }
      targetMethodNameMap.set(DEFAULT_ROUTE, resolver);
      return;
    }
    if (targetMethodNameMap.has(route)) {
      throw new Error(`Duplicate targetMethodName: ${targetMethodName} route: ${route}`);
    }
    targetMethodNameMap.set(route, resolver);
    // This line will override last method registered as default route
    targetMethodNameMap.set(DEFAULT_ROUTE, resolver);
  }

  /**
   * Get a resolver for a target method name and route
   *
   * @param targetMethodName The name of the target method
   * @param route Optional route for the resolver
   * @returns The resolver function or undefined if not found
   */
  get(targetMethodName: string, route?: string): Resolver | undefined {
    const targetMethodNameMap = this._devProxyRouteToResolverMap.get(targetMethodName);
    if (!targetMethodNameMap) {
      return;
    }
    return targetMethodNameMap.get(route || DEFAULT_ROUTE);
  }
}
