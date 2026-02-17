//
//  CozoGraphDB.swift
//  DoubleBindCore
//
//  Swift implementation of the GraphDB interface wrapping CozoSwiftBridge.
//  This class provides the native database operations for the Double-Bind app.
//

import Foundation
import CozoSwiftBridge
import SwiftyJSON

/// Actor that manages the closed state with thread-safe access.
private actor ClosedStateManager {
    private var _isClosed: Bool = false

    var isClosed: Bool {
        return _isClosed
    }

    func setClosed() {
        _isClosed = true
    }

    func ensureNotClosed() throws {
        if _isClosed {
            throw GraphDBError.databaseClosed
        }
    }
}

/// Recursively converts SwiftyJSON objects and other non-serializable types to Foundation types.
/// This is necessary because CozoSwiftBridge may return JSON objects that JSONSerialization can't handle.
private func convertToFoundation(_ value: Any) -> Any {
    // Handle SwiftyJSON objects
    if let json = value as? JSON {
        return convertToFoundation(json.object)
    }

    // Handle arrays
    if let array = value as? [Any] {
        return array.map { convertToFoundation($0) }
    }

    // Handle dictionaries
    if let dict = value as? [String: Any] {
        return dict.mapValues { convertToFoundation($0) }
    }

    // Handle NSNumber (includes booleans)
    if let number = value as? NSNumber {
        return number
    }

    // Handle basic types that are already serializable
    if value is String || value is Int || value is Double || value is Float || value is Bool {
        return value
    }

    // Handle NSNull
    if value is NSNull {
        return value
    }

    // Handle nil (convert to NSNull for JSON compatibility)
    if case Optional<Any>.none = value {
        return NSNull()
    }

    // Fallback: convert to string representation
    return String(describing: value)
}

/// Thread-safe wrapper around CozoDB that implements the GraphDB interface.
/// All operations are executed on a background queue and results are returned asynchronously.
public final class CozoGraphDB: @unchecked Sendable {

    // MARK: - Properties

    private var db: CozoDB?
    private let queue = DispatchQueue(label: "com.doublebind.cozodb", qos: .userInitiated)
    private let closedState = ClosedStateManager()

    /// Whether the database has been closed.
    public var isClosed: Bool {
        get async {
            return await closedState.isClosed
        }
    }

    // MARK: - Initialization

    /// Creates a new CozoGraphDB instance with the specified storage engine and path.
    ///
    /// - Parameters:
    ///   - engine: Storage engine type ("sqlite" or "mem")
    ///   - path: Path to the database file (ignored for "mem" engine)
    /// - Throws: `GraphDBError.initializationFailed` if database creation fails
    ///           `GraphDBError.invalidEngine` if engine type is not supported
    public init(engine: String = "sqlite", path: String) throws {
        guard engine == "sqlite" || engine == "mem" else {
            throw GraphDBError.invalidEngine(engine: engine)
        }

        do {
            if engine == "mem" {
                self.db = CozoDB()
            } else {
                self.db = try CozoDB(kind: engine, path: path)
            }
        } catch {
            throw GraphDBError.initializationFailed(underlying: error)
        }
    }

    // MARK: - Core Operations

    /// Executes a Datalog query and returns the result as a JSON string.
    ///
    /// - Parameters:
    ///   - script: The Datalog query script
    ///   - params: JSON string of query parameters (default: "{}")
    /// - Returns: JSON string containing headers and rows
    /// - Throws: `GraphDBError.databaseClosed` if database is closed
    ///           `GraphDBError.queryFailed` if query execution fails
    public func run(_ script: String, params: String = "{}") async throws -> String {
        try await closedState.ensureNotClosed()

        return try await withCheckedThrowingContinuation { continuation in
            queue.async { [weak self] in
                guard let self = self, let db = self.db else {
                    continuation.resume(throwing: GraphDBError.databaseClosed)
                    return
                }

                do {
                    // Parse params JSON string to SwiftyJSON for CozoDB
                    let paramsData = params.data(using: .utf8) ?? Data()
                    let paramsJSON = try JSON(data: paramsData)

                    // Execute the query - returns [NamedRow]
                    // NamedRow has: headers: RowHeaders (with .headers: [String]), fields: [JSON]
                    let result = try db.run(script, params: paramsJSON)

                    // Transform CozoDB result format to QueryResult format
                    // TypeScript expects: { headers: [String], rows: [[Any]] }
                    let headers: [String] = result.first?.headers.headers ?? []

                    // Convert each NamedRow.fields to an array of Foundation values
                    let rows: [[Any]] = result.map { namedRow -> [Any] in
                        return namedRow.fields.map { json -> Any in
                            return convertToFoundation(json.object)
                        }
                    }

                    let queryResult: [String: Any] = [
                        "headers": headers,
                        "rows": rows
                    ]

                    // Convert to JSON string
                    let jsonData = try JSONSerialization.data(withJSONObject: queryResult)
                    let jsonString = String(data: jsonData, encoding: .utf8) ?? "{\"headers\":[],\"rows\":[]}"

                    continuation.resume(returning: jsonString)
                } catch {
                    continuation.resume(throwing: GraphDBError.queryFailed(script: script, underlying: error))
                }
            }
        }
    }

    /// Exports specified relations as a JSON string.
    ///
    /// - Parameter relations: JSON array string of relation names to export
    /// - Returns: JSON object string mapping relation names to row arrays
    /// - Throws: `GraphDBError.databaseClosed` if database is closed
    ///           `GraphDBError.exportFailed` if export fails
    public func exportRelations(_ relations: String) async throws -> String {
        try await closedState.ensureNotClosed()

        return try await withCheckedThrowingContinuation { continuation in
            queue.async { [weak self] in
                guard let self = self, let db = self.db else {
                    continuation.resume(throwing: GraphDBError.databaseClosed)
                    return
                }

                do {
                    // Parse relations JSON array
                    let relationsData = relations.data(using: .utf8) ?? Data()
                    let relationsArray = try JSONSerialization.jsonObject(with: relationsData) as? [String] ?? []

                    // Export relations
                    let result = try db.exportRelations(relations: relationsArray)

                    // Convert SwiftyJSON result to JSON string
                    let jsonString = result.rawString(.utf8, options: []) ?? "{}"

                    continuation.resume(returning: jsonString)
                } catch {
                    continuation.resume(throwing: GraphDBError.exportFailed(underlying: error))
                }
            }
        }
    }

    /// Imports data into relations from a JSON string.
    ///
    /// - Parameter data: JSON object string mapping relation names to row arrays
    /// - Throws: `GraphDBError.databaseClosed` if database is closed
    ///           `GraphDBError.importFailed` if import fails
    public func importRelations(_ data: String) async throws {
        try await closedState.ensureNotClosed()

        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            queue.async { [weak self] in
                guard let self = self, let db = self.db else {
                    continuation.resume(throwing: GraphDBError.databaseClosed)
                    return
                }

                do {
                    // Parse data JSON string to SwiftyJSON for CozoDB
                    let dataObj = data.data(using: .utf8) ?? Data()
                    let dataJSON = try JSON(data: dataObj)

                    // Import relations
                    try db.importRelations(data: dataJSON)

                    continuation.resume()
                } catch {
                    continuation.resume(throwing: GraphDBError.importFailed(underlying: error))
                }
            }
        }
    }

    /// Creates a backup of the database at the specified path.
    ///
    /// - Parameter path: File path for the backup
    /// - Throws: `GraphDBError.databaseClosed` if database is closed
    ///           `GraphDBError.backupFailed` if backup fails
    public func backup(to path: String) async throws {
        try await closedState.ensureNotClosed()

        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            queue.async { [weak self] in
                guard let self = self, let db = self.db else {
                    continuation.resume(throwing: GraphDBError.databaseClosed)
                    return
                }

                do {
                    try db.backup(path: path)
                    continuation.resume()
                } catch {
                    continuation.resume(throwing: GraphDBError.backupFailed(path: path, underlying: error))
                }
            }
        }
    }

    /// Restores the database from a backup file.
    ///
    /// - Parameter path: File path to the backup
    /// - Throws: `GraphDBError.databaseClosed` if database is closed
    ///           `GraphDBError.restoreFailed` if restore fails
    public func restore(from path: String) async throws {
        try await closedState.ensureNotClosed()

        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            queue.async { [weak self] in
                guard let self = self, let db = self.db else {
                    continuation.resume(throwing: GraphDBError.databaseClosed)
                    return
                }

                do {
                    try db.restore(path: path)
                    continuation.resume()
                } catch {
                    continuation.resume(throwing: GraphDBError.restoreFailed(path: path, underlying: error))
                }
            }
        }
    }

    /// Imports specific relations from a backup file.
    ///
    /// - Parameters:
    ///   - path: File path to the backup
    ///   - relations: JSON array string of relation names to import
    /// - Throws: `GraphDBError.databaseClosed` if database is closed
    ///           `GraphDBError.importFromBackupFailed` if import fails
    public func importRelationsFromBackup(path: String, relations: String) async throws {
        try await closedState.ensureNotClosed()

        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            queue.async { [weak self] in
                guard let self = self, let db = self.db else {
                    continuation.resume(throwing: GraphDBError.databaseClosed)
                    return
                }

                do {
                    // Parse relations JSON array
                    let relationsData = relations.data(using: .utf8) ?? Data()
                    let relationsArray = try JSONSerialization.jsonObject(with: relationsData) as? [String] ?? []

                    try db.importRelationsFromBackup(path: path, relations: relationsArray)
                    continuation.resume()
                } catch {
                    continuation.resume(throwing: GraphDBError.importFromBackupFailed(path: path, underlying: error))
                }
            }
        }
    }

    // MARK: - Mobile Lifecycle

    /// Called when the app transitions to the background.
    /// Flushes pending writes to ensure data integrity.
    public func suspend() async throws {
        try await closedState.ensureNotClosed()

        // SQLite handles this gracefully with WAL mode.
        // No explicit action needed, but we can force a checkpoint if needed.
        // For now, this is a no-op as CozoDB/SQLite manages this internally.
    }

    /// Called when the app returns to the foreground.
    /// Validates database state and refreshes connections if needed.
    public func resume() async throws {
        try await closedState.ensureNotClosed()

        // SQLite connections remain valid across app suspension.
        // No explicit action needed.
    }

    /// Called when the system signals memory pressure.
    /// Releases non-essential caches and resources.
    public func onLowMemory() async throws {
        try await closedState.ensureNotClosed()

        // CozoDB manages its own memory. We could potentially clear
        // any application-level caches here if we add them in the future.
    }

    // MARK: - Resource Management

    /// Closes the database and releases all resources.
    /// After calling this method, the instance is unusable.
    public func close() async throws {
        // Check if already closed (actor handles thread safety)
        guard await !closedState.isClosed else { return }

        // Mark as closed first (actor handles thread safety)
        await closedState.setClosed()

        // CozoDB releases resources on deinit
        db = nil
    }
}
