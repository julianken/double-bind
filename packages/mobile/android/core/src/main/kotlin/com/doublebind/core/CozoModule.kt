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
     */
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

    /**
     * Initialize the database with the given path.
     * Uses SQLite storage engine (recommended for mobile).
     *
     * @param path Absolute path to the database file
     * @param promise Resolves on success, rejects with INIT_ERROR on failure
     */
    @ReactMethod
    fun initialize(path: String, promise: Promise) {
        scope.launch {
            try {
                if (db != null) {
                    promise.reject("ALREADY_INITIALIZED", "Database already initialized. Call close() first.")
                    return@launch
                }
                db = CozoGraphDB("sqlite", path)
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject("INIT_ERROR", e.message, e)
            }
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
        scope.launch {
            try {
                db?.close()
                db = null
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject("CLOSE_ERROR", e.message, e)
            }
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
        scope.launch {
            try {
                val database = db ?: run {
                    promise.reject("NOT_INITIALIZED", "Database not initialized. Call initialize() first.")
                    return@launch
                }
                val result = database.run(script, params)
                promise.resolve(result)
            } catch (e: Exception) {
                promise.reject("RUN_ERROR", e.message, e)
            }
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
        scope.launch {
            try {
                val database = db ?: run {
                    promise.reject("NOT_INITIALIZED", "Database not initialized. Call initialize() first.")
                    return@launch
                }
                val result = database.exportRelations(relations)
                promise.resolve(result)
            } catch (e: Exception) {
                promise.reject("EXPORT_ERROR", e.message, e)
            }
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
        scope.launch {
            try {
                val database = db ?: run {
                    promise.reject("NOT_INITIALIZED", "Database not initialized. Call initialize() first.")
                    return@launch
                }
                database.importRelations(data)
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject("IMPORT_ERROR", e.message, e)
            }
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
        scope.launch {
            try {
                val database = db ?: run {
                    promise.reject("NOT_INITIALIZED", "Database not initialized. Call initialize() first.")
                    return@launch
                }
                database.backup(path)
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject("BACKUP_ERROR", e.message, e)
            }
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
        scope.launch {
            try {
                val database = db ?: run {
                    promise.reject("NOT_INITIALIZED", "Database not initialized. Call initialize() first.")
                    return@launch
                }
                database.restore(path)
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject("RESTORE_ERROR", e.message, e)
            }
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
        scope.launch {
            try {
                val database = db ?: run {
                    promise.reject("NOT_INITIALIZED", "Database not initialized. Call initialize() first.")
                    return@launch
                }
                database.importRelationsFromBackup(path, relations)
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject("IMPORT_BACKUP_ERROR", e.message, e)
            }
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
        scope.launch {
            try {
                val database = db ?: run {
                    promise.reject("NOT_INITIALIZED", "Database not initialized. Call initialize() first.")
                    return@launch
                }
                database.suspend()
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject("SUSPEND_ERROR", e.message, e)
            }
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
        scope.launch {
            try {
                val database = db ?: run {
                    promise.reject("NOT_INITIALIZED", "Database not initialized. Call initialize() first.")
                    return@launch
                }
                database.resume()
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject("RESUME_ERROR", e.message, e)
            }
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
        scope.launch {
            try {
                val database = db ?: run {
                    promise.reject("NOT_INITIALIZED", "Database not initialized. Call initialize() first.")
                    return@launch
                }
                database.onLowMemory()
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject("LOW_MEMORY_ERROR", e.message, e)
            }
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
