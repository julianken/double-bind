/**
 * Ordering utilities for string-based fractional indexing.
 *
 * Uses the fractional-indexing library from Rocicorp for generating
 * sortable string keys that can be inserted between any two existing keys.
 *
 * Key rebalancing is triggered when keys exceed MAX_KEY_LENGTH characters
 * to prevent unbounded key growth from pathological insertion patterns.
 */

import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing';

/**
 * Maximum allowed key length before triggering rebalance.
 * Keys longer than this indicate pathological insertion patterns.
 */
export const MAX_KEY_LENGTH = 50;

/**
 * Default starting key for new sequences.
 */
export const DEFAULT_ORDER = 'a0';

/**
 * Generate a key between two existing keys.
 *
 * @param before - Key that should sort before the new key (null for first position)
 * @param after - Key that should sort after the new key (null for last position)
 * @returns A new key that sorts between before and after
 *
 * @example
 * ```typescript
 * keyBetween(null, null); // 'a0' - first key
 * keyBetween('a0', null); // 'a1' - after 'a0'
 * keyBetween(null, 'a0'); // 'Zz' - before 'a0'
 * keyBetween('a0', 'a1'); // 'a0V' - between 'a0' and 'a1'
 * ```
 */
export function keyBetween(before: string | null, after: string | null): string {
  return generateKeyBetween(before, after);
}

/**
 * Generate multiple keys between two existing keys.
 *
 * @param before - Key that should sort before all new keys (null for first position)
 * @param after - Key that should sort after all new keys (null for last position)
 * @param count - Number of keys to generate
 * @returns Array of new keys that sort between before and after, in order
 */
export function keysBetween(before: string | null, after: string | null, count: number): string[] {
  return generateNKeysBetween(before, after, count);
}

/**
 * Check if any key exceeds the maximum length and needs rebalancing.
 *
 * @param keys - A single key or array of keys to check
 * @returns true if any key is too long
 */
export function needsRebalance(keys: string | string[]): boolean {
  if (Array.isArray(keys)) {
    return keys.some((key) => key.length > MAX_KEY_LENGTH);
  }
  return keys.length > MAX_KEY_LENGTH;
}

/**
 * Rebalance a sequence of keys by generating evenly-spaced replacements.
 *
 * Called when any key in the sequence exceeds MAX_KEY_LENGTH.
 * The returned keys maintain the same relative ordering but use
 * optimal (short) key values.
 *
 * @param count - Number of keys to generate
 * @returns Array of evenly-spaced keys
 *
 * @example
 * ```typescript
 * rebalanceKeys(3); // ['a0', 'a1', 'a2']
 * ```
 */
export function rebalanceKeys(count: number): string[] {
  if (count <= 0) {
    return [];
  }
  return generateNKeysBetween(null, null, count);
}

/**
 * Calculate the key for inserting after a specific position in an ordered list.
 *
 * @param siblings - Array of existing siblings sorted by order
 * @param afterIndex - Index of the sibling to insert after (-1 for first position)
 * @returns The new key for the inserted element
 */
export function keyForInsertAfter(siblings: Array<{ order: string }>, afterIndex: number): string {
  if (siblings.length === 0) {
    return DEFAULT_ORDER;
  }

  // Insert at the beginning
  if (afterIndex < 0) {
    const firstSibling = siblings[0];
    if (!firstSibling) {
      return DEFAULT_ORDER;
    }
    return keyBetween(null, firstSibling.order);
  }

  // Insert at the end
  if (afterIndex >= siblings.length - 1) {
    const lastSibling = siblings[siblings.length - 1];
    if (!lastSibling) {
      return DEFAULT_ORDER;
    }
    return keyBetween(lastSibling.order, null);
  }

  // Insert in the middle
  const before = siblings[afterIndex];
  const after = siblings[afterIndex + 1];
  if (!before || !after) {
    return DEFAULT_ORDER;
  }
  return keyBetween(before.order, after.order);
}
