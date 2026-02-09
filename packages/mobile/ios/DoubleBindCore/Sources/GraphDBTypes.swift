//
//  GraphDBTypes.swift
//  DoubleBindCore
//
//  Result types for GraphDB operations, matching the TypeScript interface.
//

import Foundation

/// Result from a read-only query operation.
/// Headers contain column names, rows contain the data.
public struct QueryResult<T>: Sendable where T: Sendable {
    /// Column names from the query result.
    public let headers: [String]

    /// Data rows, where each row is an array of values.
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
    /// Column names from the mutation result.
    public let headers: [String]

    /// Result rows containing operation metadata.
    public let rows: [[Any]]

    public init(headers: [String], rows: [[Any]]) {
        self.headers = headers
        self.rows = rows
    }
}

/// Configuration for database initialization.
/// Platform implementations use this to create appropriate connections.
public struct GraphDBConfig: Sendable {
    /// Storage engine to use.
    public enum Engine: String, Sendable {
        /// SQLite file storage (recommended for mobile).
        case sqlite

        /// In-memory, non-persistent (testing).
        case mem
    }

    /// The storage engine to use.
    public let engine: Engine

    /// Path to the database file.
    /// Ignored for 'mem' engine.
    public let path: String

    public init(engine: Engine, path: String) {
        self.engine = engine
        self.path = path
    }
}

// MARK: - Internal Result Parsing

/// Internal structure for parsing CozoDB query results.
/// CozoDB returns results in a specific JSON format that we need to parse.
internal struct CozoQueryResult: Decodable {
    let headers: [String]
    let rows: [[AnyCodable]]

    /// Indicates if the query was successful.
    let ok: Bool?

    /// Error message if the query failed.
    let message: String?

    enum CodingKeys: String, CodingKey {
        case headers
        case rows
        case ok
        case message
    }
}

/// A type-erased Codable wrapper for heterogeneous JSON values.
/// Used internally for parsing CozoDB results which can contain mixed types.
internal struct AnyCodable: Codable, Sendable {
    let value: Any

    init(_ value: Any) {
        self.value = value
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()

        if container.decodeNil() {
            self.value = NSNull()
        } else if let bool = try? container.decode(Bool.self) {
            self.value = bool
        } else if let int = try? container.decode(Int.self) {
            self.value = int
        } else if let double = try? container.decode(Double.self) {
            self.value = double
        } else if let string = try? container.decode(String.self) {
            self.value = string
        } else if let array = try? container.decode([AnyCodable].self) {
            self.value = array.map { $0.value }
        } else if let dictionary = try? container.decode([String: AnyCodable].self) {
            self.value = dictionary.mapValues { $0.value }
        } else {
            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Unable to decode value"
            )
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()

        switch value {
        case is NSNull:
            try container.encodeNil()
        case let bool as Bool:
            try container.encode(bool)
        case let int as Int:
            try container.encode(int)
        case let double as Double:
            try container.encode(double)
        case let string as String:
            try container.encode(string)
        case let array as [Any]:
            try container.encode(array.map { AnyCodable($0) })
        case let dictionary as [String: Any]:
            try container.encode(dictionary.mapValues { AnyCodable($0) })
        default:
            throw EncodingError.invalidValue(
                value,
                EncodingError.Context(
                    codingPath: encoder.codingPath,
                    debugDescription: "Unable to encode value of type \(type(of: value))"
                )
            )
        }
    }
}
