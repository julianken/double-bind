/**
 * Type utilities for Double-Bind
 */

/**
 * Makes all properties of T optional recursively.
 * Useful for partial updates and test fixtures.
 */
export type DeepPartial<T> = T extends object
  ? { [P in keyof T]?: DeepPartial<T[P]> }
  : T;
