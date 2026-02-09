package com.doublebind.core

import java.io.Closeable

/**
 * Result from a read-only query operation.
 * Headers contain column names, rows contain the data.
 */
data class QueryResult<T>(
    val headers: List<String>,
    val rows: List<List<T>>
)

/**
 * Result from a mutation operation (insert, update, delete).
 * Structure matches QueryResult but mutations typically return
 * operation metadata rather than domain data.
 */
data class MutationResult(
    val headers: List<String>,
    val rows: List<List<Any?>>
)

/**
 * Configuration for database initialization.
 * Platform implementations use this to create appropriate connections.
 */
data class GraphDBConfig(
    /**
     * Storage engine to use.
     * - "rocksdb": High-performance LSM-tree storage (desktop)
     * - "sqlite": Universal embedded storage (mobile, backup format)
     * - "mem": In-memory, non-persistent (testing)
     */
    val engine: String,

    /**
     * Path to the database file or directory.
     * Ignored for "mem" engine.
     */
    val path: String
)

/**
 * Database interface for graph operations.
 * Abstracts CozoDB to allow mocking in tests and cross-platform
 * implementations (desktop, iOS, Android).
 *
 * All implementations must be thread-safe. Query results should
 * be considered immutable after return.
 */
interface GraphDB : Closeable {
    /**
     * Execute a read-only Datalog query.
     *
     * @param script Datalog query script
     * @param params Optional named parameters for the query
     * @return Query results with headers and typed rows
     */
    suspend fun <T> query(script: String, params: Map<String, Any?> = emptyMap()): QueryResult<T>

    /**
     * Execute a mutation (insert, update, delete) operation.
     *
     * @param script Datalog mutation script
     * @param params Optional named parameters for the mutation
     * @return Mutation result with operation metadata
     */
    suspend fun mutate(script: String, params: Map<String, Any?> = emptyMap()): MutationResult

    /**
     * Import data into multiple relations at once.
     * Used for bulk imports and restoring from backup.
     *
     * Note: Triggers are NOT executed for imported relations.
     * Use parameterized queries if triggers must fire.
     *
     * @param data Map of relation names to row arrays
     */
    suspend fun importRelations(data: Map<String, List<List<Any?>>>)

    /**
     * Export data from specified relations.
     * Used for backup and data export features.
     *
     * @param relations Names of relations to export
     * @return Map of relation names to row arrays
     */
    suspend fun exportRelations(relations: List<String>): Map<String, List<List<Any?>>>

    /**
     * Create a backup of the database at the specified path.
     * The backup format is SQLite regardless of the source engine.
     *
     * @param path File path for the backup
     */
    suspend fun backup(path: String)

    /**
     * Restore the database from a backup file.
     * The current database must be empty (no relations with data).
     *
     * The backup format is portable across storage engines:
     * a RocksDB backup can be restored to SQLite and vice versa.
     *
     * @param path File path to the backup
     */
    suspend fun restore(path: String)

    /**
     * Import specific relations from a backup file.
     * Relations must already exist in the current database.
     *
     * Note: Triggers are NOT executed for imported relations.
     *
     * @param path File path to the backup
     * @param relations Names of relations to import
     */
    suspend fun importRelationsFromBackup(path: String, relations: List<String>)

    // ─────────────────────────────────────────────────────────────────────────────
    // Mobile Lifecycle Methods
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * Called when the app transitions to the background (mobile).
     * Implementations should flush pending writes and prepare for suspension.
     * This ensures data integrity if the OS terminates the app while backgrounded.
     *
     * Called during onPause/onStop on Android.
     */
    suspend fun suspend()

    /**
     * Called when the app returns to the foreground (mobile).
     * Implementations may refresh connections or validate database state.
     *
     * Called during onResume on Android.
     */
    suspend fun resume()

    /**
     * Called when the system signals memory pressure (mobile).
     * Implementations should release non-essential caches and resources.
     * This helps prevent the OS from terminating the app.
     *
     * Called during onTrimMemory with TRIM_MEMORY_RUNNING_LOW or higher.
     */
    suspend fun onLowMemory()

    /**
     * Close the database and release native resources.
     *
     * IMPORTANT: On mobile platforms (iOS, Android), this method MUST
     * be called when the database is no longer needed. Failure to call
     * close() will leak native memory and file handles.
     *
     * After calling close(), the GraphDB instance is unusable and
     * all subsequent method calls will throw.
     */
    override fun close()
}
