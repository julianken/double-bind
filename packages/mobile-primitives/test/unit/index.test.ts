/**
 * Basic tests for @double-bind/mobile-primitives package.
 *
 * These tests verify the package structure and exports are working correctly.
 */

import { describe, it, expect } from 'vitest';
import { MOBILE_PRIMITIVES_VERSION } from '../../src/index';

describe('@double-bind/mobile-primitives', () => {
  describe('Package exports', () => {
    it('exports MOBILE_PRIMITIVES_VERSION', () => {
      expect(MOBILE_PRIMITIVES_VERSION).toBeDefined();
      expect(typeof MOBILE_PRIMITIVES_VERSION).toBe('string');
    });

    it('has correct version format', () => {
      expect(MOBILE_PRIMITIVES_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });
});
