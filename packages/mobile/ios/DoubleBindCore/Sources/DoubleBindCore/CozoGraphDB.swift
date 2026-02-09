// CozoGraphDB.swift
// DoubleBindCore
//
// CozoDB implementation of the GraphDB protocol for iOS.
// Uses CozoSwiftBridge for native database operations.

import Foundation

/// CozoDB implementation of GraphDB for iOS.
///
/// This class wraps CozoSwiftBridge to provide a Swift-native interface
/// that matches the TypeScript GraphDB interface.
///
/// - Important: Call `close()` when done to release native resources.
///
/// Thread Safety:
/// - All methods are thread-safe and can be called from any thread.
/// - Results are returned on a background queue; dispatch to main thread for UI updates.
///
/// Example:
/// ```swift
/// let db = try CozoGraphDB(engine: .mem, path: "")
/// let result: QueryResult<Any> = try await db.query("?[x] := x = 1")
/// try await db.close()
/// ```
public final class CozoGraphDB: GraphDB, @unchecked Sendable {
    // MARK: - Properties

    /// The underlying CozoDB instance.
    /// Access is synchronized via the lock.
    private var db: CozoDB?

    /// Lock for thread-safe access to the database instance.
    private let lock = NSLock()

    /// Whether the database has been closed.
    private var isClosed = false

    /// Dispatch queue for database operations.
    private let queue = DispatchQueue(label: "com.doublebind.cozographdb", qos: .userInitiated)

    // MARK: - Initialization

    /// Initialize a new CozoGraphDB instance.
    ///
    /// - Parameters:
    ///   - engine: Storage engine to use (.mem, .sqlite)
    ///   - path: Path to the database file (ignored for .mem engine)
    /// - Throws: `GraphDBError.configurationError` if initialization fails
    public init(engine: GraphDBConfig.Engine, path: String) throws {
        let engineString: String
        switch engine {
        case .mem:
            engineString = "mem"
        case .sqlite:
            engineString = "sqlite"
        case .rocksdb:
            throw GraphDBError.configurationError("RocksDB is not supported on iOS")
        }

        do {
            self.db = try CozoDB(kind: engineString, path: path)
        } catch {
            throw GraphDBError.configurationError("Failed to initialize CozoDB: \(error.localizedDescription)")
        }
    }

    /// Convenience initializer using GraphDBConfig.
    public convenience init(config: GraphDBConfig) throws {
        try self.init(engine: config.engine, path: config.path)
    }

    // MARK: - Private Helpers

    /// Execute a block with the database, ensuring thread-safety.
    private func withDatabase<T>(_ block: (CozoDB) throws -> T) throws -> T {
        lock.lock()
        defer { lock.unlock() }

        guard let db = db, !isClosed else {
            throw GraphDBError.databaseClosed
        }

        return try block(db)
    }

    /// Execute an async operation on the database queue.
    private func asyncOperation<T>(_ operation: @escaping () throws -> T) async throws -> T {
        try await withCheckedThrowingContinuation { continuation in
            queue.async {
                do {
                    let result = try operation()
                    continuation.resume(returning: result)
                } catch {
                    continuation.resume(throwing: error)
                }
            }
        }
    }

    // MARK: - GraphDB Protocol

    public func query<T>(_ script: String, params: [String: Any]? = nil) async throws -> QueryResult<T> {
        try await asyncOperation {
            try self.withDatabase { db in
                let result: CozoQueryResult
                if let params = params {
                    let paramsData = try JSONSerialization.data(withJSONObject: params)
                    result = try db.run(script, params: paramsData)
                } else {
                    result = try db.run(script)
                }

                // Convert CozoQueryResult to QueryResult<T>
                let headers = result.headers
                let rows = result.rows.map { row in
                    row.map { value -> T in
                        // Type coercion - this is a simplification
                        // Real implementation would handle type conversion properly
                        value as! T
                    }
                }

                return QueryResult(headers: headers, rows: rows)
            }
        }
    }

    public func mutate(_ script: String, params: [String: Any]? = nil) async throws -> MutationResult {
        try await asyncOperation {
            try self.withDatabase { db in
                let result: CozoQueryResult
                if let params = params {
                    let paramsData = try JSONSerialization.data(withJSONObject: params)
                    result = try db.run(script, params: paramsData)
                } else {
                    result = try db.run(script)
                }

                return MutationResult(headers: result.headers, rows: result.rows)
            }
        }
    }

    public func importRelations(_ data: [String: [[Any]]]) async throws {
        try await asyncOperation {
            try self.withDatabase { db in
                let jsonData = try JSONSerialization.data(withJSONObject: data)
                try db.importRelations(data: jsonData)
            }
        }
    }

    public func exportRelations(_ relations: [String]) async throws -> [String: [[Any]]] {
        try await asyncOperation {
            try self.withDatabase { db in
                let result = try db.exportRelations(relations: relations)
                guard let dict = result as? [String: [[Any]]] else {
                    throw GraphDBError.exportError("Invalid export result format")
                }
                return dict
            }
        }
    }

    public func backup(to path: String) async throws {
        try await asyncOperation {
            try self.withDatabase { db in
                try db.backup(path: path)
            }
        }
    }

    public func restore(from path: String) async throws {
        try await asyncOperation {
            try self.withDatabase { db in
                try db.restore(path: path)
            }
        }
    }

    public func importRelationsFromBackup(path: String, relations: [String]) async throws {
        try await asyncOperation {
            try self.withDatabase { db in
                try db.importRelationsFromBackup(path: path, relations: relations)
            }
        }
    }

    public func close() async throws {
        try await asyncOperation {
            self.lock.lock()
            defer { self.lock.unlock() }

            guard !self.isClosed else {
                return // Already closed, no-op
            }

            self.isClosed = true
            self.db = nil
        }
    }

    // MARK: - Mobile Lifecycle

    public func suspend() async throws {
        // Flush any pending writes
        // SQLite handles this gracefully, but we ensure consistency
        try await asyncOperation {
            try self.withDatabase { _ in
                // No explicit action needed for SQLite
                // The WAL is automatically checkpointed
            }
        }
    }

    public func resume() async throws {
        // Validate database state after returning from background
        try await asyncOperation {
            try self.withDatabase { db in
                // Run a simple query to validate the connection
                _ = try db.run("?[x] := x = 1")
            }
        }
    }

    public func onLowMemory() async throws {
        // Release non-essential caches
        try await asyncOperation {
            try self.withDatabase { _ in
                // CozoDB doesn't expose direct cache control
                // This is a hook for future optimization
            }
        }
    }

    // MARK: - Deinitialization

    deinit {
        // Best effort cleanup - should have called close() explicitly
        lock.lock()
        if !isClosed {
            isClosed = true
            db = nil
        }
        lock.unlock()
    }
}

// MARK: - CozoDB Bridge Types

/// Placeholder for CozoSwiftBridge types.
/// These will be provided by the CozoSwiftBridge CocoaPod.
///
/// The actual implementation comes from:
/// `pod 'CozoSwiftBridge', '~> 0.7.1'`

#if !COZOSWIFTBRIDGE_AVAILABLE

/// Result type from CozoDB queries.
/// This is a placeholder that matches the CozoSwiftBridge API.
public struct CozoQueryResult {
    public let headers: [String]
    public let rows: [[Any]]

    public init(headers: [String], rows: [[Any]]) {
        self.headers = headers
        self.rows = rows
    }
}

/// CozoDB database wrapper.
/// This is a placeholder that matches the CozoSwiftBridge API.
public class CozoDB {
    private let engine: String
    private let path: String

    // In-memory storage for testing
    private var relations: [String: (columns: [String], rows: [[Any]])] = [:]
    private var isClosed = false

    public init() {
        self.engine = "mem"
        self.path = ""
    }

    public init(kind: String, path: String) throws {
        self.engine = kind
        self.path = path

        if kind != "mem" && kind != "sqlite" {
            throw NSError(domain: "CozoDB", code: 1, userInfo: [
                NSLocalizedDescriptionKey: "Unsupported engine: \(kind)"
            ])
        }
    }

    public func run(_ query: String) throws -> CozoQueryResult {
        guard !isClosed else {
            throw NSError(domain: "CozoDB", code: 2, userInfo: [
                NSLocalizedDescriptionKey: "Database is closed"
            ])
        }

        // Parse and execute simple Datalog queries
        return try executeQuery(query, params: nil)
    }

    public func run(_ query: String, params: Data) throws -> CozoQueryResult {
        guard !isClosed else {
            throw NSError(domain: "CozoDB", code: 2, userInfo: [
                NSLocalizedDescriptionKey: "Database is closed"
            ])
        }

        let paramsDict = try JSONSerialization.jsonObject(with: params) as? [String: Any]
        return try executeQuery(query, params: paramsDict)
    }

    private func executeQuery(_ query: String, params: [String: Any]?) throws -> CozoQueryResult {
        // Simplified query parser for testing
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)

        // Handle :create relation
        if trimmed.hasPrefix(":create") {
            return try handleCreate(trimmed)
        }

        // Handle :put relation
        if trimmed.contains(":put") {
            return try handlePut(trimmed, params: params)
        }

        // Handle :rm relation
        if trimmed.contains(":rm") {
            return try handleRemove(trimmed, params: params)
        }

        // Handle simple queries ?[...] := *relation{...}
        if trimmed.hasPrefix("?[") {
            return try handleQuery(trimmed, params: params)
        }

        // Invalid query
        throw NSError(domain: "CozoDB", code: 3, userInfo: [
            NSLocalizedDescriptionKey: "Invalid query syntax"
        ])
    }

    private func handleCreate(_ query: String) throws -> CozoQueryResult {
        // Parse :create relation_name { col1: Type, col2: Type }
        let pattern = #":create\s+(\w+)\s*\{([^}]+)\}"#
        guard let regex = try? NSRegularExpression(pattern: pattern),
              let match = regex.firstMatch(in: query, range: NSRange(query.startIndex..., in: query)),
              let nameRange = Range(match.range(at: 1), in: query),
              let columnsRange = Range(match.range(at: 2), in: query) else {
            throw NSError(domain: "CozoDB", code: 4, userInfo: [
                NSLocalizedDescriptionKey: "Invalid :create syntax"
            ])
        }

        let relationName = String(query[nameRange])
        let columnsStr = String(query[columnsRange])

        // Parse columns
        let columns = columnsStr.split(separator: ",").map { col -> String in
            let parts = col.split(separator: ":")
            return parts.first.map { String($0).trimmingCharacters(in: .whitespaces) } ?? ""
        }.filter { !$0.isEmpty }

        relations[relationName] = (columns: columns, rows: [])
        return CozoQueryResult(headers: [], rows: [])
    }

    private func handlePut(_ query: String, params: [String: Any]?) throws -> CozoQueryResult {
        // Parse ?[...] <- [[...]] :put relation_name { ... }
        // or ?[...] <- $param :put relation_name { ... }
        let putPattern = #":put\s+(\w+)"#
        guard let regex = try? NSRegularExpression(pattern: putPattern),
              let match = regex.firstMatch(in: query, range: NSRange(query.startIndex..., in: query)),
              let nameRange = Range(match.range(at: 1), in: query) else {
            throw NSError(domain: "CozoDB", code: 5, userInfo: [
                NSLocalizedDescriptionKey: "Invalid :put syntax"
            ])
        }

        let relationName = String(query[nameRange])
        guard var relation = relations[relationName] else {
            throw NSError(domain: "CozoDB", code: 6, userInfo: [
                NSLocalizedDescriptionKey: "Relation '\(relationName)' does not exist"
            ])
        }

        // Extract data from query or params
        if let dataMatch = query.range(of: #"\[\[([^\]]+)\]\]"#, options: .regularExpression) {
            // Inline data
            let dataStr = query[dataMatch]
            // Simplified parsing - real implementation would be more robust
            let values = dataStr.replacingOccurrences(of: "[[", with: "")
                .replacingOccurrences(of: "]]", with: "")
                .split(separator: ",")
                .map { val -> Any in
                    let trimmed = val.trimmingCharacters(in: .whitespaces)
                    if let intVal = Int(trimmed) {
                        return intVal
                    }
                    // Remove quotes from strings
                    return trimmed.replacingOccurrences(of: "'", with: "")
                        .replacingOccurrences(of: "\"", with: "")
                }
            relation.rows.append(values)
            relations[relationName] = relation
        } else if let params = params, let data = params["data"] as? [[Any]] {
            relation.rows.append(contentsOf: data)
            relations[relationName] = relation
        }

        return CozoQueryResult(headers: [], rows: [])
    }

    private func handleRemove(_ query: String, params: [String: Any]?) throws -> CozoQueryResult {
        // Parse :rm relation_name { ... }
        let rmPattern = #":rm\s+(\w+)"#
        guard let regex = try? NSRegularExpression(pattern: rmPattern),
              let match = regex.firstMatch(in: query, range: NSRange(query.startIndex..., in: query)),
              let nameRange = Range(match.range(at: 1), in: query) else {
            throw NSError(domain: "CozoDB", code: 7, userInfo: [
                NSLocalizedDescriptionKey: "Invalid :rm syntax"
            ])
        }

        let relationName = String(query[nameRange])
        guard var relation = relations[relationName] else {
            throw NSError(domain: "CozoDB", code: 6, userInfo: [
                NSLocalizedDescriptionKey: "Relation '\(relationName)' does not exist"
            ])
        }

        // For simplicity, remove all rows matching the condition
        // Real implementation would parse the condition
        if let params = params, let id = params["id"] {
            relation.rows.removeAll { row in
                guard let firstCol = row.first else { return false }
                if let intId = id as? Int, let rowId = firstCol as? Int {
                    return intId == rowId
                }
                return false
            }
            relations[relationName] = relation
        }

        return CozoQueryResult(headers: [], rows: [])
    }

    private func handleQuery(_ query: String, params: [String: Any]?) throws -> CozoQueryResult {
        // Parse ?[col1, col2] := *relation_name{ col1, col2 }
        let queryPattern = #"\?\[([^\]]+)\]\s*:=\s*\*(\w+)\{([^}]*)\}"#
        guard let regex = try? NSRegularExpression(pattern: queryPattern),
              let match = regex.firstMatch(in: query, range: NSRange(query.startIndex..., in: query)),
              let columnsRange = Range(match.range(at: 1), in: query),
              let relationRange = Range(match.range(at: 2), in: query) else {
            // Handle simple constant queries like ?[x] := x = 1
            if query.contains(":= x = 1") || query.contains(":= x=1") {
                return CozoQueryResult(headers: ["x"], rows: [[1]])
            }
            throw NSError(domain: "CozoDB", code: 8, userInfo: [
                NSLocalizedDescriptionKey: "Invalid query syntax"
            ])
        }

        let columns = String(query[columnsRange]).split(separator: ",")
            .map { $0.trimmingCharacters(in: .whitespaces) }
        let relationName = String(query[relationRange])

        guard let relation = relations[relationName] else {
            throw NSError(domain: "CozoDB", code: 6, userInfo: [
                NSLocalizedDescriptionKey: "Relation '\(relationName)' does not exist"
            ])
        }

        return CozoQueryResult(headers: columns, rows: relation.rows)
    }

    public func exportRelations(relations: [String]) throws -> Any {
        guard !isClosed else {
            throw NSError(domain: "CozoDB", code: 2, userInfo: [
                NSLocalizedDescriptionKey: "Database is closed"
            ])
        }

        var result: [String: [[Any]]] = [:]
        for name in relations {
            if let relation = self.relations[name] {
                result[name] = relation.rows
            }
        }
        return result
    }

    public func importRelations(data: Data) throws {
        guard !isClosed else {
            throw NSError(domain: "CozoDB", code: 2, userInfo: [
                NSLocalizedDescriptionKey: "Database is closed"
            ])
        }

        guard let dict = try JSONSerialization.jsonObject(with: data) as? [String: [[Any]]] else {
            throw NSError(domain: "CozoDB", code: 9, userInfo: [
                NSLocalizedDescriptionKey: "Invalid import data format"
            ])
        }

        for (name, rows) in dict {
            if var relation = relations[name] {
                relation.rows.append(contentsOf: rows)
                relations[name] = relation
            }
        }
    }

    public func backup(path: String) throws {
        guard !isClosed else {
            throw NSError(domain: "CozoDB", code: 2, userInfo: [
                NSLocalizedDescriptionKey: "Database is closed"
            ])
        }

        // Serialize relations to JSON and write to file
        let data = try JSONSerialization.data(withJSONObject: [
            "relations": relations.mapValues { ["columns": $0.columns, "rows": $0.rows] }
        ])
        try data.write(to: URL(fileURLWithPath: path))
    }

    public func restore(path: String) throws {
        guard !isClosed else {
            throw NSError(domain: "CozoDB", code: 2, userInfo: [
                NSLocalizedDescriptionKey: "Database is closed"
            ])
        }

        let data = try Data(contentsOf: URL(fileURLWithPath: path))
        guard let dict = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let relationsDict = dict["relations"] as? [String: [String: Any]] else {
            throw NSError(domain: "CozoDB", code: 10, userInfo: [
                NSLocalizedDescriptionKey: "Invalid backup format"
            ])
        }

        relations.removeAll()
        for (name, info) in relationsDict {
            let columns = info["columns"] as? [String] ?? []
            let rows = info["rows"] as? [[Any]] ?? []
            relations[name] = (columns: columns, rows: rows)
        }
    }

    public func importRelationsFromBackup(path: String, relations: [String]) throws {
        guard !isClosed else {
            throw NSError(domain: "CozoDB", code: 2, userInfo: [
                NSLocalizedDescriptionKey: "Database is closed"
            ])
        }

        let data = try Data(contentsOf: URL(fileURLWithPath: path))
        guard let dict = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let relationsDict = dict["relations"] as? [String: [String: Any]] else {
            throw NSError(domain: "CozoDB", code: 10, userInfo: [
                NSLocalizedDescriptionKey: "Invalid backup format"
            ])
        }

        for name in relations {
            guard let info = relationsDict[name],
                  let columns = info["columns"] as? [String],
                  let rows = info["rows"] as? [[Any]] else {
                continue
            }

            if self.relations[name] == nil {
                self.relations[name] = (columns: columns, rows: [])
            }

            if var relation = self.relations[name] {
                relation.rows.append(contentsOf: rows)
                self.relations[name] = relation
            }
        }
    }

    /// Close the database and release resources.
    internal func close() {
        isClosed = true
        relations.removeAll()
    }
}

#endif
