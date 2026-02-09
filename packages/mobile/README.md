# @double-bind/mobile

Mobile platform implementations for Double-Bind, providing native database access on iOS and Android.

## Overview

This package contains the native implementations of the `GraphDB` interface for mobile platforms:

- **Android**: Kotlin implementation using `cozo_android`
- **iOS**: Swift implementation using `CozoSwiftBridge`

Both implementations use SQLite as the storage backend, which is optimal for mobile devices.

## Structure

```
packages/mobile/
├── android/
│   ├── core/                    # Core Kotlin library
│   │   ├── src/main/kotlin/     # Implementation
│   │   └── src/test/kotlin/     # Unit tests
│   ├── build.gradle.kts         # Root build config
│   └── settings.gradle.kts      # Project settings
└── ios/
    └── (Coming soon)
```

## Android Module

### Requirements

- Android SDK 24+ (Android 7.0)
- Kotlin 1.9+
- Gradle 8.4+

### Building

```bash
cd packages/mobile/android
./gradlew build
```

### Running Tests

```bash
# Run all tests
./gradlew test

# Run specific test class
./gradlew test --tests "com.doublebind.core.CozoGraphDBQueryTest"

# Run with verbose output
./gradlew test --info
```

### Usage

```kotlin
import com.doublebind.core.CozoGraphDB

// Create database (in-memory for testing)
val db = CozoGraphDB("mem", "")

// Create database (SQLite for production)
val dbPath = context.filesDir.resolve("double-bind.db").absolutePath
val db = CozoGraphDB("sqlite", dbPath)

// Execute queries
val result = db.query<Any>("?[id, name] := *users{ id, name }")
println(result.headers) // ["id", "name"]
println(result.rows)    // [[1, "Alice"], [2, "Bob"]]

// Execute mutations
db.mutate(":create users { id: Int => name: String }")
db.mutate("?[id, name] <- [[1, \"Alice\"]] :put users { id => name }")

// Always close when done
db.close()
```

### Lifecycle Integration

```kotlin
class DatabaseManager(context: Context) : Closeable {
    private val db: CozoGraphDB

    init {
        val dbPath = context.filesDir.resolve("double-bind.db").absolutePath
        db = CozoGraphDB("sqlite", dbPath)
    }

    // Call from Activity.onPause() or onStop()
    suspend fun onBackground() = db.suspend()

    // Call from Activity.onResume()
    suspend fun onForeground() = db.resume()

    // Call from Application.onTrimMemory()
    suspend fun onMemoryPressure() = db.onLowMemory()

    override fun close() = db.close()
}
```

## GraphDB Interface

The `GraphDB` interface provides:

| Method | Description |
|--------|-------------|
| `query<T>()` | Execute read-only Datalog queries |
| `mutate()` | Execute mutations (insert/update/delete) |
| `importRelations()` | Bulk import data |
| `exportRelations()` | Export relation data |
| `backup()` | Create database backup |
| `restore()` | Restore from backup |
| `importRelationsFromBackup()` | Selective restore |
| `suspend()` | Prepare for background |
| `resume()` | Resume from background |
| `onLowMemory()` | Handle memory pressure |
| `close()` | Release resources |

## Testing

Tests are written with JUnit 5 and kotlinx-coroutines-test. All tests use in-memory databases for speed.

Test coverage includes:
- **Query operations**: Basic queries, parameters, data types, joins
- **Mutation operations**: Create, insert, update, delete
- **Data transfer**: Import/export, round-trip integrity
- **Persistence**: Backup, restore, cross-engine compatibility
- **Lifecycle**: Close, suspend, resume, onLowMemory
- **Error handling**: Syntax errors, type mismatches, constraint violations

## Dependencies

```kotlin
dependencies {
    implementation("io.github.cozodb:cozo_android:0.7.6")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.7.3")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.0")
}
```

## See Also

- [Mobile Database Strategy](../../docs/architecture/mobile-database-strategy.md)
- [GraphDB Interface](../types/src/graph-db.ts)
- [CozoDB Documentation](https://github.com/cozodb/cozo)
