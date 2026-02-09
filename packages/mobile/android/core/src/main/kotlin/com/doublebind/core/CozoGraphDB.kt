/**
 * Kotlin wrapper around CozoDB for Android.
 *
 * This class implements the GraphDB interface, providing type-safe access to
 * CozoDB operations with proper resource management and JSON serialization.
 *
 * Uses the cozo_android library (io.github.cozodb:cozo_android) which provides
 * SQLite storage backend optimized for mobile devices.
 *
 * @see GraphDB - TypeScript interface at packages/types/src/graph-db.ts
 * @see mobile-database-strategy.md - Architecture documentation
 */
package com.doublebind.core

import org.cozodb.CozoDB
import java.io.Closeable

/**
 * Android implementation of CozoDB wrapper.
 *
 * Thread safety: All methods are thread-safe. The underlying CozoDB JNI calls
 * are thread-safe. Use with Kotlin coroutines on Dispatchers.IO for best performance.
 *
 * Resource management: MUST call close() when done. Use Kotlin's `use {}` block
 * or implement as a lifecycle-aware component.
 *
 * @param engine Storage engine: "sqlite" (recommended for mobile) or "mem"
 * @param path Path to the database file (ignored for "mem" engine)
 */
class CozoGraphDB(
    engine: String = "sqlite",
    path: String
) : Closeable {

    /**
     * The underlying CozoDB instance from cozo_android.
     */
    private val db: CozoDB = CozoDB(engine, path)

    /**
     * Flag indicating whether the database has been closed.
     */
    @Volatile
    private var isClosed: Boolean = false

    /**
     * Execute a Datalog query or mutation.
     *
     * @param script Datalog script to execute
     * @param params JSON string of named parameters
     * @return JSON string containing query results with headers and rows
     * @throws IllegalStateException if the database is closed
     * @throws CozoException on query execution errors
     */
    fun run(script: String, params: String = "{}"): String {
        checkNotClosed()
        return db.run(script, params)
    }

    /**
     * Export data from specified relations.
     *
     * @param relations JSON array string of relation names (e.g., '["pages", "blocks"]')
     * @return JSON object string mapping relation names to row arrays
     * @throws IllegalStateException if the database is closed
     */
    fun exportRelations(relations: String): String {
        checkNotClosed()
        return db.exportRelations(relations)
    }

    /**
     * Import data into multiple relations at once.
     *
     * Note: Triggers are NOT executed for imported relations.
     * Use parameterized queries via run() if triggers must fire.
     *
     * @param data JSON object string mapping relation names to row arrays
     * @throws IllegalStateException if the database is closed
     */
    fun importRelations(data: String) {
        checkNotClosed()
        db.importRelations(data)
    }

    /**
     * Create a backup of the database at the specified path.
     * The backup format is SQLite regardless of the source engine.
     *
     * @param path File path for the backup
     * @throws IllegalStateException if the database is closed
     */
    fun backup(path: String) {
        checkNotClosed()
        db.backup(path)
    }

    /**
     * Restore the database from a backup file.
     * The current database must be empty (no relations with data).
     *
     * @param path File path to the backup
     * @throws IllegalStateException if the database is closed
     */
    fun restore(path: String) {
        checkNotClosed()
        db.restore(path)
    }

    /**
     * Import specific relations from a backup file.
     * Relations must already exist in the current database.
     *
     * Note: Triggers are NOT executed for imported relations.
     *
     * @param path File path to the backup
     * @param relations JSON array string of relation names to import
     * @throws IllegalStateException if the database is closed
     */
    fun importRelationsFromBackup(path: String, relations: String) {
        checkNotClosed()
        db.importRelationsFromBackup(path, relations)
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Mobile Lifecycle Methods
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * Called when the app transitions to the background.
     * Flushes pending writes and prepares for suspension.
     *
     * For SQLite backend, this is handled gracefully by the engine.
     * This method exists for API consistency and potential future optimizations.
     *
     * @throws IllegalStateException if the database is closed
     */
    fun suspend() {
        checkNotClosed()
        // SQLite handles background transitions gracefully.
        // This is a no-op for now but provides a hook for future optimizations
        // such as flushing WAL or releasing file handles.
    }

    /**
     * Called when the app returns to the foreground.
     * Refreshes connections and validates database state.
     *
     * For SQLite backend, connections remain valid across suspend/resume.
     * This method exists for API consistency and potential future optimizations.
     *
     * @throws IllegalStateException if the database is closed
     */
    fun resume() {
        checkNotClosed()
        // SQLite connections remain valid across suspend/resume.
        // This is a no-op for now but provides a hook for future optimizations
        // such as reconnection or integrity checks.
    }

    /**
     * Called when the system signals memory pressure.
     * Releases non-essential caches and resources.
     *
     * CozoDB's Rust core manages its own memory. This method provides a hook
     * for future optimizations such as clearing query caches.
     *
     * @throws IllegalStateException if the database is closed
     */
    fun onLowMemory() {
        checkNotClosed()
        // CozoDB's Rust core manages its own memory efficiently.
        // This is a no-op for now but provides a hook for future optimizations
        // such as clearing query result caches or reducing buffer sizes.
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Resource Management
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * Close the database and release native resources.
     *
     * MUST be called when the database is no longer needed. Failure to call
     * close() will leak native memory and file handles.
     *
     * After calling close(), the instance is unusable and all subsequent
     * method calls will throw IllegalStateException.
     *
     * Safe to call multiple times (subsequent calls are no-ops).
     */
    override fun close() {
        if (!isClosed) {
            isClosed = true
            db.close()
        }
    }

    /**
     * Check if the database is closed and throw if so.
     *
     * @throws IllegalStateException if the database has been closed
     */
    private fun checkNotClosed() {
        if (isClosed) {
            throw IllegalStateException("Database has been closed")
        }
    }
}
