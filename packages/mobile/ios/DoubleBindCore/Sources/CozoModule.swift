//
//  CozoModule.swift
//  DoubleBindCore
//
//  React Native native module that bridges JavaScript to the CozoGraphDB implementation.
//  Exposes all GraphDB methods to JavaScript with proper async/Promise handling.
//

import Foundation
import React

/// React Native native module for CozoDB database operations.
/// This module wraps CozoGraphDB and exposes its methods to JavaScript.
///
/// All methods use Promise-based async patterns for React Native compatibility.
/// Data is transferred as JSON strings to avoid React Native bridge serialization issues.
@objc(CozoModule)
final class CozoModule: NSObject {

    // MARK: - Properties

    /// The underlying CozoGraphDB instance.
    /// Initialized via `initialize()` and released via `close()`.
    private var db: CozoGraphDB?

    /// Lock for thread-safe access to the db property.
    private let lock = NSLock()

    // MARK: - Error Codes

    /// Error codes returned to JavaScript
    private enum ErrorCode: String {
        case notInitialized = "ERR_NOT_INITIALIZED"
        case initializationFailed = "ERR_INITIALIZATION_FAILED"
        case queryFailed = "ERR_QUERY_FAILED"
        case exportFailed = "ERR_EXPORT_FAILED"
        case importFailed = "ERR_IMPORT_FAILED"
        case backupFailed = "ERR_BACKUP_FAILED"
        case restoreFailed = "ERR_RESTORE_FAILED"
        case importFromBackupFailed = "ERR_IMPORT_FROM_BACKUP_FAILED"
        case closeFailed = "ERR_CLOSE_FAILED"
        case lifecycleFailed = "ERR_LIFECYCLE_FAILED"
    }

    // MARK: - Initialization

    /// Initialize the database with the specified path.
    /// Uses SQLite storage engine for mobile.
    ///
    /// - Parameters:
    ///   - path: Absolute path to the database file
    ///   - resolve: Promise resolve callback
    ///   - reject: Promise reject callback with error code, message, and optional error
    @objc
    func initialize(
        _ path: String,
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        Task {
            lock.lock()
            defer { lock.unlock() }

            // Close existing database if any
            if let existingDb = db {
                try? await existingDb.close()
                db = nil
            }

            do {
                db = try CozoGraphDB(engine: "sqlite", path: path)
                resolve(nil)
            } catch {
                reject(
                    ErrorCode.initializationFailed.rawValue,
                    "Failed to initialize database at \(path): \(error.localizedDescription)",
                    error
                )
            }
        }
    }

    /// Close the database and release all resources.
    ///
    /// - Parameters:
    ///   - resolve: Promise resolve callback
    ///   - reject: Promise reject callback
    @objc
    func close(
        _ resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        Task {
            lock.lock()
            defer { lock.unlock() }

            guard let currentDb = db else {
                resolve(nil)
                return
            }

            do {
                try await currentDb.close()
                db = nil
                resolve(nil)
            } catch {
                reject(
                    ErrorCode.closeFailed.rawValue,
                    "Failed to close database: \(error.localizedDescription)",
                    error
                )
            }
        }
    }

    // MARK: - Core Operations

    /// Execute a Datalog script (query or mutation).
    ///
    /// - Parameters:
    ///   - script: The Datalog script to execute
    ///   - params: JSON string of query parameters
    ///   - resolve: Promise resolve callback returning JSON result string
    ///   - reject: Promise reject callback
    @objc
    func run(
        _ script: String,
        params: String,
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        Task {
            guard let currentDb = getDb() else {
                reject(
                    ErrorCode.notInitialized.rawValue,
                    "Database not initialized. Call initialize() first.",
                    nil
                )
                return
            }

            do {
                let result = try await currentDb.run(script, params: params)
                resolve(result)
            } catch {
                reject(
                    ErrorCode.queryFailed.rawValue,
                    "Query failed: \(error.localizedDescription)",
                    error
                )
            }
        }
    }

    /// Export specified relations as JSON.
    ///
    /// - Parameters:
    ///   - relations: JSON array string of relation names
    ///   - resolve: Promise resolve callback returning JSON result string
    ///   - reject: Promise reject callback
    @objc
    func exportRelations(
        _ relations: String,
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        Task {
            guard let currentDb = getDb() else {
                reject(
                    ErrorCode.notInitialized.rawValue,
                    "Database not initialized. Call initialize() first.",
                    nil
                )
                return
            }

            do {
                let result = try await currentDb.exportRelations(relations)
                resolve(result)
            } catch {
                reject(
                    ErrorCode.exportFailed.rawValue,
                    "Export relations failed: \(error.localizedDescription)",
                    error
                )
            }
        }
    }

    /// Import data into relations from JSON.
    ///
    /// - Parameters:
    ///   - data: JSON object string mapping relation names to row arrays
    ///   - resolve: Promise resolve callback
    ///   - reject: Promise reject callback
    @objc
    func importRelations(
        _ data: String,
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        Task {
            guard let currentDb = getDb() else {
                reject(
                    ErrorCode.notInitialized.rawValue,
                    "Database not initialized. Call initialize() first.",
                    nil
                )
                return
            }

            do {
                try await currentDb.importRelations(data)
                resolve(nil)
            } catch {
                reject(
                    ErrorCode.importFailed.rawValue,
                    "Import relations failed: \(error.localizedDescription)",
                    error
                )
            }
        }
    }

    // MARK: - Backup and Restore

    /// Create a backup of the database.
    ///
    /// - Parameters:
    ///   - path: File path for the backup
    ///   - resolve: Promise resolve callback
    ///   - reject: Promise reject callback
    @objc
    func backup(
        _ path: String,
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        Task {
            guard let currentDb = getDb() else {
                reject(
                    ErrorCode.notInitialized.rawValue,
                    "Database not initialized. Call initialize() first.",
                    nil
                )
                return
            }

            do {
                try await currentDb.backup(to: path)
                resolve(nil)
            } catch {
                reject(
                    ErrorCode.backupFailed.rawValue,
                    "Backup failed: \(error.localizedDescription)",
                    error
                )
            }
        }
    }

    /// Restore the database from a backup file.
    ///
    /// - Parameters:
    ///   - path: File path to the backup
    ///   - resolve: Promise resolve callback
    ///   - reject: Promise reject callback
    @objc
    func restore(
        _ path: String,
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        Task {
            guard let currentDb = getDb() else {
                reject(
                    ErrorCode.notInitialized.rawValue,
                    "Database not initialized. Call initialize() first.",
                    nil
                )
                return
            }

            do {
                try await currentDb.restore(from: path)
                resolve(nil)
            } catch {
                reject(
                    ErrorCode.restoreFailed.rawValue,
                    "Restore failed: \(error.localizedDescription)",
                    error
                )
            }
        }
    }

    /// Import specific relations from a backup file.
    ///
    /// - Parameters:
    ///   - path: File path to the backup
    ///   - relations: JSON array string of relation names to import
    ///   - resolve: Promise resolve callback
    ///   - reject: Promise reject callback
    @objc
    func importRelationsFromBackup(
        _ path: String,
        relations: String,
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        Task {
            guard let currentDb = getDb() else {
                reject(
                    ErrorCode.notInitialized.rawValue,
                    "Database not initialized. Call initialize() first.",
                    nil
                )
                return
            }

            do {
                try await currentDb.importRelationsFromBackup(path: path, relations: relations)
                resolve(nil)
            } catch {
                reject(
                    ErrorCode.importFromBackupFailed.rawValue,
                    "Import from backup failed: \(error.localizedDescription)",
                    error
                )
            }
        }
    }

    // MARK: - Mobile Lifecycle

    /// Called when app transitions to background.
    ///
    /// - Parameters:
    ///   - resolve: Promise resolve callback
    ///   - reject: Promise reject callback
    @objc
    func suspend(
        _ resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        Task {
            guard let currentDb = getDb() else {
                // Not initialized is OK for lifecycle methods
                resolve(nil)
                return
            }

            do {
                try await currentDb.suspend()
                resolve(nil)
            } catch {
                reject(
                    ErrorCode.lifecycleFailed.rawValue,
                    "Suspend failed: \(error.localizedDescription)",
                    error
                )
            }
        }
    }

    /// Called when app returns to foreground.
    ///
    /// - Parameters:
    ///   - resolve: Promise resolve callback
    ///   - reject: Promise reject callback
    @objc
    func resume(
        _ resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        Task {
            guard let currentDb = getDb() else {
                // Not initialized is OK for lifecycle methods
                resolve(nil)
                return
            }

            do {
                try await currentDb.resume()
                resolve(nil)
            } catch {
                reject(
                    ErrorCode.lifecycleFailed.rawValue,
                    "Resume failed: \(error.localizedDescription)",
                    error
                )
            }
        }
    }

    /// Called when system signals memory pressure.
    ///
    /// - Parameters:
    ///   - resolve: Promise resolve callback
    ///   - reject: Promise reject callback
    @objc
    func onLowMemory(
        _ resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        Task {
            guard let currentDb = getDb() else {
                // Not initialized is OK for lifecycle methods
                resolve(nil)
                return
            }

            do {
                try await currentDb.onLowMemory()
                resolve(nil)
            } catch {
                reject(
                    ErrorCode.lifecycleFailed.rawValue,
                    "onLowMemory failed: \(error.localizedDescription)",
                    error
                )
            }
        }
    }

    // MARK: - Private Helpers

    /// Thread-safe access to the database instance.
    private func getDb() -> CozoGraphDB? {
        lock.lock()
        defer { lock.unlock() }
        return db
    }
}
