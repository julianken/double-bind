/**
 * GraphDB interface for Android.
 *
 * This interface mirrors the TypeScript GraphDB interface from packages/types/src/graph-db.ts
 * to ensure cross-platform compatibility. The implementation uses CozoDB with SQLite storage.
 *
 * Thread Safety: All methods are suspend functions and should be called from a coroutine context.
 * Database operations are performed on Dispatchers.IO to avoid blocking the main thread.
 *
 * Resource Management: Implementations must call close() when the database is no longer needed
 * to release native resources. Use Kotlin's `use {}` block for automatic cleanup.
 */
package com.doublebind.core

import kotlinx.serialization.Serializable
import java.io.Closeable

/**
 * Result from a read-only query operation.
 * Headers contain column names, rows contain the data.
 */
@Serializable
data class QueryResult<T>(
    val headers: List<String>,
    val rows: List<List<T>>
)

/**
 * Result from a mutation operation (insert, update, delete).
 * Structure matches QueryResult but mutations typically return
 * operation metadata rather than domain data.
 */
@Serializable
data class MutationResult(
    val headers: List<String>,
    val rows: List<List<String>>
)

/**
 * Configuration for database initialization.
 * Platform implementations use this to create appropriate connections.
 */
@Serializable
data class GraphDBConfig(
    /**
     * Storage engine to use.
     * - "sqlite": Universal embedded storage (recommended for mobile)
     * - "mem": In-memory, non-persistent (testing)
     *
     * Note: RocksDB is not available on Android without custom NDK builds.
     */
    val engine: String,

    /**
     * Path to the database file.
     * Ignored for "mem" engine.
     */
    val path: String
)

/**
 * Database interface for graph operations.
 *
 * Abstracts CozoDB to allow mocking in tests and ensure cross-platform
 * compatibility (desktop, iOS, Android).
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
    suspend fun <T> query(
        script: String,
        params: Map<String, Any?> = emptyMap()
    ): QueryResult<T>

    /**
     * Execute a mutation (insert, update, delete) operation.
     *
     * @param script Datalog mutation script
     * @param params Optional named parameters for the mutation
     * @return Mutation result with operation metadata
     */
    suspend fun mutate(
        script: String,
        params: Map<String, Any?> = emptyMap()
    ): MutationResult

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
    // These methods support Android lifecycle events.
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * Called when the app transitions to the background.
     * Implementations should flush pending writes and prepare for suspension.
     * This ensures data integrity if the OS terminates the app while backgrounded.
     *
     * Called during onPause/onStop in Activity lifecycle.
     */
    suspend fun suspend()

    /**
     * Called when the app returns to the foreground.
     * Implementations may refresh connections or validate database state.
     *
     * Called during onResume in Activity lifecycle.
     */
    suspend fun resume()

    /**
     * Called when the system signals memory pressure.
     * Implementations should release non-essential caches and resources.
     * This helps prevent the OS from terminating the app.
     *
     * Called during onTrimMemory with TRIM_MEMORY_RUNNING_LOW or higher.
     */
    suspend fun onLowMemory()

    /**
     * Close the database and release native resources.
     *
     * IMPORTANT: This method MUST be called when the database is no longer needed.
     * Failure to call close() will leak native memory and file handles.
     *
     * After calling close(), the GraphDB instance is unusable and
     * all subsequent method calls will throw.
     */
    override fun close()
}
