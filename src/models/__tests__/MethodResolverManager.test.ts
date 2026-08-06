import type { Resolver } from '..';
import { MethodResolverManager } from '..';

describe('MethodResolverManager', () => {
  let manager: MethodResolverManager;
  let mockResolver1: Resolver;
  let mockResolver2: Resolver;

  beforeEach(() => {
    manager = new MethodResolverManager();
    mockResolver1 = jest.fn().mockResolvedValue('result1');
    mockResolver2 = jest.fn().mockResolvedValue('result2');
  });

  describe('add method', () => {
    it('should add resolver without route', () => {
      manager.add('method1', mockResolver1);
      const resolver = manager.get('method1');
      expect(resolver).toBe(mockResolver1);
    });

    it('should add resolver with specific route', () => {
      manager.add('method1', mockResolver1, '/custom-route');
      const resolver = manager.get('method1', '/custom-route');
      expect(resolver).toBe(mockResolver1);
    });

    it('should treat an empty route as no route', () => {
      manager.add('method1', mockResolver1, '');
      expect(manager.get('method1')).toBe(mockResolver1);
    });

    it('should throw error when adding duplicate method without route', () => {
      manager.add('method1', mockResolver1);
      expect(() => {
        manager.add('method1', mockResolver2);
      }).toThrow('Duplicate targetMethodName: method1');
    });

    it('should throw error when adding duplicate method with same route', () => {
      manager.add('method1', mockResolver1, '/custom-route');
      expect(() => {
        manager.add('method1', mockResolver2, '/custom-route');
      }).toThrow('Duplicate targetMethodName: method1 route: /custom-route');
    });

    it('should throw when adding without a route after a routed registration', () => {
      // a routed add also claims the default route, so a later routeless add collides
      manager.add('method1', mockResolver1, '/custom-route');
      expect(() => {
        manager.add('method1', mockResolver2);
      }).toThrow('Duplicate targetMethodName: method1');
    });

    it('should override default route when adding resolver with specific route', () => {
      manager.add('method1', mockResolver1);
      manager.add('method1', mockResolver2, '/custom-route');

      const defaultResolver = manager.get('method1');
      expect(defaultResolver).toBe(mockResolver2);
    });

    it('should keep the routed resolver reachable after it overrides the default', () => {
      manager.add('method1', mockResolver1);
      manager.add('method1', mockResolver2, '/custom-route');

      expect(manager.get('method1', '/custom-route')).toBe(mockResolver2);
    });

    it('should let the last routed registration win the default route', () => {
      const mockResolver3: Resolver = jest.fn().mockResolvedValue('result3');
      manager.add('method1', mockResolver1, '/route-1');
      manager.add('method1', mockResolver2, '/route-2');
      manager.add('method1', mockResolver3, '/route-3');

      expect(manager.get('method1')).toBe(mockResolver3);
      expect(manager.get('method1', '/route-1')).toBe(mockResolver1);
      expect(manager.get('method1', '/route-2')).toBe(mockResolver2);
    });

    it('should keep resolvers for different method names independent', () => {
      manager.add('method1', mockResolver1, '/shared-route');
      manager.add('method2', mockResolver2, '/shared-route');

      expect(manager.get('method1', '/shared-route')).toBe(mockResolver1);
      expect(manager.get('method2', '/shared-route')).toBe(mockResolver2);
    });

    it('should allow the same route on different method names', () => {
      expect(() => {
        manager.add('method1', mockResolver1, '/same');
        manager.add('method2', mockResolver2, '/same');
      }).not.toThrow();
    });

    it('should support registering a resolver under the literal default route', () => {
      manager.add('method1', mockResolver1, '/default');
      expect(manager.get('method1', '/default')).toBe(mockResolver1);
    });
  });

  describe('get method', () => {
    it('should return undefined for non-existent method', () => {
      const resolver = manager.get('nonexistent');
      expect(resolver).toBeUndefined();
    });

    it('should return undefined for non-existent route', () => {
      manager.add('method1', mockResolver1);
      const resolver = manager.get('method1', '/non-existent-route');
      expect(resolver).toBeUndefined();
    });

    it('should return undefined for a non-existent method and route pair', () => {
      manager.add('method1', mockResolver1, '/route');
      expect(manager.get('other', '/route')).toBeUndefined();
    });

    it('should return default resolver when no route is specified', () => {
      manager.add('method1', mockResolver1);
      const resolver = manager.get('method1');
      expect(resolver).toBe(mockResolver1);
    });

    it('should fall back to the default resolver for an empty route', () => {
      manager.add('method1', mockResolver1);
      expect(manager.get('method1', '')).toBe(mockResolver1);
    });

    it('should return specific route resolver when route is specified', () => {
      manager.add('method1', mockResolver1, '/custom-route');
      const resolver = manager.get('method1', '/custom-route');
      expect(resolver).toBe(mockResolver1);
    });

    it('should treat routes as case sensitive', () => {
      manager.add('method1', mockResolver1, '/Route');
      expect(manager.get('method1', '/route')).toBeUndefined();
    });

    it('should treat method names as case sensitive', () => {
      manager.add('method1', mockResolver1);
      expect(manager.get('Method1')).toBeUndefined();
    });
  });

  describe('resolver execution', () => {
    it('should successfully execute the resolver', async () => {
      manager.add('method1', mockResolver1);
      const resolver = manager.get('method1');
      const result = await resolver!();
      expect(result).toBe('result1');
      expect(mockResolver1).toHaveBeenCalled();
    });

    it('should pass arguments through to the resolver', async () => {
      manager.add('method1', mockResolver1);
      await manager.get('method1')!('a', 1, { b: true });
      expect(mockResolver1).toHaveBeenCalledWith('a', 1, { b: true });
    });

    it('should surface a rejection from the resolver', async () => {
      const failing: Resolver = jest.fn().mockRejectedValue(new Error('resolver failed'));
      manager.add('failing', failing);
      await expect(manager.get('failing')!()).rejects.toThrow('resolver failed');
    });
  });
});
