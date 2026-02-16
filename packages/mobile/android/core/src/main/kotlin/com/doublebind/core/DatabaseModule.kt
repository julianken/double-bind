/**
 * React Native native module that provides database utilities for the mobile app.
 *
 * With the migration to op-sqlite, this module only needs to provide the database path
 * since op-sqlite handles all database operations via JSI.
 */
package com.doublebind.core

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File

/**
 * React Native module providing database utilities.
 * Provides the database path for op-sqlite to use.
 */
class DatabaseModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    /**
     * Module name exposed to JavaScript via NativeModules.
     */
    override fun getName(): String = "DatabaseModule"

    /**
     * Get the default database path for the app.
     * Returns the path to the app's databases directory where the database should be stored.
     *
     * @param promise Resolves with the database path, rejects on error
     */
    @ReactMethod
    fun getDatabasePath(promise: Promise) {
        try {
            val context = reactApplicationContext
            val databasesDir = context.getDatabasePath("dummy").parentFile
                ?: throw IllegalStateException("Failed to get databases directory")

            // Ensure the databases directory exists
            if (!databasesDir.exists()) {
                databasesDir.mkdirs()
            }

            val dbPath = File(databasesDir, "double-bind.db").absolutePath
            promise.resolve(dbPath)
        } catch (e: Exception) {
            promise.reject("ERR_GET_PATH", "Failed to get database path: ${e.message}", e)
        }
    }

    /**
     * Ensure the database directory exists.
     * Creates the parent directory for the database file if it doesn't exist.
     *
     * @param path Path to the database file
     * @param promise Resolves on success, rejects with error on failure
     */
    @ReactMethod
    fun ensureDatabaseDirectory(path: String, promise: Promise) {
        try {
            val file = File(path)
            val parentDir = file.parentFile
                ?: throw IllegalArgumentException("Invalid database path: $path")

            if (!parentDir.exists()) {
                if (!parentDir.mkdirs()) {
                    throw IllegalStateException("Failed to create directory: ${parentDir.absolutePath}")
                }
            }

            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("ERR_CREATE_DIR", "Failed to create database directory: ${e.message}", e)
        }
    }
}
