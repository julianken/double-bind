/**
 * Ordering utilities unit tests.
 *
 * Tests fractional indexing operations for block ordering.
 */

import { describe, it, expect } from 'vitest';
import {
  keyBetween,
  keysBetween,
  needsRebalance,
  rebalanceKeys,
  keyForInsertAfter,
  MAX_KEY_LENGTH,
  DEFAULT_ORDER,
} from '../../../src/utils/ordering.js';

describe('ordering utilities', () => {
  describe('keyBetween', () => {
    it('should generate first key when both bounds are null', () => {
      const key = keyBetween(null, null);
      expect(key).toBeDefined();
      expect(typeof key).toBe('string');
      expect(key.length).toBeGreaterThan(0);
    });

    it('should generate key after a given key', () => {
      const first = keyBetween(null, null);
      const second = keyBetween(first, null);

      expect(second > first).toBe(true);
    });

    it('should generate key before a given key', () => {
      const first = keyBetween(null, null);
      const before = keyBetween(null, first);

      expect(before < first).toBe(true);
    });

    it('should generate key between two keys', () => {
      const first = 'a0';
      const third = 'a2';
      const second = keyBetween(first, third);

      expect(second > first).toBe(true);
      expect(second < third).toBe(true);
    });

    it('should maintain sort order for many insertions', () => {
      const keys: string[] = [];
      let current: string | null = null;

      // Generate 10 sequential keys
      for (let i = 0; i < 10; i++) {
        const newKey = keyBetween(current, null);
        keys.push(newKey);
        current = newKey;
      }

      // Verify all keys are in ascending order
      for (let i = 1; i < keys.length; i++) {
        expect(keys[i]! > keys[i - 1]!).toBe(true);
      }
    });
  });

  describe('keysBetween', () => {
    it('should generate multiple keys in order', () => {
      const keys = keysBetween(null, null, 5);

      expect(keys.length).toBe(5);

      // Verify all keys are in ascending order
      for (let i = 1; i < keys.length; i++) {
        expect(keys[i]! > keys[i - 1]!).toBe(true);
      }
    });

    it('should generate keys between two bounds', () => {
      const before = 'a0';
      const after = 'a9';
      const keys = keysBetween(before, after, 3);

      expect(keys.length).toBe(3);

      // All keys should be between bounds
      for (const key of keys) {
        expect(key > before).toBe(true);
        expect(key < after).toBe(true);
      }

      // Keys should be in ascending order
      for (let i = 1; i < keys.length; i++) {
        expect(keys[i]! > keys[i - 1]!).toBe(true);
      }
    });

    it('should return empty array for count 0', () => {
      const keys = keysBetween(null, null, 0);
      expect(keys).toEqual([]);
    });
  });

  describe('needsRebalance', () => {
    it('should return false for short keys', () => {
      expect(needsRebalance('a0')).toBe(false);
      expect(needsRebalance('a0V')).toBe(false);
      expect(needsRebalance('a'.repeat(MAX_KEY_LENGTH))).toBe(false);
    });

    it('should return true for keys exceeding max length', () => {
      const longKey = 'a'.repeat(MAX_KEY_LENGTH + 1);
      expect(needsRebalance(longKey)).toBe(true);
    });
  });

  describe('rebalanceKeys', () => {
    it('should generate evenly spaced keys', () => {
      const keys = rebalanceKeys(5);

      expect(keys.length).toBe(5);

      // Verify all keys are in ascending order
      for (let i = 1; i < keys.length; i++) {
        expect(keys[i]! > keys[i - 1]!).toBe(true);
      }

      // All keys should be reasonably short
      for (const key of keys) {
        expect(key.length).toBeLessThanOrEqual(MAX_KEY_LENGTH);
      }
    });

    it('should return empty array for count 0', () => {
      const keys = rebalanceKeys(0);
      expect(keys).toEqual([]);
    });

    it('should return empty array for negative count', () => {
      const keys = rebalanceKeys(-1);
      expect(keys).toEqual([]);
    });
  });

  describe('keyForInsertAfter', () => {
    it('should return default order for empty siblings', () => {
      const key = keyForInsertAfter([], -1);
      expect(key).toBe(DEFAULT_ORDER);
    });

    it('should insert before first sibling when afterIndex is -1', () => {
      const siblings = [{ order: 'a5' }, { order: 'a9' }];
      const key = keyForInsertAfter(siblings, -1);

      expect(key < 'a5').toBe(true);
    });

    it('should insert after last sibling when afterIndex is at end', () => {
      const siblings = [{ order: 'a0' }, { order: 'a5' }];
      const key = keyForInsertAfter(siblings, 1);

      expect(key > 'a5').toBe(true);
    });

    it('should insert between two siblings', () => {
      const siblings = [{ order: 'a0' }, { order: 'a5' }, { order: 'a9' }];
      const key = keyForInsertAfter(siblings, 0);

      expect(key > 'a0').toBe(true);
      expect(key < 'a5').toBe(true);
    });

    it('should handle single sibling - insert before', () => {
      const siblings = [{ order: 'a5' }];
      const key = keyForInsertAfter(siblings, -1);

      expect(key < 'a5').toBe(true);
    });

    it('should handle single sibling - insert after', () => {
      const siblings = [{ order: 'a5' }];
      const key = keyForInsertAfter(siblings, 0);

      expect(key > 'a5').toBe(true);
    });
  });

  describe('DEFAULT_ORDER constant', () => {
    it('should be a valid string', () => {
      expect(typeof DEFAULT_ORDER).toBe('string');
      expect(DEFAULT_ORDER.length).toBeGreaterThan(0);
    });
  });

  describe('MAX_KEY_LENGTH constant', () => {
    it('should be a reasonable value', () => {
      expect(MAX_KEY_LENGTH).toBe(50);
    });
  });
});
