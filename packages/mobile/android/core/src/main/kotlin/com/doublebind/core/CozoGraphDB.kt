package com.doublebind.core

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.*
import org.cozodb.CozoDB

/**
 * CozoDB implementation of the GraphDB interface.
 *
 * This class wraps the native CozoDB Android binding and provides
 * a coroutine-friendly API that matches the GraphDB interface.
 *
 * Thread Safety: All database operations use Dispatchers.IO and are
 * protected by a mutex to ensure thread-safe access to the native database.
 *
 * Memory Management: The close() method MUST be called when done to
 * release native resources. Use Kotlin's `use {}` block or implement
 * proper lifecycle management.
 *
 * @param engine Storage engine: "mem" (testing), "sqlite" (mobile), "rocksdb" (desktop)
 * @param path Database file path (ignored for "mem" engine)
 */
class CozoGraphDB(
    engine: String = "mem",
    path: String = ""
) : GraphDB {

    private val db: CozoDB = try {
        if (engine == "mem" && path.isEmpty()) {
            CozoDB()
        } else {
            CozoDB(engine, path)
        }
    } catch (e: Exception) {
        throw DatabaseInitializationException(
            "Failed to initialize CozoDB with engine=$engine, path=$path",
            e
        )
    }

    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
    }

    private val mutex = Mutex()
    private var isClosed = false

    /**
     * Execute a read-only Datalog query.
     */
    @Suppress("UNCHECKED_CAST")
    override suspend fun <T> query(
        script: String,
        params: Map<String, Any?>
    ): QueryResult<T> = withContext(Dispatchers.IO) {
        mutex.withLock {
            ensureOpen()
            val paramsJson = encodeParams(params)
            val resultJson = db.run(script, paramsJson)
            parseQueryResult(resultJson)
        }
    }

    /**
     * Execute a mutation (insert, update, delete) operation.
     */
    override suspend fun mutate(
        script: String,
        params: Map<String, Any?>
    ): MutationResult = withContext(Dispatchers.IO) {
        mutex.withLock {
            ensureOpen()
            val paramsJson = encodeParams(params)
            val resultJson = db.run(script, paramsJson)
            parseMutationResult(resultJson)
        }
    }

    /**
     * Import data into multiple relations at once.
     */
    override suspend fun importRelations(
        data: Map<String, List<List<Any?>>>
    ) = withContext(Dispatchers.IO) {
        mutex.withLock {
            ensureOpen()
            val dataJson = encodeRelationsData(data)
            db.importRelations(dataJson)
        }
    }

    /**
     * Export data from specified relations.
     */
    override suspend fun exportRelations(
        relations: List<String>
    ): Map<String, List<List<Any?>>> = withContext(Dispatchers.IO) {
        mutex.withLock {
            ensureOpen()
            val relationsJson = json.encodeToString(
                JsonArray(relations.map { JsonPrimitive(it) })
            )
            val resultJson = db.exportRelations(relationsJson)
            parseExportResult(resultJson)
        }
    }

    /**
     * Create a backup of the database.
     */
    override suspend fun backup(path: String) = withContext(Dispatchers.IO) {
        mutex.withLock {
            ensureOpen()
            db.backup(path)
        }
    }

    /**
     * Restore the database from a backup file.
     */
    override suspend fun restore(path: String) = withContext(Dispatchers.IO) {
        mutex.withLock {
            ensureOpen()
            db.restore(path)
        }
    }

    /**
     * Import specific relations from a backup file.
     */
    override suspend fun importRelationsFromBackup(
        path: String,
        relations: List<String>
    ) = withContext(Dispatchers.IO) {
        mutex.withLock {
            ensureOpen()
            val relationsJson = json.encodeToString(
                JsonArray(relations.map { JsonPrimitive(it) })
            )
            db.importRelationsFromBackup(path, relationsJson)
        }
    }

    /**
     * Called when the app transitions to the background.
     * Flushes any pending writes to ensure data integrity.
     */
    override suspend fun suspend() = withContext(Dispatchers.IO) {
        mutex.withLock {
            if (!isClosed) {
                // CozoDB handles write durability internally
                // This is a no-op for in-memory databases
                // For SQLite, writes are already durable after each operation
            }
        }
    }

    /**
     * Called when the app returns to the foreground.
     * Validates database state and refreshes connections if needed.
     */
    override suspend fun resume() = withContext(Dispatchers.IO) {
        mutex.withLock {
            if (!isClosed) {
                // Verify database is still accessible with a simple query
                try {
                    db.run("?[] <- [[true]]", "{}")
                } catch (e: Exception) {
                    throw CozoException("Database validation failed on resume", e)
                }
            }
        }
    }

    /**
     * Called when the system signals memory pressure.
     * Releases non-essential caches and resources.
     */
    override suspend fun onLowMemory() = withContext(Dispatchers.IO) {
        mutex.withLock {
            if (!isClosed) {
                // CozoDB manages its own memory internally
                // For now, we just ensure any pending operations complete
                // Future: Could implement cache clearing if CozoDB exposes such API
            }
        }
    }

    /**
     * Close the database and release native resources.
     */
    override fun close() {
        if (!isClosed) {
            isClosed = true
            db.close()
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Private Helper Methods
    // ─────────────────────────────────────────────────────────────────────────────

    private fun ensureOpen() {
        if (isClosed) {
            throw DatabaseClosedException()
        }
    }

    private fun encodeParams(params: Map<String, Any?>): String {
        if (params.isEmpty()) return "{}"
        val jsonObject = buildJsonObject {
            params.forEach { (key, value) ->
                put(key, encodeValue(value))
            }
        }
        return json.encodeToString(jsonObject)
    }

    private fun encodeValue(value: Any?): JsonElement = when (value) {
        null -> JsonNull
        is Boolean -> JsonPrimitive(value)
        is Number -> JsonPrimitive(value)
        is String -> JsonPrimitive(value)
        is List<*> -> JsonArray(value.map { encodeValue(it) })
        is Map<*, *> -> buildJsonObject {
            value.forEach { (k, v) ->
                if (k is String) {
                    put(k, encodeValue(v))
                }
            }
        }
        else -> JsonPrimitive(value.toString())
    }

    private fun encodeRelationsData(data: Map<String, List<List<Any?>>>): String {
        val jsonObject = buildJsonObject {
            data.forEach { (relation, rows) ->
                put(relation, JsonArray(rows.map { row ->
                    JsonArray(row.map { encodeValue(it) })
                }))
            }
        }
        return json.encodeToString(jsonObject)
    }

    @Suppress("UNCHECKED_CAST")
    private fun <T> parseQueryResult(resultJson: String): QueryResult<T> {
        val jsonElement = json.parseToJsonElement(resultJson)
        val jsonObject = jsonElement.jsonObject

        // Check for error
        if (jsonObject.containsKey("ok") && jsonObject["ok"]?.jsonPrimitive?.boolean == false) {
            val message = jsonObject["message"]?.jsonPrimitive?.content ?: "Unknown error"
            throw CozoException(message)
        }

        val headers = jsonObject["headers"]?.jsonArray?.map {
            it.jsonPrimitive.content
        } ?: emptyList()

        val rows = jsonObject["rows"]?.jsonArray?.map { rowElement ->
            rowElement.jsonArray.map { cellElement ->
                parseJsonValue(cellElement)
            }
        } ?: emptyList()

        return QueryResult(
            headers = headers,
            rows = rows as List<List<T>>
        )
    }

    private fun parseMutationResult(resultJson: String): MutationResult {
        val jsonElement = json.parseToJsonElement(resultJson)
        val jsonObject = jsonElement.jsonObject

        // Check for error
        if (jsonObject.containsKey("ok") && jsonObject["ok"]?.jsonPrimitive?.boolean == false) {
            val message = jsonObject["message"]?.jsonPrimitive?.content ?: "Unknown error"
            throw CozoException(message)
        }

        val headers = jsonObject["headers"]?.jsonArray?.map {
            it.jsonPrimitive.content
        } ?: emptyList()

        val rows = jsonObject["rows"]?.jsonArray?.map { rowElement ->
            rowElement.jsonArray.map { cellElement ->
                parseJsonValue(cellElement)
            }
        } ?: emptyList()

        return MutationResult(headers = headers, rows = rows)
    }

    private fun parseExportResult(resultJson: String): Map<String, List<List<Any?>>> {
        val jsonElement = json.parseToJsonElement(resultJson)
        val jsonObject = jsonElement.jsonObject

        // Check for error
        if (jsonObject.containsKey("ok") && jsonObject["ok"]?.jsonPrimitive?.boolean == false) {
            val message = jsonObject["message"]?.jsonPrimitive?.content ?: "Unknown error"
            throw CozoException(message)
        }

        return jsonObject.mapValues { (_, value) ->
            value.jsonArray.map { rowElement ->
                rowElement.jsonArray.map { cellElement ->
                    parseJsonValue(cellElement)
                }
            }
        }
    }

    private fun parseJsonValue(element: JsonElement): Any? = when (element) {
        is JsonNull -> null
        is JsonPrimitive -> when {
            element.isString -> element.content
            element.booleanOrNull != null -> element.boolean
            element.intOrNull != null -> element.int
            element.longOrNull != null -> element.long
            element.doubleOrNull != null -> element.double
            else -> element.content
        }
        is JsonArray -> element.map { parseJsonValue(it) }
        is JsonObject -> element.mapValues { parseJsonValue(it.value) }
    }
}
