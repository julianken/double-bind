# @double-bind/mobile-app

React Native mobile application for Double-Bind.

## Monorepo Configuration

This package is configured to work within the pnpm monorepo. Metro bundler is set up to resolve workspace packages correctly.

### How It Works

The `metro.config.js` configures:

1. **watchFolders**: Watches the entire monorepo root for file changes
2. **nodeModulesPaths**: Resolves dependencies from both local and root node_modules
3. **extraNodeModules**: Maps `@double-bind/*` packages to their source directories

### Workspace Dependencies

- `@double-bind/types` - Shared TypeScript interfaces and domain types
- `@double-bind/core` - Business logic (repositories, services)

### Development

```bash
# Install dependencies (from monorepo root)
pnpm install

# Start Metro bundler
pnpm --filter @double-bind/mobile-app start

# Run on Android
pnpm --filter @double-bind/mobile-app android

# Run on iOS
pnpm --filter @double-bind/mobile-app ios

# Type check
pnpm --filter @double-bind/mobile-app typecheck
```

### Troubleshooting

If Metro cannot resolve workspace packages:

1. Ensure dependencies are installed at the monorepo root
2. Clear Metro cache: `npx react-native start --reset-cache`
3. Verify `metro.config.js` paths are correct
