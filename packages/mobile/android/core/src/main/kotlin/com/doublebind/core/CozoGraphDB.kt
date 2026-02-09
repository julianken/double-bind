/**
 * CozoGraphDB - Android implementation of GraphDB using cozo_android.
 *
 * This class wraps the CozoDB native library for Android, providing
 * a coroutine-based async API that conforms to the GraphDB interface.
 *
 * Thread Safety:
 * - All database operations run on Dispatchers.IO
 * - The underlying CozoDB JNI layer is thread-safe
 * - Results are immutable after return
 *
 * Resource Management:
 * - MUST call close() when done with the database
 * - Use Kotlin's use {} block for automatic cleanup
 *
 * @see GraphDB
 */
package com.doublebind.core

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.*
import org.cozodb.CozoDB
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Exception thrown when database operations fail.
 *
 * @property message Human-readable error description
 * @property cause Underlying exception if available
 */
class CozoDBException(
    message: String,
    cause: Throwable? = null
) : Exception(message, cause)

/**
 * CozoDB implementation of GraphDB for Android.
 *
 * Example usage:
 * ```kotlin
 * val dbPath = context.filesDir.resolve("double-bind.db").absolutePath
 * CozoGraphDB(engine = "sqlite", path = dbPath).use { db ->
 *     val result = db.query<String>("?[x] := x = 'hello'")
 *     println(result.rows)
 * }
 * ```
 *
 * @param engine Storage engine: "sqlite" (recommended) or "mem" (testing)
 * @param path Path to the database file. Ignored for "mem" engine.
 * @throws CozoDBException if database initialization fails
 */
class CozoGraphDB(
    engine: String = "sqlite",
    path: String
) : GraphDB {

    private val db: CozoDB
    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
    }
    private val closed = AtomicBoolean(false)
    private val mutex = Mutex()

    init {
        try {
            db = CozoDB(engine, path)
        } catch (e: Exception) {
            throw CozoDBException("Failed to initialize CozoDB with engine=$engine, path=$path", e)
        }
    }

    /**
     * Ensures the database is still open.
     * @throws CozoDBException if the database has been closed
     */
    private fun ensureOpen() {
        if (closed.get()) {
            throw CozoDBException("Database has been closed")
        }
    }

    /**
     * Converts a Map to a JSON string for CozoDB parameters.
     */
    private fun encodeParams(params: Map<String, Any?>): String {
        val jsonObject = buildJsonObject {
            params.forEach { (key, value) ->
                put(key, encodeValue(value))
            }
        }
        return jsonObject.toString()
    }

    /**
     * Recursively encodes a value to JsonElement.
     */
    private fun encodeValue(value: Any?): JsonElement {
        return when (value) {
            null -> JsonNull
            is Boolean -> JsonPrimitive(value)
            is Number -> JsonPrimitive(value)
            is String -> JsonPrimitive(value)
            is List<*> -> buildJsonArray {
                value.forEach { add(encodeValue(it)) }
            }
            is Map<*, *> -> buildJsonObject {
                @Suppress("UNCHECKED_CAST")
                (value as Map<String, Any?>).forEach { (k, v) ->
                    put(k, encodeValue(v))
                }
            }
            else -> JsonPrimitive(value.toString())
        }
    }

    /**
     * Parses CozoDB JSON result into a QueryResult.
     */
    @Suppress("UNCHECKED_CAST")
    private fun <T> parseQueryResult(resultJson: String): QueryResult<T> {
        val jsonElement = json.parseToJsonElement(resultJson)
        val jsonObject = jsonElement.jsonObject

        // Check for errors
        if (jsonObject.containsKey("ok") && jsonObject["ok"]?.jsonPrimitive?.booleanOrNull == false) {
            val message = jsonObject["message"]?.jsonPrimitive?.contentOrNull ?: "Unknown error"
            throw CozoDBException(message)
        }

        val headers = jsonObject["headers"]?.jsonArray?.map {
            it.jsonPrimitive.content
        } ?: emptyList()

        val rows = jsonObject["rows"]?.jsonArray?.map { row ->
            row.jsonArray.map { cell ->
                jsonElementToValue(cell) as T
            }
        } ?: emptyList()

        return QueryResult(headers, rows)
    }

    /**
     * Parses CozoDB JSON result into a MutationResult.
     */
    private fun parseMutationResult(resultJson: String): MutationResult {
        val jsonElement = json.parseToJsonElement(resultJson)
        val jsonObject = jsonElement.jsonObject

        // Check for errors
        if (jsonObject.containsKey("ok") && jsonObject["ok"]?.jsonPrimitive?.booleanOrNull == false) {
            val message = jsonObject["message"]?.jsonPrimitive?.contentOrNull ?: "Unknown error"
            throw CozoDBException(message)
        }

        val headers = jsonObject["headers"]?.jsonArray?.map {
            it.jsonPrimitive.content
        } ?: emptyList()

        val rows = jsonObject["rows"]?.jsonArray?.map { row ->
            row.jsonArray.map { cell ->
                jsonElementToValue(cell)
            }
        } ?: emptyList()

        return MutationResult(headers, rows)
    }

    /**
     * Converts a JsonElement to its corresponding Kotlin value.
     */
    private fun jsonElementToValue(element: JsonElement): Any? {
        return when (element) {
            is JsonNull -> null
            is JsonPrimitive -> {
                when {
                    element.isString -> element.content
                    element.booleanOrNull != null -> element.boolean
                    element.longOrNull != null -> element.long
                    element.doubleOrNull != null -> element.double
                    else -> element.content
                }
            }
            is JsonArray -> element.map { jsonElementToValue(it) }
            is JsonObject -> element.mapValues { jsonElementToValue(it.value) }
        }
    }

    /**
     * Encodes a list of strings as a JSON array.
     */
    private fun encodeStringList(list: List<String>): String {
        return buildJsonArray {
            list.forEach { add(JsonPrimitive(it)) }
        }.toString()
    }

    /**
     * Encodes relation data for import.
     */
    private fun encodeRelationData(data: Map<String, List<List<Any?>>>): String {
        return buildJsonObject {
            data.forEach { (relationName, rows) ->
                put(relationName, buildJsonArray {
                    rows.forEach { row ->
                        add(buildJsonArray {
                            row.forEach { cell ->
                                add(encodeValue(cell))
                            }
                        })
                    }
                })
            }
        }.toString()
    }

    /**
     * Parses exported relation data.
     */
    private fun parseExportResult(resultJson: String): Map<String, List<List<Any?>>> {
        val jsonElement = json.parseToJsonElement(resultJson)
        val jsonObject = jsonElement.jsonObject

        // Check for errors
        if (jsonObject.containsKey("ok") && jsonObject["ok"]?.jsonPrimitive?.booleanOrNull == false) {
            val message = jsonObject["message"]?.jsonPrimitive?.contentOrNull ?: "Unknown error"
            throw CozoDBException(message)
        }

        val data = jsonObject["data"]?.jsonObject ?: return emptyMap()

        return data.mapValues { (_, value) ->
            val relationData = value.jsonObject
            val rows = relationData["rows"]?.jsonArray ?: return@mapValues emptyList()
            rows.map { row ->
                row.jsonArray.map { cell ->
                    jsonElementToValue(cell)
                }
            }
        }
    }

    override suspend fun <T> query(
        script: String,
        params: Map<String, Any?>
    ): QueryResult<T> = withContext(Dispatchers.IO) {
        mutex.withLock {
            ensureOpen()
            try {
                val paramsJson = encodeParams(params)
                val resultJson = db.run(script, paramsJson)
                parseQueryResult(resultJson)
            } catch (e: CozoDBException) {
                throw e
            } catch (e: Exception) {
                throw CozoDBException("Query failed: ${e.message}", e)
            }
        }
    }

    override suspend fun mutate(
        script: String,
        params: Map<String, Any?>
    ): MutationResult = withContext(Dispatchers.IO) {
        mutex.withLock {
            ensureOpen()
            try {
                val paramsJson = encodeParams(params)
                val resultJson = db.run(script, paramsJson)
                parseMutationResult(resultJson)
            } catch (e: CozoDBException) {
                throw e
            } catch (e: Exception) {
                throw CozoDBException("Mutation failed: ${e.message}", e)
            }
        }
    }

    override suspend fun importRelations(
        data: Map<String, List<List<Any?>>>
    ) = withContext(Dispatchers.IO) {
        mutex.withLock {
            ensureOpen()
            try {
                val dataJson = encodeRelationData(data)
                db.importRelations(dataJson)
            } catch (e: Exception) {
                throw CozoDBException("Import relations failed: ${e.message}", e)
            }
        }
    }

    override suspend fun exportRelations(
        relations: List<String>
    ): Map<String, List<List<Any?>>> = withContext(Dispatchers.IO) {
        mutex.withLock {
            ensureOpen()
            try {
                val relationsJson = encodeStringList(relations)
                val resultJson = db.exportRelations(relationsJson)
                parseExportResult(resultJson)
            } catch (e: CozoDBException) {
                throw e
            } catch (e: Exception) {
                throw CozoDBException("Export relations failed: ${e.message}", e)
            }
        }
    }

    override suspend fun backup(path: String) = withContext(Dispatchers.IO) {
        mutex.withLock {
            ensureOpen()
            try {
                db.backup(path)
            } catch (e: Exception) {
                throw CozoDBException("Backup failed: ${e.message}", e)
            }
        }
    }

    override suspend fun restore(path: String) = withContext(Dispatchers.IO) {
        mutex.withLock {
            ensureOpen()
            try {
                db.restore(path)
            } catch (e: Exception) {
                throw CozoDBException("Restore failed: ${e.message}", e)
            }
        }
    }

    override suspend fun importRelationsFromBackup(
        path: String,
        relations: List<String>
    ) = withContext(Dispatchers.IO) {
        mutex.withLock {
            ensureOpen()
            try {
                val relationsJson = encodeStringList(relations)
                db.importRelationsFromBackup(path, relationsJson)
            } catch (e: Exception) {
                throw CozoDBException("Import from backup failed: ${e.message}", e)
            }
        }
    }

    override suspend fun suspend() = withContext(Dispatchers.IO) {
        mutex.withLock {
            ensureOpen()
            // SQLite handles suspension gracefully; no explicit action needed
            // This method exists for consistency with the interface
        }
    }

    override suspend fun resume() = withContext(Dispatchers.IO) {
        mutex.withLock {
            ensureOpen()
            // SQLite handles resumption gracefully; no explicit action needed
            // This method exists for consistency with the interface
        }
    }

    override suspend fun onLowMemory() = withContext(Dispatchers.IO) {
        mutex.withLock {
            ensureOpen()
            // CozoDB manages its own memory; no explicit action needed
            // This method exists for consistency with the interface
        }
    }

    /**
     * Close the database and release native resources.
     *
     * CRITICAL: This method MUST be called when done with the database.
     * Failure to call close() will leak native memory and file handles.
     *
     * This method is idempotent - calling it multiple times is safe.
     */
    override fun close() {
        if (closed.compareAndSet(false, true)) {
            try {
                db.close()
            } catch (e: Exception) {
                // Log but don't throw - we're already closing
                // In production, this would be logged to a crash reporting service
            }
        }
    }
}
