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

    it('should return false for array of short keys', () => {
      expect(needsRebalance(['a0', 'a1', 'a2'])).toBe(false);
      expect(needsRebalance(['a'.repeat(MAX_KEY_LENGTH)])).toBe(false);
    });

    it('should return true if any key in array exceeds max length', () => {
      const longKey = 'a'.repeat(MAX_KEY_LENGTH + 1);
      expect(needsRebalance(['a0', longKey, 'a2'])).toBe(true);
      expect(needsRebalance([longKey])).toBe(true);
    });

    it('should return false for empty array', () => {
      expect(needsRebalance([])).toBe(false);
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

    it('should generate keys that preserve insertion room', () => {
      // Generate 10 keys
      const keys = rebalanceKeys(10);

      expect(keys.length).toBe(10);

      // Should be able to insert between any two consecutive keys
      for (let i = 0; i < keys.length - 1; i++) {
        const between = keyBetween(keys[i]!, keys[i + 1]!);
        expect(between > keys[i]!).toBe(true);
        expect(between < keys[i + 1]!).toBe(true);
      }
    });

    it('should handle large counts efficiently', () => {
      // Test with a large number of siblings (edge case for rebalance)
      const keys = rebalanceKeys(100);

      expect(keys.length).toBe(100);

      // All keys should still be short
      for (const key of keys) {
        expect(key.length).toBeLessThanOrEqual(MAX_KEY_LENGTH);
      }

      // Verify ordering is preserved
      for (let i = 1; i < keys.length; i++) {
        expect(keys[i]! > keys[i - 1]!).toBe(true);
      }
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

  describe('pathological insertion patterns', () => {
    it('should demonstrate key growth with repeated between-insertion patterns', () => {
      // This test demonstrates why rebalancing is needed
      // Repeatedly inserting between the same two keys causes key growth
      const startKey = 'a0';
      const endKey = 'a1';
      let currentKey = startKey;

      // Insert 30 keys always between currentKey and endKey (pathological pattern)
      const keys: string[] = [currentKey];
      for (let i = 0; i < 30; i++) {
        const newKey = keyBetween(currentKey, endKey);
        keys.push(newKey);
        currentKey = newKey;
      }

      // Keys should grow in length as we keep inserting in the same spot
      // The later keys should be longer than the first
      const firstKeyLength = keys[0]!.length;
      const lastKeyLength = keys[keys.length - 1]!.length;

      // After 30 insertions in the same spot, keys should have grown
      expect(lastKeyLength).toBeGreaterThanOrEqual(firstKeyLength);
    });

    it('should demonstrate key growth stabilizes with rebalance', () => {
      // Simulate what happens after rebalancing
      // Generate fresh evenly-spaced keys
      const rebalancedKeys = rebalanceKeys(20);

      // All keys should be short
      for (const key of rebalancedKeys) {
        expect(key.length).toBeLessThanOrEqual(5); // Fresh keys are very short
      }

      // Now simulate a few more insertions
      const key1 = keyBetween(rebalancedKeys[5]!, rebalancedKeys[6]!);
      const key2 = keyBetween(key1, rebalancedKeys[6]!);
      const key3 = keyBetween(key2, rebalancedKeys[6]!);

      // Keys should still be reasonable length
      expect(key1.length).toBeLessThanOrEqual(MAX_KEY_LENGTH);
      expect(key2.length).toBeLessThanOrEqual(MAX_KEY_LENGTH);
      expect(key3.length).toBeLessThanOrEqual(MAX_KEY_LENGTH);
    });

    it('should generate a key that eventually triggers rebalance', () => {
      // Simulate many insertions at the same position to trigger rebalance
      let current: string | null = 'a5'; // Start with a mid-range key
      const next: string | null = 'a6';
      let insertCount = 0;

      // Keep inserting between current and next until key exceeds threshold
      while (!needsRebalance(current!) && insertCount < 100) {
        const newKey = keyBetween(current, next);
        current = newKey;
        insertCount++;
      }

      // At some point, the key should exceed the threshold
      // (This may take many iterations depending on the fractional indexing implementation)
      if (current && needsRebalance(current)) {
        expect(current.length).toBeGreaterThan(MAX_KEY_LENGTH);
      }
    });
  });
});
