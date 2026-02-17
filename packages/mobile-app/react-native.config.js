/**
 * React Native CLI configuration for monorepo
 *
 * Excludes workspace packages that have their own native module structure
 * and aren't meant to be autolinked as React Native libraries.
 */
module.exports = {
  project: {
    ios: {
      sourceDir: './ios',
    },
    android: {
      sourceDir: './android',
    },
  },

  // Exclude workspace packages from autolinking
  dependencies: {
    // @double-bind/mobile has its own native structure and isn't a RN library
    '@double-bind/mobile': {
      platforms: {
        ios: null,
        android: null,
      },
    },
    // @double-bind/core is TypeScript-only, no native code
    '@double-bind/core': {
      platforms: {
        ios: null,
        android: null,
      },
    },
    // @double-bind/types is TypeScript-only, no native code
    '@double-bind/types': {
      platforms: {
        ios: null,
        android: null,
      },
    },
    // @double-bind/mobile-primitives is TypeScript-only, no native code
    '@double-bind/mobile-primitives': {
      platforms: {
        ios: null,
        android: null,
      },
    },
  },
};
