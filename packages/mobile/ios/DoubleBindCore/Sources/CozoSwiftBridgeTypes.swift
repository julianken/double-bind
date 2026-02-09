//
//  CozoSwiftBridgeTypes.swift
//  DoubleBindCore
//
//  Type definitions that mirror CozoSwiftBridge.
//  These are used when CozoSwiftBridge is not available (e.g., during development).
//
//  In production, import CozoSwiftBridge and remove this file,
//  or use conditional compilation to swap implementations.
//

#if !canImport(CozoSwiftBridge)

import Foundation

/// Type alias for JSON values in CozoDB.
/// In CozoSwiftBridge, this is typically a String containing JSON.
public typealias JSON = String

/// Represents a single row from a CozoDB query result.
/// Each row is a dictionary mapping column names to values.
public typealias NamedRow = [String: Any]

/// Mock CozoDB class for development without CozoSwiftBridge.
/// This allows the code to compile and be tested with mocks.
///
/// In production, replace with: `import CozoSwiftBridge`
public class CozoDB {
    private let engine: String
    private let path: String

    /// Initialize an in-memory database.
    public init() {
        self.engine = "mem"
        self.path = ""
    }

    /// Initialize a database with specified engine and path.
    ///
    /// - Parameters:
    ///   - kind: Engine type ("sqlite" or "mem")
    ///   - path: Path to database file
    public init(kind: String, path: String) throws {
        self.engine = kind
        self.path = path
        // In real implementation, this would initialize the native CozoDB
    }

    /// Run a query without parameters.
    ///
    /// - Parameter query: CozoScript query
    /// - Returns: Array of named rows
    public func run(_ query: String) throws -> [NamedRow] {
        // Stub implementation - real implementation calls native CozoDB
        fatalError("CozoSwiftBridge not available. Install via CocoaPods: pod 'CozoSwiftBridge', '~> 0.7.1'")
    }

    /// Run a query with parameters.
    ///
    /// - Parameters:
    ///   - query: CozoScript query
    ///   - params: JSON string containing parameters
    /// - Returns: Array of named rows
    public func run(_ query: String, params: JSON) throws -> [NamedRow] {
        // Stub implementation - real implementation calls native CozoDB
        fatalError("CozoSwiftBridge not available. Install via CocoaPods: pod 'CozoSwiftBridge', '~> 0.7.1'")
    }

    /// Export relations as JSON.
    ///
    /// - Parameter relations: Array of relation names to export
    /// - Returns: JSON string containing exported data
    public func exportRelations(relations: [String]) throws -> JSON {
        fatalError("CozoSwiftBridge not available. Install via CocoaPods: pod 'CozoSwiftBridge', '~> 0.7.1'")
    }

    /// Import data into relations.
    ///
    /// - Parameter data: JSON string containing data to import
    public func importRelations(data: JSON) throws {
        fatalError("CozoSwiftBridge not available. Install via CocoaPods: pod 'CozoSwiftBridge', '~> 0.7.1'")
    }

    /// Backup the database to a file.
    ///
    /// - Parameter path: Output file path
    public func backup(path: String) throws {
        fatalError("CozoSwiftBridge not available. Install via CocoaPods: pod 'CozoSwiftBridge', '~> 0.7.1'")
    }

    /// Restore the database from a backup.
    ///
    /// - Parameter path: Input file path
    public func restore(path: String) throws {
        fatalError("CozoSwiftBridge not available. Install via CocoaPods: pod 'CozoSwiftBridge', '~> 0.7.1'")
    }

    /// Import specific relations from a backup.
    ///
    /// - Parameters:
    ///   - path: Input file path
    ///   - relations: Array of relation names to import
    public func importRelationsFromBackup(path: String, relations: [String]) throws {
        fatalError("CozoSwiftBridge not available. Install via CocoaPods: pod 'CozoSwiftBridge', '~> 0.7.1'")
    }
}

#endif
