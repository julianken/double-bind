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

// Package mappings to dist directories (compiled JS)
// These packages must be built with `pnpm build` before running Metro
const workspacePackages = {
  "@double-bind/core": path.resolve(monorepoRoot, "packages/core/dist"),
  "@double-bind/migrations": path.resolve(monorepoRoot, "packages/migrations/dist/src"),
  "@double-bind/mobile": path.resolve(monorepoRoot, "packages/mobile/dist"),
  "@double-bind/mobile-primitives": path.resolve(monorepoRoot, "packages/mobile-primitives/dist"),
  "@double-bind/types": path.resolve(monorepoRoot, "packages/types/dist"),
};

// Shims for Node.js modules that don't exist in React Native
const shimPackages = {
  // ULID uses crypto.randomBytes which doesn't exist in React Native
  // Our shim uses Math.random() instead
  "ulid": path.resolve(__dirname, "shims/ulid.js"),
};

// Local vendor copy of react-native-external-keyboard (pnpm symlinks cause Metro/watchman issues)
const externalKeyboardPath = path.resolve(__dirname, "vendor/react-native-external-keyboard");

// Force React and React Native to resolve to mobile-app's node_modules
// This prevents duplicate React instances in monorepo packages which causes
// "Objects are not valid as a React child" errors
const coreModules = {
  "react": path.resolve(__dirname, "node_modules/react"),
  "react-native": path.resolve(__dirname, "node_modules/react-native"),
  "react-native-external-keyboard": path.resolve(__dirname, "node_modules/react-native-external-keyboard"),
};

const config = {
  // Watch the entire monorepo for changes
  // Include the .pnpm store explicitly for packages that need it (symlinks not followed)
  watchFolders: [monorepoRoot, externalKeyboardPath],

  resolver: {
    // Allow Metro to resolve modules from these locations
    nodeModulesPaths: [
      path.resolve(__dirname, "node_modules"),
      path.resolve(monorepoRoot, "node_modules"),
    ],

    extraNodeModules: {
      ...workspacePackages,
      ...coreModules,
    },

    // Custom resolver to force @double-bind packages to use dist directories
    // and redirect Node.js modules to React Native shims
    resolveRequest: (context, moduleName, platform) => {
      // Check if this is a shimmed package (e.g., ulid -> shims/ulid.js)
      if (shimPackages[moduleName]) {
        return {
          filePath: shimPackages[moduleName],
          type: "sourceFile",
        };
      }

      // Handle react-native-external-keyboard explicitly (pnpm symlink issue)
      // Use the local vendor copy with commonjs to avoid codegen issues
      if (moduleName === "react-native-external-keyboard") {
        return {
          filePath: path.resolve(externalKeyboardPath, "lib/commonjs/index.js"),
          type: "sourceFile",
        };
      }
      if (moduleName.startsWith("react-native-external-keyboard/")) {
        const subpath = moduleName.slice("react-native-external-keyboard/".length);
        return {
          filePath: path.resolve(externalKeyboardPath, "lib/commonjs", subpath + ".js"),
          type: "sourceFile",
        };
      }

      // Check if this is a @double-bind package import
      for (const [pkgName, distPath] of Object.entries(workspacePackages)) {
        if (moduleName === pkgName) {
          // Resolve to the dist/index.js
          return {
            filePath: path.resolve(distPath, "index.js"),
            type: "sourceFile",
          };
        }
        // Handle subpath imports like @double-bind/core/something
        if (moduleName.startsWith(pkgName + "/")) {
          const subpath = moduleName.slice(pkgName.length + 1);
          return {
            filePath: path.resolve(distPath, subpath + ".js"),
            type: "sourceFile",
          };
        }
      }
      // Fall back to default resolution
      return context.resolveRequest(context, moduleName, platform);
    },

    // Block list for directories that should not be watched
    blockList: [
      // Ignore other platform builds (Layer 4 packages)
      /packages\/(desktop|cli|tui)\/.*/,
      // Ignore test directories in workspace packages
      /packages\/.*\/test\/.*/,
      /packages\/.*\/__tests__\/.*/,
      // Ignore source directories in workspace packages (use dist instead)
      /packages\/(core|types|mobile|mobile-primitives|migrations)\/src\/.*/,
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
