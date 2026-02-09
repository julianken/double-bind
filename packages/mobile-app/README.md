# @double-bind/mobile-app

React Native application shell for Double-Bind, providing database lifecycle management and React context providers.

## Features

- **DatabaseProvider** - React context provider for database access with automatic lifecycle management
- **useAppLifecycle** - Hook for managing app lifecycle events (background/foreground transitions)
- **useDatabase** - Hook for accessing database context
- **useDatabaseInstance** - Hook for direct database access (throws if not ready)

## Installation

```bash
pnpm add @double-bind/mobile-app
```

## Usage

### DatabaseProvider

Wrap your app with `DatabaseProvider` to enable database access:

```tsx
import { DatabaseProvider } from '@double-bind/mobile-app';
import * as FileSystem from 'expo-file-system';

function App() {
  const dbPath = `${FileSystem.documentDirectory}double-bind.db`;

  return (
    <DatabaseProvider
      databasePath={dbPath}
      onReady={(db) => initializeServices(db)}
      onError={(err) => showErrorToast(err.message)}
      onBackground={() => analytics.track('app_backgrounded')}
      onForeground={() => analytics.track('app_foregrounded')}
    >
      <MainNavigator />
    </DatabaseProvider>
  );
}
```

### useDatabase Hook

Access database state in child components:

```tsx
import { useDatabase } from '@double-bind/mobile-app';

function MyComponent() {
  const { db, isReady, isInitializing, error, isSuspended } = useDatabase();

  if (isInitializing) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;

  return <DataView db={db} />;
}
```

### useAppLifecycle Hook

For custom lifecycle handling without the full provider:

```tsx
import { useAppLifecycle } from '@double-bind/mobile-app';

function MyApp() {
  const db = /* your database instance */;

  useAppLifecycle(db, {
    onBackground: () => analytics.track('suspending'),
    onForeground: () => analytics.track('resuming'),
    onError: (err, op) => reportError(`${op} failed:`, err),
    debounceMs: 100, // Debounce rapid transitions
  });

  return <MainScreen />;
}
```

## Lifecycle Behavior

- **Background transition**: Calls `db.suspend()` to flush pending writes
- **Foreground transition**: Calls `db.resume()` to validate database state
- **Rapid transitions**: Debounced to prevent state corruption
- **Error handling**: Errors are reported via callbacks without crashing

## Testing

```bash
pnpm test        # Run unit tests
pnpm typecheck   # Type checking
```
