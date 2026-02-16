//
//  DatabaseModule.swift
//  DoubleBindCore
//
//  React Native native module that provides database utilities for the mobile app.
//  With the migration to op-sqlite, this module only needs to provide the database path
//  since op-sqlite handles all database operations via JSI.
//

import Foundation
import React

/// React Native native module for database utilities.
/// Provides the database path for op-sqlite to use.
@objc(DatabaseModule)
final class DatabaseModule: NSObject {

    /// Get the default database path for the app.
    /// Returns the path to the app's Documents directory where the database should be stored.
    ///
    /// - Parameters:
    ///   - resolve: Promise resolve callback returning the database path
    ///   - reject: Promise reject callback
    @objc
    func getDatabasePath(
        _ resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        // Get the app's Documents directory
        guard let documentsPath = FileManager.default.urls(
            for: .documentDirectory,
            in: .userDomainMask
        ).first?.path else {
            reject(
                "ERR_NO_DOCUMENTS_DIR",
                "Failed to get documents directory path",
                nil
            )
            return
        }

        // Return the path to the database file
        let dbPath = (documentsPath as NSString).appendingPathComponent("double-bind.db")
        resolve(dbPath)
    }

    /// Ensure the database directory exists.
    /// Creates the parent directory for the database file if it doesn't exist.
    ///
    /// - Parameters:
    ///   - path: Path to the database file
    ///   - resolve: Promise resolve callback
    ///   - reject: Promise reject callback
    @objc
    func ensureDatabaseDirectory(
        _ path: String,
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        let directoryPath = (path as NSString).deletingLastPathComponent

        do {
            try FileManager.default.createDirectory(
                atPath: directoryPath,
                withIntermediateDirectories: true,
                attributes: nil
            )
            resolve(nil)
        } catch {
            reject(
                "ERR_CREATE_DIR",
                "Failed to create database directory at \(directoryPath): \(error.localizedDescription)",
                error
            )
        }
    }
}
