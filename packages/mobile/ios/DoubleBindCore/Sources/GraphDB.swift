//
//  GraphDB.swift
//  DoubleBindCore
//
//  Protocol definition for GraphDB, mirroring the TypeScript interface.
//  See: packages/types/src/graph-db.ts
//

import Foundation

/// Database interface for graph operations.
/// Abstracts CozoDB to allow mocking in tests and cross-platform
/// implementations (desktop, iOS, Android).
///
/// All implementations must be thread-safe. Query results should
/// be considered immutable after return.
public protocol GraphDB: AnyObject, Sendable {
    // MARK: - Core Operations

    /// Execute a read-only Datalog query.
    ///
    /// - Parameters:
    ///   - script: Datalog query script
    ///   - params: Optional named parameters for the query
    /// - Returns: Query results with headers and typed rows
    func query<T: Sendable>(
        _ script: String,
        params: [String: Any]?
    ) async throws -> QueryResult<T>

    /// Execute a mutation (insert, update, delete) operation.
    ///
    /// - Parameters:
    ///   - script: Datalog mutation script
    ///   - params: Optional named parameters for the mutation
    /// - Returns: Mutation result with operation metadata
    func mutate(
        _ script: String,
        params: [String: Any]?
    ) async throws -> MutationResult

    // MARK: - Data Transfer

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

    // MARK: - Backup and Restore

    /// Create a backup of the database at the specified path.
    /// The backup format is SQLite regardless of the source engine.
    ///
    /// - Parameter path: File path for the backup
    func backup(to path: String) async throws

    /// Restore the database from a backup file.
    /// The current database must be empty (no relations with data).
    ///
    /// The backup format is portable across storage engines:
    /// a RocksDB backup can be restored to SQLite and vice versa.
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

    // MARK: - Resource Management

    /// Close the database and release native resources.
    ///
    /// - Important: On mobile platforms (iOS, Android), this method MUST
    ///   be called when the database is no longer needed. Failure to call
    ///   close() will leak native memory and file handles.
    ///
    /// After calling close(), the GraphDB instance is unusable and
    /// all subsequent method calls will throw `GraphDBError.databaseClosed`.
    func close() async throws

    // MARK: - Mobile Lifecycle (Optional)

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

// MARK: - Default Implementations for Optional Methods

public extension GraphDB {
    /// Default implementation for suspend - no-op.
    func suspend() async throws {
        // Default: no-op for platforms that don't need lifecycle management
    }

    /// Default implementation for resume - no-op.
    func resume() async throws {
        // Default: no-op for platforms that don't need lifecycle management
    }

    /// Default implementation for onLowMemory - no-op.
    func onLowMemory() async throws {
        // Default: no-op for platforms that don't need memory management
    }
}
