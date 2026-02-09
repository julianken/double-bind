/**
 * React Native native module that bridges JavaScript to CozoGraphDB.
 *
 * This module exposes all GraphDB methods to JavaScript with proper async/Promise
 * handling. All database operations use JSON serialization for data transfer.
 *
 * @see CozoGraphDB - The underlying Kotlin implementation wrapping CozoDB
 * @see GraphDB - TypeScript interface at packages/types/src/graph-db.ts
 */
package com.doublebind.core

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

/**
 * React Native module exposing CozoDB operations to JavaScript.
 *
 * All methods are asynchronous and use Promises for result handling.
 * Database operations run on IO dispatcher to avoid blocking the main thread.
 *
 * Usage from JavaScript:
 * ```typescript
 * import { NativeModules } from 'react-native';
 * const { CozoModule } = NativeModules;
 *
 * await CozoModule.initialize('/path/to/db');
 * const result = await CozoModule.run('?[x] := x = 1', '{}');
 * ```
 */
class CozoModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    /**
     * The underlying CozoGraphDB instance.
     * Null until initialize() is called.
     *
     * @Volatile ensures visibility across threads when accessed from coroutines.
     */
    @Volatile
    private var db: CozoGraphDB? = null

    /**
     * Coroutine scope for database operations.
     * Uses SupervisorJob to prevent cancellation propagation between operations.
     */
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    /**
     * Module name exposed to JavaScript via NativeModules.
     */
    override fun getName(): String = "CozoModule"

    // ─────────────────────────────────────────────────────────────────────────────
    // Helper Methods
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * Execute an async database operation with proper error handling and cancellation support.
     *
     * This helper reduces duplication across ReactMethod implementations by providing:
     * - Consistent promise resolution/rejection
     * - Proper coroutine cancellation handling
     * - Centralized error code management
     *
     * @param promise The React Native promise to resolve/reject
     * @param errorCode Error code to use when operation fails
     * @param requiresDb Whether the operation requires an initialized database
     * @param operation The suspend function to execute
     */
    private fun executeAsync(
        promise: Promise,
        errorCode: String,
        requiresDb: Boolean = true,
        operation: suspend (CozoGraphDB?) -> Any?
    ) {
        scope.launch {
            try {
                val database = db
                if (requiresDb && database == null) {
                    promise.reject("NOT_INITIALIZED", "Database not initialized. Call initialize() first.")
                    return@launch
                }
                val result = operation(database)
                promise.resolve(result)
            } catch (e: CancellationException) {
                // Re-throw cancellation to allow proper coroutine cancellation
                throw e
            } catch (e: Exception) {
                promise.reject(errorCode, e.message, e)
            }
        }
    }

    /**
     * Initialize the database with the given path.
     * Uses SQLite storage engine (recommended for mobile).
     *
     * @param path Absolute path to the database file
     * @param promise Resolves on success, rejects with INIT_ERROR on failure
     */
    @ReactMethod
    fun initialize(path: String, promise: Promise) {
        executeAsync(promise, "INIT_ERROR", requiresDb = false) { _ ->
            if (db != null) {
                throw IllegalStateException("Database already initialized. Call close() first.")
            }
            db = CozoGraphDB("sqlite", path)
            null
        }
    }

    /**
     * Close the database and release native resources.
     * Must be called when the database is no longer needed.
     *
     * @param promise Resolves on success, rejects with CLOSE_ERROR on failure
     */
    @ReactMethod
    fun close(promise: Promise) {
        executeAsync(promise, "CLOSE_ERROR", requiresDb = false) { _ ->
            db?.close()
            db = null
            null
        }
    }

    /**
     * Execute a Datalog query or mutation.
     *
     * @param script Datalog script to execute
     * @param params JSON string of named parameters (e.g., '{"name": "value"}')
     * @param promise Resolves with JSON result string, rejects with RUN_ERROR on failure
     */
    @ReactMethod
    fun run(script: String, params: String, promise: Promise) {
        executeAsync(promise, "RUN_ERROR") { database ->
            database!!.run(script, params)
        }
    }

    /**
     * Export data from specified relations.
     *
     * @param relations JSON array of relation names (e.g., '["pages", "blocks"]')
     * @param promise Resolves with JSON object mapping relation names to row arrays
     */
    @ReactMethod
    fun exportRelations(relations: String, promise: Promise) {
        executeAsync(promise, "EXPORT_ERROR") { database ->
            database!!.exportRelations(relations)
        }
    }

    /**
     * Import data into multiple relations at once.
     *
     * Note: Triggers are NOT executed for imported relations.
     * Use parameterized queries via run() if triggers must fire.
     *
     * @param data JSON object mapping relation names to row arrays
     * @param promise Resolves on success, rejects with IMPORT_ERROR on failure
     */
    @ReactMethod
    fun importRelations(data: String, promise: Promise) {
        executeAsync(promise, "IMPORT_ERROR") { database ->
            database!!.importRelations(data)
            null
        }
    }

    /**
     * Create a backup of the database at the specified path.
     * The backup format is SQLite regardless of the source engine.
     *
     * @param path File path for the backup
     * @param promise Resolves on success, rejects with BACKUP_ERROR on failure
     */
    @ReactMethod
    fun backup(path: String, promise: Promise) {
        executeAsync(promise, "BACKUP_ERROR") { database ->
            database!!.backup(path)
            null
        }
    }

    /**
     * Restore the database from a backup file.
     * The current database must be empty (no relations with data).
     *
     * @param path File path to the backup
     * @param promise Resolves on success, rejects with RESTORE_ERROR on failure
     */
    @ReactMethod
    fun restore(path: String, promise: Promise) {
        executeAsync(promise, "RESTORE_ERROR") { database ->
            database!!.restore(path)
            null
        }
    }

    /**
     * Import specific relations from a backup file.
     * Relations must already exist in the current database.
     *
     * Note: Triggers are NOT executed for imported relations.
     *
     * @param path File path to the backup
     * @param relations JSON array of relation names to import
     * @param promise Resolves on success, rejects with IMPORT_BACKUP_ERROR on failure
     */
    @ReactMethod
    fun importRelationsFromBackup(path: String, relations: String, promise: Promise) {
        executeAsync(promise, "IMPORT_BACKUP_ERROR") { database ->
            database!!.importRelationsFromBackup(path, relations)
            null
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Mobile Lifecycle Methods
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * Called when the app transitions to the background.
     * Flushes pending writes and prepares for suspension.
     *
     * Should be called during onPause/onStop.
     *
     * @param promise Resolves on success, rejects with SUSPEND_ERROR on failure
     */
    @ReactMethod
    fun suspend(promise: Promise) {
        executeAsync(promise, "SUSPEND_ERROR") { database ->
            database!!.suspend()
            null
        }
    }

    /**
     * Called when the app returns to the foreground.
     * Refreshes connections and validates database state.
     *
     * Should be called during onResume.
     *
     * @param promise Resolves on success, rejects with RESUME_ERROR on failure
     */
    @ReactMethod
    fun resume(promise: Promise) {
        executeAsync(promise, "RESUME_ERROR") { database ->
            database!!.resume()
            null
        }
    }

    /**
     * Called when the system signals memory pressure.
     * Releases non-essential caches and resources.
     *
     * Should be called during onTrimMemory with TRIM_MEMORY_RUNNING_LOW or higher.
     *
     * @param promise Resolves on success, rejects with LOW_MEMORY_ERROR on failure
     */
    @ReactMethod
    fun onLowMemory(promise: Promise) {
        executeAsync(promise, "LOW_MEMORY_ERROR") { database ->
            database!!.onLowMemory()
            null
        }
    }

    /**
     * Cleanup when the module is destroyed.
     * Cancels the coroutine scope and closes the database.
     */
    override fun invalidate() {
        scope.cancel()
        db?.close()
        db = null
        super.invalidate()
    }
}
