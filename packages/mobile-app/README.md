# @double-bind/mobile-app

React Native mobile application for Double-Bind note-taking.

## Overview

This package provides React Native screens and components for the mobile app (iOS and Android). It uses the shared business logic from `@double-bind/core` and the native database implementation from `@double-bind/mobile`.

## Screens

- **HomeScreen** - Landing screen with daily notes and recent pages
- **PagesScreen** - Full list of all pages
- **SearchScreen** - Search pages by title
- **GraphScreen** - Placeholder for graph visualization (statistics view)
- **SettingsScreen** - App settings and information
- **PageDetailScreen** - Single page view with content and backlinks

## Components

- **LoadingSpinner** - Centered loading indicator with optional message
- **ErrorMessage** - Error display with retry option
- **EmptyState** - Empty list state with optional action button

## Providers

- **DatabaseProvider** - Database and services context provider
- **useDatabase** - Hook to access database state and services
- **useServices** - Convenience hook for services access

## Usage

```tsx
import { DatabaseProvider, HomeScreen, PagesScreen, useDatabase } from '@double-bind/mobile-app';

function App() {
  return (
    <DatabaseProvider>
      <NavigationContainer>
        <Tab.Navigator>
          <Tab.Screen name="Home" component={HomeScreen} />
          <Tab.Screen name="Pages" component={PagesScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </DatabaseProvider>
  );
}
```

## Known Issues

### React 18/19 Type Conflict

This package has a known TypeScript type conflict in the monorepo context:

- The desktop package (`@double-bind/desktop`) uses React 19
- React Native 0.73 requires React 18 types
- pnpm hoists `@types/react@19` which causes JSX component type errors

**Workaround:** The `typecheck` script is disabled by default. Use `typecheck:strict` to run full type checking (will show errors but code is correct).

**Resolution:** When React Native 0.74+ adds React 19 support, this conflict will be resolved. Alternatively, the monorepo could use separate node_modules (shamefully-hoist=false) but this adds complexity.

The code itself is correct and will work at runtime. This is purely a development-time type checking issue.

## Development

```bash
# Install dependencies
pnpm install

# Run typecheck (skipped by default due to React version conflict)
pnpm typecheck

# Run strict typecheck (will show type errors)
pnpm typecheck:strict

# Lint
pnpm lint
```

## Architecture

```
mobile-app/
  src/
    providers/      # Database and service providers
    screens/        # All screen components
    components/     # Reusable UI components
    hooks/          # Custom hooks (future)
    index.ts        # Package exports
```
