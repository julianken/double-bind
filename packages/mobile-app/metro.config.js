const { getDefaultConfig, mergeConfig } = require("@react-native/metro-config");
const path = require("path");

// Monorepo root (two levels up from packages/mobile-app)
const monorepoRoot = path.resolve(__dirname, "../..");

/**
 * Metro configuration for monorepo package resolution
 * https://metrobundler.dev/docs/configuration
 *
 * This configuration enables Metro to:
 * 1. Watch workspace packages for changes
 * 2. Resolve @double-bind/* packages from the monorepo
 * 3. Handle hoisted dependencies in pnpm workspace
 */

const config = {
  // Watch the entire monorepo for changes
  watchFolders: [monorepoRoot],

  resolver: {
    // Allow Metro to resolve modules from these locations
    nodeModulesPaths: [
      path.resolve(__dirname, "node_modules"),
      path.resolve(monorepoRoot, "node_modules"),
    ],

    // Map workspace packages to their source directories
    // This allows importing directly from TypeScript source
    extraNodeModules: {
      "@double-bind/core": path.resolve(monorepoRoot, "packages/core"),
      "@double-bind/types": path.resolve(monorepoRoot, "packages/types"),
      "@double-bind/mobile": path.resolve(monorepoRoot, "packages/mobile"),
    },

    // Block list for directories that should not be watched
    blockList: [
      // Ignore other platform builds (Layer 4 packages)
      /packages\/(desktop|cli|tui)\/.*/,
      // Ignore test directories in workspace packages
      /packages\/.*\/test\/.*/,
      /packages\/.*\/__tests__\/.*/,
      // Ignore dist directories (use source directly)
      /packages\/.*\/dist\/.*/,
    ],
  },

  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
