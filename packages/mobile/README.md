# @double-bind/mobile

Mobile platform implementation for Double-Bind using SQLite and op-sqlite.

## Overview

This package provides the `Database` interface implementation for React Native mobile applications (iOS and Android). It uses [op-sqlite](https://github.com/OP-Engineering/op-sqlite) for high-performance SQLite access via JSI (JavaScript Interface).

## Migration from CozoDB

This package was migrated from CozoDB to SQLite as part of the broader database migration (DBB-437). The mobile implementation now uses:

- **op-sqlite** for direct SQLite access via JSI
- **Simplified native modules** that only provide database path utilities
- **SQL queries** instead of Datalog

## Installation

```bash
pnpm add @double-bind/mobile
```

### iOS Setup

```bash
cd ios
pod install
```

### Android Setup

Gradle will automatically sync the dependencies. Ensure you're using:

- Android SDK 24+
- Kotlin 1.9+
- Java 17

## Usage

```typescript
import { MobileDatabaseProvider } from '@double-bind/mobile';

// Create a database instance (uses default platform path)
const db = await MobileDatabaseProvider.create();

// Or specify a custom path
const dbCustom = await MobileDatabaseProvider.create('/custom/path/to/db.sqlite');

// Execute queries
const result = await db.query('SELECT * FROM pages WHERE id = $id', { id: '123' });

// Execute mutations
await db.mutate('INSERT INTO pages (id, title) VALUES ($id, $title)', {
  id: '456',
  title: 'New Page',
});

// Use transactions
await db.transaction(async (tx) => {
  await tx.execute('INSERT INTO pages (id, title) VALUES ($id, $title)', {
    id: '789',
    title: 'Page in Transaction',
  });
  const pages = await tx.query('SELECT * FROM pages');
  return pages;
});

// Close the database when done
await db.close();
```

## Database Lifecycle (Mobile-Specific)

The mobile database provider implements lifecycle methods for proper mobile app behavior:

```typescript
// App goes to background
await db.suspend(); // Flushes pending writes (WAL checkpoint)

// App returns to foreground
await db.resume(); // Validates database state

// System signals memory pressure
await db.onLowMemory(); // Shrinks memory usage
```

These should be called from your React Native app's lifecycle events.

## Native Modules

### DatabaseModule (iOS/Android)

Provides utility methods for database path management:

```typescript
import { getDatabaseModule } from '@double-bind/mobile';

const nativeModule = getDatabaseModule();

// Get the default database path for the platform
const path = await nativeModule.getDatabasePath();

// Ensure the database directory exists
await nativeModule.ensureDatabaseDirectory(path);
```

## Architecture

```
┌─────────────────────────────────────────┐
│ MobileDatabaseProvider (TypeScript)     │
│ - Implements Database interface         │
│ - Converts named params ($name) to (?)  │
│ - Converts result format                │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│ op-sqlite (JSI Bridge)                  │
│ - Direct SQLite access via JSI          │
│ - No React Native bridge overhead       │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│ SQLite (Native)                         │
│ - iOS: Uses system SQLite               │
│ - Android: Bundled SQLite 3.x           │
└─────────────────────────────────────────┘
```

## Named Parameters

The Database interface uses named parameters (`$name`), but op-sqlite uses positional parameters (`?`). The MobileDatabaseProvider automatically converts:

```typescript
// You write:
await db.query('SELECT * FROM pages WHERE id = $id AND status = $status', {
  id: '123',
  status: 'published',
});

// Converted to:
// SQL: SELECT * FROM pages WHERE id = ? AND status = ?
// Params: ['123', 'published']
```

## Performance

op-sqlite provides excellent performance through JSI:

- **No bridge serialization** — Direct memory access from JavaScript to native
- **Synchronous API available** — `executeSync()` for blocking operations
- **WAL mode enabled** — Better concurrency and crash recovery
- **Prepared statements** — For repeated queries (not yet exposed in Database interface)

## Limitations

Some Database interface methods are not yet implemented for mobile:

- `backup(path)` — File system copy operations should be used instead
- `restore(path)` — Create a new database from the backup file instead
- `importRelationsFromBackup(path, relations)` — Not supported

## Differences from Desktop

| Feature         | Desktop (better-sqlite3)      | Mobile (op-sqlite)          |
| --------------- | ----------------------------- | --------------------------- |
| API             | Synchronous                   | Async (with sync variant)   |
| Parameter style | Named (`$name`) or positional | Positional (`?`) only       |
| Result format   | Objects                       | Objects                     |
| Transaction API | Manual BEGIN/COMMIT           | Native transaction() method |
| Performance     | Fast (V8)                     | Very fast (JSI)             |

## Testing

```bash
# Type checking
pnpm typecheck

# Build
pnpm build

# Android unit tests (Kotlin) - DEPRECATED (CozoDB tests)
# pnpm test:android

# Build Android library
pnpm build:android
```

## Troubleshooting

### "op-sqlite native module is not available"

Ensure you've run `pod install` on iOS or synced Gradle on Android. The op-sqlite library requires native setup.

### "Database has been closed"

You're trying to use the database after calling `close()`. Create a new instance.

### Transaction returns undefined

The transaction function must return a value. If you don't need a result, return `null`:

```typescript
await db.transaction(async (tx) => {
  await tx.execute('INSERT ...');
  return null; // ✓ Returns a value
});
```

## License

MIT
