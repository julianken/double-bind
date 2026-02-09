# DoubleBindCore

iOS native database layer for Double-Bind, providing CozoDB integration via CozoSwiftBridge.

## Overview

DoubleBindCore implements the `GraphDB` protocol that mirrors the TypeScript interface defined in `packages/types/src/graph-db.ts`. This ensures consistent database operations across all Double-Bind platforms (desktop, iOS, Android).

## Requirements

- iOS 15.0+ / macOS 12.0+
- Swift 5.9+
- Xcode 15.0+

## Installation

### CocoaPods

Add to your `Podfile`:

```ruby
pod 'DoubleBindCore', :path => '../packages/mobile/ios/DoubleBindCore'
```

The CozoSwiftBridge dependency will be automatically installed.

### Swift Package Manager

The package can be added via SPM, but you must also install CozoSwiftBridge via CocoaPods in your main app target since CozoSwiftBridge is not available as an SPM package.

## Usage

```swift
import DoubleBindCore

// Create database configuration
let documentsPath = FileManager.default
    .urls(for: .documentDirectory, in: .userDomainMask)
    .first!
    .appendingPathComponent("double-bind.db")
    .path

let config = GraphDBConfig(engine: .sqlite, path: documentsPath)

// Initialize database (implementation provided by CozoGraphDB)
let db: GraphDB = try CozoGraphDB(config: config)

// Execute queries
let result: QueryResult<String> = try await db.query(
    "?[name] := *pages{ page_id, name }",
    params: nil
)

// Don't forget to close when done
try await db.close()
```

## Architecture

```
DoubleBindCore
├── GraphDB.swift        # Protocol matching TypeScript interface
├── CozoGraphDB.swift    # CozoSwiftBridge implementation (DBB-368)
└── ...
```

## Related Issues

- DBB-367: Set up Swift Package with CozoSwiftBridge dependency
- DBB-368: Implement CozoGraphDB class
- DBB-369: React Native bridge layer
- DBB-370: Unit tests for iOS database layer

## License

MIT
