import type { Resolver } from '../../models';
import { MethodResolverManager } from '../../models';

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

    it('should override default route when adding resolver with specific route', () => {
      manager.add('method1', mockResolver1);
      manager.add('method1', mockResolver2, '/custom-route');

      const defaultResolver = manager.get('method1');
      expect(defaultResolver).toBe(mockResolver2);
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

    it('should return default resolver when no route is specified', () => {
      manager.add('method1', mockResolver1);
      const resolver = manager.get('method1');
      expect(resolver).toBe(mockResolver1);
    });

    it('should return specific route resolver when route is specified', () => {
      manager.add('method1', mockResolver1, '/custom-route');
      const resolver = manager.get('method1', '/custom-route');
      expect(resolver).toBe(mockResolver1);
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
  });
});
