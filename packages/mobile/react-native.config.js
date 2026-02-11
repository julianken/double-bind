/**
 * React Native CLI configuration for @double-bind/mobile
 *
 * This package contains native implementations but is NOT a standard
 * React Native native module. It has its own native build process.
 *
 * Setting platforms to null disables autolinking for this package.
 */
module.exports = {
  dependency: {
    platforms: {
      ios: null,
      android: null,
    },
  },
};
