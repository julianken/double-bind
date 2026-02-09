//
//  GraphDBError.swift
//  DoubleBindCore
//
//  CozoDB error types for the GraphDB interface.
//

import Foundation

/// Errors that can occur during GraphDB operations.
public enum GraphDBError: Error, LocalizedError, Sendable {
    /// Database initialization failed.
    case initializationFailed(underlying: Error)

    /// Query execution failed.
    case queryFailed(script: String, underlying: Error)

    /// Mutation execution failed.
    case mutationFailed(script: String, underlying: Error)

    /// JSON serialization of parameters failed.
    case parameterSerializationFailed(underlying: Error)

    /// JSON deserialization of results failed.
    case resultDeserializationFailed(underlying: Error)

    /// Import relations operation failed.
    case importFailed(underlying: Error)

    /// Export relations operation failed.
    case exportFailed(underlying: Error)

    /// Backup operation failed.
    case backupFailed(path: String, underlying: Error)

    /// Restore operation failed.
    case restoreFailed(path: String, underlying: Error)

    /// Import from backup operation failed.
    case importFromBackupFailed(path: String, underlying: Error)

    /// Database is closed and cannot perform operations.
    case databaseClosed

    /// Invalid engine type specified.
    case invalidEngine(engine: String)

    public var errorDescription: String? {
        switch self {
        case .initializationFailed(let underlying):
            return "Database initialization failed: \(underlying.localizedDescription)"
        case .queryFailed(let script, let underlying):
            return "Query failed for script '\(script.prefix(50))...': \(underlying.localizedDescription)"
        case .mutationFailed(let script, let underlying):
            return "Mutation failed for script '\(script.prefix(50))...': \(underlying.localizedDescription)"
        case .parameterSerializationFailed(let underlying):
            return "Failed to serialize parameters: \(underlying.localizedDescription)"
        case .resultDeserializationFailed(let underlying):
            return "Failed to deserialize results: \(underlying.localizedDescription)"
        case .importFailed(let underlying):
            return "Import relations failed: \(underlying.localizedDescription)"
        case .exportFailed(let underlying):
            return "Export relations failed: \(underlying.localizedDescription)"
        case .backupFailed(let path, let underlying):
            return "Backup to '\(path)' failed: \(underlying.localizedDescription)"
        case .restoreFailed(let path, let underlying):
            return "Restore from '\(path)' failed: \(underlying.localizedDescription)"
        case .importFromBackupFailed(let path, let underlying):
            return "Import from backup '\(path)' failed: \(underlying.localizedDescription)"
        case .databaseClosed:
            return "Database is closed and cannot perform operations"
        case .invalidEngine(let engine):
            return "Invalid engine type: '\(engine)'. Valid types are 'sqlite' or 'mem'"
        }
    }
}
