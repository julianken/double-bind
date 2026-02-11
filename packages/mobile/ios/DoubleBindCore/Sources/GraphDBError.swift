//
//  GraphDBError.swift
//  DoubleBindCore
//
//  CozoDB error types for the GraphDB interface.
//

import Foundation
import CozoSwiftBridge
import SwiftyJSON

/// Extracts a meaningful error message from CozoSwiftBridge errors.
/// CozoError.query contains a JSON with 'message' and 'display' fields that are otherwise lost.
private func extractCozoErrorMessage(_ error: Error) -> String {
    // Try to cast to CozoError and extract the actual message
    if let cozoError = error as? CozoError {
        switch cozoError {
        case .system(let message):
            return message
        case .query(let json):
            // CozoDB returns {ok: false, message: "...", display: "..."}
            let message = json["message"].stringValue
            let display = json["display"].stringValue
            if !message.isEmpty {
                return message
            }
            if !display.isEmpty {
                return display
            }
            // Fallback to raw JSON if no message found
            return json.rawString(.utf8, options: []) ?? "Unknown query error"
        @unknown default:
            return error.localizedDescription
        }
    }

    // Check if it's wrapped in NSError with underlying info
    let nsError = error as NSError
    if let underlyingError = nsError.userInfo[NSUnderlyingErrorKey] as? Error {
        return extractCozoErrorMessage(underlyingError)
    }

    // Check string description for CozoError patterns (fallback)
    let description = String(describing: error)
    if description.contains("CozoError") || description.contains("query(") {
        // Try to extract message from string representation
        if let messageRange = description.range(of: "message\" : \""),
           let endRange = description.range(of: "\"", range: messageRange.upperBound..<description.endIndex) {
            return String(description[messageRange.upperBound..<endRange.lowerBound])
        }
    }

    return error.localizedDescription
}

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
            return "Database initialization failed: \(extractCozoErrorMessage(underlying))"
        case .queryFailed(let script, let underlying):
            return "Query failed for script '\(script.prefix(50))...': \(extractCozoErrorMessage(underlying))"
        case .mutationFailed(let script, let underlying):
            return "Mutation failed for script '\(script.prefix(50))...': \(extractCozoErrorMessage(underlying))"
        case .parameterSerializationFailed(let underlying):
            return "Failed to serialize parameters: \(extractCozoErrorMessage(underlying))"
        case .resultDeserializationFailed(let underlying):
            return "Failed to deserialize results: \(extractCozoErrorMessage(underlying))"
        case .importFailed(let underlying):
            return "Import relations failed: \(extractCozoErrorMessage(underlying))"
        case .exportFailed(let underlying):
            return "Export relations failed: \(extractCozoErrorMessage(underlying))"
        case .backupFailed(let path, let underlying):
            return "Backup to '\(path)' failed: \(extractCozoErrorMessage(underlying))"
        case .restoreFailed(let path, let underlying):
            return "Restore from '\(path)' failed: \(extractCozoErrorMessage(underlying))"
        case .importFromBackupFailed(let path, let underlying):
            return "Import from backup '\(path)' failed: \(extractCozoErrorMessage(underlying))"
        case .databaseClosed:
            return "Database is closed and cannot perform operations"
        case .invalidEngine(let engine):
            return "Invalid engine type: '\(engine)'. Valid types are 'sqlite' or 'mem'"
        }
    }
}
