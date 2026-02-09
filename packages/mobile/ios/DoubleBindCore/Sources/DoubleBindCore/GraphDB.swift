// GraphDB.swift
// DoubleBindCore
//
// GraphDB protocol and result types for CozoDB interactions on iOS.
// This protocol mirrors the TypeScript GraphDB interface defined in
// packages/types/src/graph-db.ts for cross-platform consistency.

import Foundation

// MARK: - Result Types

/// Result from a read-only query operation.
/// Headers contain column names, rows contain the data.
public struct QueryResult<T> {
    public let headers: [String]
    public let rows: [[T]]

    public init(headers: [String], rows: [[T]]) {
        self.headers = headers
        self.rows = rows
    }
}

/// Result from a mutation operation (insert, update, delete).
/// Structure matches QueryResult but mutations typically return
/// operation metadata rather than domain data.
public struct MutationResult {
    public let headers: [String]
    public let rows: [[Any]]

    public init(headers: [String], rows: [[Any]]) {
        self.headers = headers
        self.rows = rows
    }
}

// MARK: - Configuration

/// Configuration for database initialization.
/// Platform implementations use this to create appropriate connections.
public struct GraphDBConfig {
    /// Storage engine to use.
    /// - `rocksdb`: High-performance LSM-tree storage (desktop only)
    /// - `sqlite`: Universal embedded storage (mobile, recommended)
    /// - `mem`: In-memory, non-persistent (testing)
    public enum Engine: String {
        case rocksdb
        case sqlite
        case mem
    }

    public let engine: Engine

    /// Path to the database file.
    /// Ignored for `mem` engine.
    public let path: String

    public init(engine: Engine, path: String) {
        self.engine = engine
        self.path = path
    }
}

// MARK: - GraphDB Protocol

/// Database interface for graph operations.
/// Abstracts CozoDB to allow mocking in tests and cross-platform
/// implementations (desktop, iOS, Android).
///
/// All implementations must be thread-safe. Query results should
/// be considered immutable after return.
///
/// This protocol corresponds to the TypeScript GraphDB interface in
/// `packages/types/src/graph-db.ts`.
public protocol GraphDB: AnyObject {

    // MARK: - Core Operations

    /// Execute a read-only Datalog query.
    ///
    /// - Parameters:
    ///   - script: Datalog query script
    ///   - params: Optional named parameters for the query
    /// - Returns: Query results with headers and typed rows
    /// - Throws: Database error if query fails
    func query<T>(_ script: String, params: [String: Any]?) async throws -> QueryResult<T>

    /// Execute a mutation (insert, update, delete) operation.
    ///
    /// - Parameters:
    ///   - script: Datalog mutation script
    ///   - params: Optional named parameters for the mutation
    /// - Returns: Mutation result with operation metadata
    /// - Throws: Database error if mutation fails
    func mutate(_ script: String, params: [String: Any]?) async throws -> MutationResult

    // MARK: - Data Transfer

    /// Import data into multiple relations at once.
    /// Used for bulk imports and restoring from backup.
    ///
    /// - Note: Triggers are NOT executed for imported relations.
    ///         Use parameterized queries if triggers must fire.
    ///
    /// - Parameter data: Map of relation names to row arrays
    /// - Throws: Database error if import fails
    func importRelations(_ data: [String: [[Any]]]) async throws

    /// Export data from specified relations.
    /// Used for backup and data export features.
    ///
    /// - Parameter relations: Names of relations to export
    /// - Returns: Map of relation names to row arrays
    /// - Throws: Database error if export fails
    func exportRelations(_ relations: [String]) async throws -> [String: [[Any]]]

    // MARK: - Backup and Restore

    /// Create a backup of the database at the specified path.
    /// The backup format is SQLite regardless of the source engine.
    ///
    /// - Parameter path: File path for the backup
    /// - Throws: Database error if backup fails
    func backup(to path: String) async throws

    /// Restore the database from a backup file.
    /// The current database must be empty (no relations with data).
    ///
    /// The backup format is portable across storage engines:
    /// a RocksDB backup can be restored to SQLite and vice versa.
    ///
    /// - Parameter path: File path to the backup
    /// - Throws: Database error if restore fails
    func restore(from path: String) async throws

    /// Import specific relations from a backup file.
    /// Relations must already exist in the current database.
    ///
    /// - Note: Triggers are NOT executed for imported relations.
    ///
    /// - Parameters:
    ///   - path: File path to the backup
    ///   - relations: Names of relations to import
    /// - Throws: Database error if import fails
    func importRelationsFromBackup(path: String, relations: [String]) async throws

    // MARK: - Mobile Lifecycle

    /// Called when the app transitions to the background (iOS).
    /// Implementations should flush pending writes and prepare for suspension.
    /// This ensures data integrity if the OS terminates the app while backgrounded.
    ///
    /// - Note: Called during `applicationDidEnterBackground`
    func suspend() async throws

    /// Called when the app returns to the foreground (iOS).
    /// Implementations may refresh connections or validate database state.
    ///
    /// - Note: Called during `applicationWillEnterForeground`
    func resume() async throws

    /// Called when the system signals memory pressure (iOS).
    /// Implementations should release non-essential caches and resources.
    /// This helps prevent the OS from terminating the app.
    ///
    /// - Note: Called during `applicationDidReceiveMemoryWarning`
    func onLowMemory() async throws

    // MARK: - Resource Management

    /// Close the database and release native resources.
    ///
    /// - Important: This method MUST be called when the database is no longer needed.
    ///   Failure to call `close()` will leak native memory and file handles.
    ///
    /// After calling `close()`, the GraphDB instance is unusable and
    /// all subsequent method calls will throw.
    func close() async throws
}

// MARK: - Default Implementations

/// Default implementations for optional lifecycle methods.
/// Desktop-style usage can rely on these no-op defaults.
public extension GraphDB {
    func suspend() async throws {
        // Default: no-op for desktop-style usage
    }

    func resume() async throws {
        // Default: no-op for desktop-style usage
    }

    func onLowMemory() async throws {
        // Default: no-op for desktop-style usage
    }
}

// MARK: - Errors

/// Errors that can occur during GraphDB operations.
public enum GraphDBError: Error, LocalizedError {
    case notInitialized
    case alreadyClosed
    case queryFailed(underlying: Error)
    case mutationFailed(underlying: Error)
    case importFailed(underlying: Error)
    case exportFailed(underlying: Error)
    case backupFailed(underlying: Error)
    case restoreFailed(underlying: Error)
    case invalidPath(String)

    public var errorDescription: String? {
        switch self {
        case .notInitialized:
            return "Database has not been initialized"
        case .alreadyClosed:
            return "Database has already been closed"
        case .queryFailed(let error):
            return "Query failed: \(error.localizedDescription)"
        case .mutationFailed(let error):
            return "Mutation failed: \(error.localizedDescription)"
        case .importFailed(let error):
            return "Import failed: \(error.localizedDescription)"
        case .exportFailed(let error):
            return "Export failed: \(error.localizedDescription)"
        case .backupFailed(let error):
            return "Backup failed: \(error.localizedDescription)"
        case .restoreFailed(let error):
            return "Restore failed: \(error.localizedDescription)"
        case .invalidPath(let path):
            return "Invalid path: \(path)"
        }
    }
}
