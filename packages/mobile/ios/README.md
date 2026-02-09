# Double-Bind iOS Core

iOS implementation of the GraphDB interface for Double-Bind, wrapping CozoDB via CozoSwiftBridge.

## Requirements

- iOS 15.0+
- macOS 12.0+ (for development)
- Xcode 15.0+
- Swift 5.9+
- CocoaPods (for CozoSwiftBridge dependency)

## Installation

### CocoaPods

1. Install CocoaPods dependencies:

```bash
cd packages/mobile/ios
pod install
```

2. Open the generated `.xcworkspace` file in Xcode.

### Swift Package Manager

The package is set up for SPM but requires CozoSwiftBridge which is currently only available via CocoaPods. Use the Podfile approach for now.

## Usage

### Basic Setup

```swift
import DoubleBindCore

// Initialize with SQLite storage (recommended for mobile)
let documentsPath = FileManager.default
    .urls(for: .documentDirectory, in: .userDomainMask)
    .first!
    .appendingPathComponent("double-bind.db")
    .path

let db = try CozoGraphDB(engine: "sqlite", path: documentsPath)

// Or use the config struct
let config = GraphDBConfig(engine: .sqlite, path: documentsPath)
let db = try CozoGraphDB(config: config)

// For testing, use in-memory database
let testDb = try CozoGraphDB()
```

### Querying

```swift
// Simple query
let result: QueryResult<Any> = try await db.query("?[] <- [[1, 2, 3]]")
print(result.headers)  // Column names
print(result.rows)     // Data rows

// Query with parameters
let params: [String: Any] = ["page_id": "abc123"]
let result: QueryResult<Any> = try await db.query(
    "?[title, content] := *pages{ page_id: $page_id, title, content }",
    params: params
)
```

### Mutations

```swift
// Insert data
let result = try await db.mutate("""
    ?[page_id, title, content] <- [[$id, $title, $content]]
    :put pages { page_id, title, content }
    """,
    params: [
        "id": UUID().uuidString,
        "title": "My Page",
        "content": "Hello, world!"
    ]
)
```

### Backup and Restore

```swift
// Create backup
let backupPath = documentsPath + ".backup"
try await db.backup(to: backupPath)

// Restore from backup (database must be empty)
try await db.restore(from: backupPath)

// Import specific relations from backup
try await db.importRelationsFromBackup(path: backupPath, relations: ["pages", "blocks"])
```

### Data Import/Export

```swift
// Export relations
let data = try await db.exportRelations(["pages", "blocks"])

// Import relations (triggers NOT executed)
try await db.importRelations(data)
```

### App Lifecycle Integration

```swift
class AppDelegate: UIApplicationDelegate {
    var db: CozoGraphDB?

    func applicationDidEnterBackground(_ application: UIApplication) {
        Task {
            try? await db?.suspend()
        }
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        Task {
            try? await db?.resume()
        }
    }

    func applicationDidReceiveMemoryWarning(_ application: UIApplication) {
        Task {
            try? await db?.onLowMemory()
        }
    }

    func applicationWillTerminate(_ application: UIApplication) {
        Task {
            try? await db?.close()
        }
    }
}
```

### Error Handling

```swift
do {
    let result = try await db.query("invalid query")
} catch let error as GraphDBError {
    switch error {
    case .queryFailed(let script, let underlying):
        print("Query failed: \(script)")
        print("Reason: \(underlying)")
    case .databaseClosed:
        print("Database has been closed")
    default:
        print("Error: \(error.localizedDescription)")
    }
}
```

## Thread Safety

`CozoGraphDB` is fully thread-safe:

- All operations use a serial dispatch queue for database access
- The class conforms to `Sendable` for safe use with Swift Concurrency
- Results are immutable after return

## Architecture

```
DoubleBindCore/
├── Sources/
│   ├── GraphDB.swift         # Protocol matching TypeScript interface
│   ├── GraphDBTypes.swift    # Result types (QueryResult, MutationResult)
│   ├── GraphDBError.swift    # Error types
│   └── CozoGraphDB.swift     # Implementation wrapping CozoSwiftBridge
├── Package.swift             # Swift Package Manager manifest
└── README.md                 # This file
```

## Related Documentation

- [GraphDB TypeScript Interface](/packages/types/src/graph-db.ts)
- [Mobile Database Strategy](/docs/architecture/mobile-database-strategy.md)
- [CozoDB Documentation](https://docs.cozodb.org/)
- [CozoSwiftBridge](https://github.com/cozodb/cozo/tree/main/cozo-lib-swift)
