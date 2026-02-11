/**
 * React Native-compatible ULID generation.
 *
 * Uses the ulid package's built-in PRNG detection, which will use
 * crypto.getRandomValues in React Native environments (via react-native-get-random-values polyfill)
 * or fall back to Math.random() if unavailable.
 */

import { ulid as ulidGenerator } from 'ulid';

/**
 * Generate a ULID.
 * Safe to use in React Native environments.
 */
export const ulid = ulidGenerator;
