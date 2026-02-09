// GraphDB.swift
// DoubleBindCore
//
// Protocol definition for graph database operations.
// Mirrors the TypeScript GraphDB interface from packages/types/src/graph-db.ts

import Foundation

// MARK: - Result Types

/// Result from a read-only query operation.
/// Headers contain column names, rows contain the data.
public struct QueryResult<T>: Sendable where T: Sendable {
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
public struct MutationResult: Sendable {
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
public struct GraphDBConfig: Sendable {
    /// Storage engine to use.
    /// - 'rocksdb': High-performance LSM-tree storage (desktop only)
    /// - 'sqlite': Universal embedded storage (mobile, backup format)
    /// - 'mem': In-memory, non-persistent (testing)
    public enum Engine: String, Sendable {
        case rocksdb
        case sqlite
        case mem
    }

    public let engine: Engine
    public let path: String

    public init(engine: Engine, path: String) {
        self.engine = engine
        self.path = path
    }
}

// MARK: - Errors

/// Errors that can occur during graph database operations.
public enum GraphDBError: Error, Equatable {
    /// The database has been closed and cannot be used.
    case databaseClosed

    /// Invalid query syntax or execution error.
    case queryError(String)

    /// Error during data import.
    case importError(String)

    /// Error during data export.
    case exportError(String)

    /// Error during backup operation.
    case backupError(String)

    /// Error during restore operation.
    case restoreError(String)

    /// Invalid configuration.
    case configurationError(String)

    /// File system error.
    case fileSystemError(String)
}

// MARK: - Protocol

/// Database interface for graph operations.
/// Abstracts CozoDB to allow mocking in tests and cross-platform
/// implementations (desktop, iOS, Android).
///
/// All implementations must be thread-safe. Query results should
/// be considered immutable after return.
public protocol GraphDB: AnyObject, Sendable {
    /// Execute a read-only Datalog query.
    ///
    /// - Parameters:
    ///   - script: Datalog query script
    ///   - params: Optional named parameters for the query
    /// - Returns: Query results with headers and typed rows
    func query<T>(_ script: String, params: [String: Any]?) async throws -> QueryResult<T>

    /// Execute a mutation (insert, update, delete) operation.
    ///
    /// - Parameters:
    ///   - script: Datalog mutation script
    ///   - params: Optional named parameters for the mutation
    /// - Returns: Mutation result with operation metadata
    func mutate(_ script: String, params: [String: Any]?) async throws -> MutationResult

    /// Import data into multiple relations at once.
    /// Used for bulk imports and restoring from backup.
    ///
    /// - Note: Triggers are NOT executed for imported relations.
    ///   Use parameterized queries if triggers must fire.
    ///
    /// - Parameter data: Map of relation names to row arrays
    func importRelations(_ data: [String: [[Any]]]) async throws

    /// Export data from specified relations.
    /// Used for backup and data export features.
    ///
    /// - Parameter relations: Names of relations to export
    /// - Returns: Map of relation names to row arrays
    func exportRelations(_ relations: [String]) async throws -> [String: [[Any]]]

    /// Create a backup of the database at the specified path.
    /// The backup format is SQLite regardless of the source engine.
    ///
    /// - Parameter path: File path for the backup
    func backup(to path: String) async throws

    /// Restore the database from a backup file.
    /// The current database must be empty (no relations with data).
    ///
    /// - Parameter path: File path to the backup
    func restore(from path: String) async throws

    /// Import specific relations from a backup file.
    /// Relations must already exist in the current database.
    ///
    /// - Note: Triggers are NOT executed for imported relations.
    ///
    /// - Parameters:
    ///   - path: File path to the backup
    ///   - relations: Names of relations to import
    func importRelationsFromBackup(path: String, relations: [String]) async throws

    /// Close the database and release native resources.
    ///
    /// - Important: On mobile platforms (iOS, Android), this method MUST
    ///   be called when the database is no longer needed. Failure to call
    ///   close() will leak native memory and file handles.
    ///
    /// After calling close(), the GraphDB instance is unusable and
    /// all subsequent method calls will throw.
    func close() async throws

    // MARK: - Mobile Lifecycle Methods

    /// Called when the app transitions to the background (mobile).
    /// Implementations should flush pending writes and prepare for suspension.
    /// This ensures data integrity if the OS terminates the app while backgrounded.
    ///
    /// - Note: iOS: Called during applicationDidEnterBackground
    func suspend() async throws

    /// Called when the app returns to the foreground (mobile).
    /// Implementations may refresh connections or validate database state.
    ///
    /// - Note: iOS: Called during applicationWillEnterForeground
    func resume() async throws

    /// Called when the system signals memory pressure (mobile).
    /// Implementations should release non-essential caches and resources.
    /// This helps prevent the OS from terminating the app.
    ///
    /// - Note: iOS: Called during applicationDidReceiveMemoryWarning
    func onLowMemory() async throws
}

// MARK: - Default Implementations

public extension GraphDB {
    /// Convenience method for query without parameters.
    func query<T>(_ script: String) async throws -> QueryResult<T> {
        try await query(script, params: nil)
    }

    /// Convenience method for mutate without parameters.
    func mutate(_ script: String) async throws -> MutationResult {
        try await mutate(script, params: nil)
    }
}
