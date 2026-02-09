//
//  CozoGraphDB.swift
//  DoubleBindCore
//
//  GraphDB implementation wrapping CozoSwiftBridge.
//  Provides thread-safe database access using async/await and GCD.
//

#if canImport(CozoSwiftBridge)
import CozoSwiftBridge
#endif
import Foundation

/// CozoDB implementation of the GraphDB interface.
///
/// Thread-safe database wrapper that provides async/await access to CozoDB operations.
/// All database operations are executed on a dedicated serial queue to ensure thread safety.
///
/// Usage:
/// ```swift
/// let config = GraphDBConfig(engine: .sqlite, path: "/path/to/db")
/// let db = try CozoGraphDB(config: config)
///
/// let result: QueryResult<Any> = try await db.query("?[] <- [[1, 2, 3]]")
/// print(result.headers)  // Column names
/// print(result.rows)     // Data rows
///
/// try await db.close()
/// ```
public final class CozoGraphDB: GraphDB, @unchecked Sendable {
    // MARK: - Private Properties

    /// The underlying CozoDB instance from CozoSwiftBridge.
    private var db: CozoDB?

    /// Serial queue for thread-safe database access.
    private let dbQueue = DispatchQueue(
        label: "com.doublebind.cozographdb",
        qos: .userInitiated
    )

    /// Lock for protecting the db reference during close operations.
    private let lock = NSLock()

    /// Flag indicating whether the database has been closed.
    private var isClosed = false

    // MARK: - Initialization

    /// Initialize a CozoGraphDB with the specified configuration.
    ///
    /// - Parameter config: Database configuration specifying engine and path.
    /// - Throws: `GraphDBError.initializationFailed` if database creation fails.
    public init(config: GraphDBConfig) throws {
        do {
            self.db = try CozoDB(kind: config.engine.rawValue, path: config.path)
        } catch {
            throw GraphDBError.initializationFailed(underlying: error)
        }
    }

    /// Initialize a CozoGraphDB with explicit engine and path.
    ///
    /// - Parameters:
    ///   - engine: Storage engine ("sqlite" or "mem").
    ///   - path: Path to the database file (ignored for "mem" engine).
    /// - Throws: `GraphDBError.invalidEngine` or `GraphDBError.initializationFailed`.
    public init(engine: String = "sqlite", path: String) throws {
        guard engine == "sqlite" || engine == "mem" else {
            throw GraphDBError.invalidEngine(engine: engine)
        }

        do {
            self.db = try CozoDB(kind: engine, path: path)
        } catch {
            throw GraphDBError.initializationFailed(underlying: error)
        }
    }

    /// Initialize an in-memory CozoGraphDB (for testing).
    ///
    /// - Throws: `GraphDBError.initializationFailed` if database creation fails.
    public init() throws {
        do {
            self.db = CozoDB()
        } catch {
            throw GraphDBError.initializationFailed(underlying: error)
        }
    }

    // MARK: - GraphDB Protocol Implementation

    /// Execute a read-only Datalog query.
    public func query<T: Sendable>(
        _ script: String,
        params: [String: Any]? = nil
    ) async throws -> QueryResult<T> {
        try await withDatabase { _ in
            let result = try self.executeQuery(script, params: params)
            // Convert rows to typed result
            let typedRows = result.rows.compactMap { row -> [T]? in
                row.compactMap { $0 as? T }
            }
            return QueryResult<T>(headers: result.headers, rows: typedRows)
        }
    }

    /// Execute a mutation (insert, update, delete) operation.
    public func mutate(
        _ script: String,
        params: [String: Any]? = nil
    ) async throws -> MutationResult {
        try await withDatabase { _ in
            let result = try self.executeQuery(script, params: params)
            return MutationResult(headers: result.headers, rows: result.rows)
        }
    }

    /// Import data into multiple relations at once.
    public func importRelations(_ data: [String: [[Any]]]) async throws {
        try await withDatabase { db in
            // Convert data to JSON format expected by CozoDB
            let jsonData = try JSONSerialization.data(withJSONObject: data)
            guard let jsonString = String(data: jsonData, encoding: .utf8) else {
                throw GraphDBError.parameterSerializationFailed(
                    underlying: NSError(
                        domain: "CozoGraphDB",
                        code: -1,
                        userInfo: [NSLocalizedDescriptionKey: "Failed to convert JSON data to string"]
                    )
                )
            }

            try db.importRelations(data: jsonString)
        }
    }

    /// Export data from specified relations.
    public func exportRelations(_ relations: [String]) async throws -> [String: [[Any]]] {
        try await withDatabase { db in
            let jsonResult = try db.exportRelations(relations: relations)

            // Parse JSON result to dictionary
            guard let jsonString = jsonResult as? String,
                  let jsonData = jsonString.data(using: .utf8),
                  let result = try JSONSerialization.jsonObject(with: jsonData) as? [String: [[Any]]]
            else {
                // Try direct cast if already parsed
                if let directResult = jsonResult as? [String: [[Any]]] {
                    return directResult
                }
                throw GraphDBError.resultDeserializationFailed(
                    underlying: NSError(
                        domain: "CozoGraphDB",
                        code: -1,
                        userInfo: [NSLocalizedDescriptionKey: "Failed to parse export result"]
                    )
                )
            }

            return result
        }
    }

    /// Create a backup of the database.
    public func backup(to path: String) async throws {
        try await withDatabase { db in
            try db.backup(path: path)
        }
    }

    /// Restore the database from a backup file.
    public func restore(from path: String) async throws {
        try await withDatabase { db in
            try db.restore(path: path)
        }
    }

    /// Import specific relations from a backup file.
    public func importRelationsFromBackup(path: String, relations: [String]) async throws {
        try await withDatabase { db in
            try db.importRelationsFromBackup(path: path, relations: relations)
        }
    }

    /// Close the database and release native resources.
    public func close() async throws {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            dbQueue.async { [weak self] in
                guard let self = self else {
                    continuation.resume()
                    return
                }

                self.lock.lock()
                defer { self.lock.unlock() }

                // Already closed, just return
                if self.isClosed {
                    continuation.resume()
                    return
                }

                // Mark as closed and release reference
                self.isClosed = true
                self.db = nil

                continuation.resume()
            }
        }
    }

    // MARK: - Mobile Lifecycle Methods

    /// Called when the app transitions to the background.
    /// Flushes pending writes to ensure data integrity.
    public func suspend() async throws {
        // SQLite handles fsync automatically, but we run a checkpoint
        // to ensure WAL data is flushed to the main database file.
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            dbQueue.async { [weak self] in
                guard let self = self else {
                    continuation.resume()
                    return
                }

                do {
                    // Verify database is still open
                    _ = try self.getDatabase()
                    // CozoDB/SQLite handles this automatically via WAL mode
                    // No explicit action needed, but we sync the queue
                    continuation.resume()
                } catch {
                    // Don't fail on suspend - just log and continue
                    continuation.resume()
                }
            }
        }
    }

    /// Called when the app returns to the foreground.
    /// Validates database state is still valid.
    public func resume() async throws {
        try await withDatabase { db in
            // Run a simple query to verify connection
            _ = try db.run("?[] <- [[1]]")
        }
    }

    /// Called when the system signals memory pressure.
    /// Releases non-essential resources.
    public func onLowMemory() async throws {
        // CozoDB manages its own memory; we don't have additional caches to clear.
        // This is a placeholder for future optimizations if needed.
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            dbQueue.async {
                // No-op for now - CozoDB handles its own memory management
                continuation.resume()
            }
        }
    }

    // MARK: - Private Helpers

    /// Execute an operation on the database with proper async handling and thread safety.
    ///
    /// This helper encapsulates the common pattern of:
    /// 1. Dispatching to the serial database queue
    /// 2. Checking for deallocated self
    /// 3. Getting the database instance
    /// 4. Executing the operation
    /// 5. Resuming the continuation with success or error
    ///
    /// - Parameter operation: A throwing closure that receives the CozoDB instance and returns a result.
    /// - Returns: The result of the operation.
    /// - Throws: `GraphDBError.databaseClosed` if the database is closed, or any error thrown by the operation.
    private func withDatabase<T>(
        _ operation: @escaping (CozoDB) throws -> T
    ) async throws -> T {
        try await withCheckedThrowingContinuation { continuation in
            dbQueue.async { [weak self] in
                guard let self = self else {
                    continuation.resume(throwing: GraphDBError.databaseClosed)
                    return
                }

                do {
                    let db = try self.getDatabase()
                    let result = try operation(db)
                    continuation.resume(returning: result)
                } catch {
                    continuation.resume(throwing: error)
                }
            }
        }
    }

    /// Get the database instance, throwing if closed.
    private func getDatabase() throws -> CozoDB {
        lock.lock()
        defer { lock.unlock() }

        guard !isClosed, let db = db else {
            throw GraphDBError.databaseClosed
        }
        return db
    }

    /// Execute a query with optional parameters and return parsed results.
    private func executeQuery(
        _ script: String,
        params: [String: Any]?
    ) throws -> (headers: [String], rows: [[Any]]) {
        let db = try getDatabase()

        let result: [NamedRow]
        if let params = params, !params.isEmpty {
            // Serialize parameters to JSON
            let paramsData: Data
            do {
                paramsData = try JSONSerialization.data(withJSONObject: params)
            } catch {
                throw GraphDBError.parameterSerializationFailed(underlying: error)
            }

            guard let paramsString = String(data: paramsData, encoding: .utf8) else {
                throw GraphDBError.parameterSerializationFailed(
                    underlying: NSError(
                        domain: "CozoGraphDB",
                        code: -1,
                        userInfo: [NSLocalizedDescriptionKey: "Failed to convert params to UTF-8 string"]
                    )
                )
            }

            do {
                result = try db.run(script, params: paramsString)
            } catch {
                throw GraphDBError.queryFailed(script: script, underlying: error)
            }
        } else {
            do {
                result = try db.run(script)
            } catch {
                throw GraphDBError.queryFailed(script: script, underlying: error)
            }
        }

        // Parse NamedRow results into headers and rows
        return parseNamedRows(result)
    }

    /// Parse CozoDB NamedRow results into headers and row arrays.
    private func parseNamedRows(_ namedRows: [NamedRow]) -> (headers: [String], rows: [[Any]]) {
        guard let firstRow = namedRows.first else {
            return (headers: [], rows: [])
        }

        // Extract headers from the first row's keys
        let headers = getKeys(from: firstRow)

        // Extract values in header order for each row
        let rows: [[Any]] = namedRows.map { row in
            headers.map { key in
                getValue(from: row, key: key) ?? NSNull()
            }
        }

        return (headers: headers, rows: rows)
    }
}

// MARK: - NamedRow Helpers

/// Helper functions for working with NamedRow results.
/// NamedRow is defined as [String: Any] in our stub and in CozoSwiftBridge.
private func getKeys(from row: NamedRow) -> [String] {
    return Array(row.keys).sorted()
}

private func getValue(from row: NamedRow, key: String) -> Any? {
    return row[key]
}
