package com.doublebind.core

import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.test.runTest
import org.junit.jupiter.api.*
import org.junit.jupiter.api.io.TempDir
import java.io.File

/**
 * Unit tests for CozoGraphDB persistence operations.
 *
 * Tests cover:
 * - backup (database to file)
 * - restore (file to database)
 * - importRelationsFromBackup (selective restore)
 *
 * Note: These tests use temporary directories and SQLite-backed
 * databases since in-memory databases don't support file operations.
 */
@DisplayName("CozoGraphDB Persistence Operations")
class CozoGraphDBPersistenceTest {

    @TempDir
    lateinit var tempDir: File

    private lateinit var db: CozoGraphDB
    private lateinit var dbPath: String

    @BeforeEach
    fun setUp() {
        dbPath = File(tempDir, "test.db").absolutePath
        db = CozoGraphDB("mem", "")
    }

    @AfterEach
    fun tearDown() {
        db.close()
    }

    @Nested
    @DisplayName("Backup Operations")
    inner class BackupOperations {

        @Test
        @DisplayName("backup creates file")
        fun backupCreatesFile() = runTest {
            db.mutate(":create items { id: Int }")
            db.mutate("?[id] <- [[1], [2], [3]] :put items { id }")

            val backupPath = File(tempDir, "backup.db").absolutePath
            db.backup(backupPath)

            assertThat(File(backupPath).exists()).isTrue()
        }

        @Test
        @DisplayName("backup file contains data")
        fun backupContainsData() = runTest {
            db.mutate(":create items { id: Int, name: String }")
            db.mutate("?[id, name] <- [[1, \"Alice\"], [2, \"Bob\"]] :put items { id, name }")

            val backupPath = File(tempDir, "backup.db").absolutePath
            db.backup(backupPath)

            // Restore to new database to verify
            val newDb = CozoGraphDB("mem", "")
            try {
                newDb.mutate(":create items { id: Int, name: String }")
                newDb.restore(backupPath)

                val result = newDb.query<Any>("?[id, name] := *items{ id, name }")
                assertThat(result.rows).hasSize(2)
            } finally {
                newDb.close()
            }
        }

        @Test
        @DisplayName("backup overwrites existing file")
        fun backupOverwritesExisting() = runTest {
            val backupPath = File(tempDir, "backup.db").absolutePath

            // Create first backup
            db.mutate(":create items { id: Int }")
            db.mutate("?[id] <- [[1]] :put items { id }")
            db.backup(backupPath)

            // Create second backup with more data
            db.mutate("?[id] <- [[2], [3]] :put items { id }")
            db.backup(backupPath)

            // Verify second backup has all data
            val newDb = CozoGraphDB("mem", "")
            try {
                newDb.mutate(":create items { id: Int }")
                newDb.restore(backupPath)

                val result = newDb.query<Any>("?[count] := count = count(id), *items{ id }")
                assertThat(result.rows[0][0]).isEqualTo(3)
            } finally {
                newDb.close()
            }
        }

        @Test
        @DisplayName("backup includes multiple relations")
        fun backupIncludesMultipleRelations() = runTest {
            db.mutate(":create users { id: Int }")
            db.mutate(":create posts { id: Int }")
            db.mutate(":create comments { id: Int }")

            db.mutate("?[id] <- [[1], [2]] :put users { id }")
            db.mutate("?[id] <- [[1]] :put posts { id }")
            db.mutate("?[id] <- [[1], [2], [3]] :put comments { id }")

            val backupPath = File(tempDir, "backup.db").absolutePath
            db.backup(backupPath)

            val newDb = CozoGraphDB("mem", "")
            try {
                newDb.mutate(":create users { id: Int }")
                newDb.mutate(":create posts { id: Int }")
                newDb.mutate(":create comments { id: Int }")
                newDb.restore(backupPath)

                val users = newDb.query<Any>("?[count] := count = count(id), *users{ id }")
                val posts = newDb.query<Any>("?[count] := count = count(id), *posts{ id }")
                val comments = newDb.query<Any>("?[count] := count = count(id), *comments{ id }")

                assertThat(users.rows[0][0]).isEqualTo(2)
                assertThat(posts.rows[0][0]).isEqualTo(1)
                assertThat(comments.rows[0][0]).isEqualTo(3)
            } finally {
                newDb.close()
            }
        }
    }

    @Nested
    @DisplayName("Restore Operations")
    inner class RestoreOperations {

        @Test
        @DisplayName("restore loads data from backup")
        fun restoreLoadsData() = runTest {
            // Create backup
            db.mutate(":create items { id: Int, value: String }")
            db.mutate("?[id, value] <- [[1, \"test\"]] :put items { id, value }")

            val backupPath = File(tempDir, "backup.db").absolutePath
            db.backup(backupPath)

            // Restore to new database
            val newDb = CozoGraphDB("mem", "")
            try {
                newDb.mutate(":create items { id: Int, value: String }")
                newDb.restore(backupPath)

                val result = newDb.query<Any>("?[value] := *items{ id: 1, value }")
                assertThat(result.rows[0][0]).isEqualTo("test")
            } finally {
                newDb.close()
            }
        }

        @Test
        @DisplayName("restore to fresh database")
        fun restoreToFreshDb() = runTest {
            // Create backup with data
            db.mutate(":create rel_a { id: Int }")
            db.mutate(":create rel_b { id: Int }")
            db.mutate("?[id] <- [[1], [2]] :put rel_a { id }")
            db.mutate("?[id] <- [[10]] :put rel_b { id }")

            val backupPath = File(tempDir, "backup.db").absolutePath
            db.backup(backupPath)

            // Create new database and restore
            val newDb = CozoGraphDB("mem", "")
            try {
                // Create relations first (required before restore)
                newDb.mutate(":create rel_a { id: Int }")
                newDb.mutate(":create rel_b { id: Int }")

                newDb.restore(backupPath)

                val relA = newDb.query<Any>("?[id] := *rel_a{ id }")
                val relB = newDb.query<Any>("?[id] := *rel_b{ id }")

                assertThat(relA.rows).hasSize(2)
                assertThat(relB.rows).hasSize(1)
            } finally {
                newDb.close()
            }
        }

        @Test
        @DisplayName("restore preserves data types")
        fun restorePreservesTypes() = runTest {
            db.mutate(":create typed { id: Int, str: String, flt: Float, bool: Bool }")
            db.mutate("?[id, str, flt, bool] <- [[1, \"hello\", 3.14, true]] :put typed { id, str, flt, bool }")

            val backupPath = File(tempDir, "backup.db").absolutePath
            db.backup(backupPath)

            val newDb = CozoGraphDB("mem", "")
            try {
                newDb.mutate(":create typed { id: Int, str: String, flt: Float, bool: Bool }")
                newDb.restore(backupPath)

                val result = newDb.query<Any>("?[id, str, flt, bool] := *typed{ id, str, flt, bool }")
                val row = result.rows.first()

                assertThat(row[0]).isEqualTo(1)
                assertThat(row[1]).isEqualTo("hello")
                assertThat((row[2] as Number).toDouble()).isWithin(0.001).of(3.14)
                assertThat(row[3]).isEqualTo(true)
            } finally {
                newDb.close()
            }
        }
    }

    @Nested
    @DisplayName("Import Relations From Backup")
    inner class ImportRelationsFromBackup {

        @Test
        @DisplayName("imports specific relations from backup")
        fun importsSpecificRelations() = runTest {
            // Create backup with multiple relations
            db.mutate(":create users { id: Int }")
            db.mutate(":create posts { id: Int }")
            db.mutate(":create comments { id: Int }")

            db.mutate("?[id] <- [[1], [2]] :put users { id }")
            db.mutate("?[id] <- [[1]] :put posts { id }")
            db.mutate("?[id] <- [[1], [2], [3]] :put comments { id }")

            val backupPath = File(tempDir, "backup.db").absolutePath
            db.backup(backupPath)

            // Create new database and import only users
            val newDb = CozoGraphDB("mem", "")
            try {
                newDb.mutate(":create users { id: Int }")
                newDb.mutate(":create posts { id: Int }") // Empty
                newDb.mutate(":create comments { id: Int }") // Empty

                newDb.importRelationsFromBackup(backupPath, listOf("users"))

                val users = newDb.query<Any>("?[count] := count = count(id), *users{ id }")
                val posts = newDb.query<Any>("?[count] := count = count(id), *posts{ id }")
                val comments = newDb.query<Any>("?[count] := count = count(id), *comments{ id }")

                assertThat(users.rows[0][0]).isEqualTo(2) // Imported
                assertThat(posts.rows[0][0]).isEqualTo(0) // Not imported
                assertThat(comments.rows[0][0]).isEqualTo(0) // Not imported
            } finally {
                newDb.close()
            }
        }

        @Test
        @DisplayName("imports multiple specific relations")
        fun importsMultipleSpecificRelations() = runTest {
            db.mutate(":create a { id: Int }")
            db.mutate(":create b { id: Int }")
            db.mutate(":create c { id: Int }")

            db.mutate("?[id] <- [[1]] :put a { id }")
            db.mutate("?[id] <- [[1], [2]] :put b { id }")
            db.mutate("?[id] <- [[1], [2], [3]] :put c { id }")

            val backupPath = File(tempDir, "backup.db").absolutePath
            db.backup(backupPath)

            val newDb = CozoGraphDB("mem", "")
            try {
                newDb.mutate(":create a { id: Int }")
                newDb.mutate(":create b { id: Int }")
                newDb.mutate(":create c { id: Int }")

                newDb.importRelationsFromBackup(backupPath, listOf("a", "c"))

                val a = newDb.query<Any>("?[count] := count = count(id), *a{ id }")
                val b = newDb.query<Any>("?[count] := count = count(id), *b{ id }")
                val c = newDb.query<Any>("?[count] := count = count(id), *c{ id }")

                assertThat(a.rows[0][0]).isEqualTo(1) // Imported
                assertThat(b.rows[0][0]).isEqualTo(0) // Not imported
                assertThat(c.rows[0][0]).isEqualTo(3) // Imported
            } finally {
                newDb.close()
            }
        }

        @Test
        @DisplayName("import adds to existing data")
        fun importAddsToExisting() = runTest {
            db.mutate(":create items { id: Int }")
            db.mutate("?[id] <- [[1], [2]] :put items { id }")

            val backupPath = File(tempDir, "backup.db").absolutePath
            db.backup(backupPath)

            val newDb = CozoGraphDB("mem", "")
            try {
                newDb.mutate(":create items { id: Int }")
                // Add some existing data
                newDb.mutate("?[id] <- [[10]] :put items { id }")

                // Import from backup
                newDb.importRelationsFromBackup(backupPath, listOf("items"))

                val result = newDb.query<Any>("?[count] := count = count(id), *items{ id }")
                // Should have both existing (10) and imported (1, 2)
                assertThat(result.rows[0][0]).isEqualTo(3)
            } finally {
                newDb.close()
            }
        }
    }

    @Nested
    @DisplayName("Cross-Engine Compatibility")
    inner class CrossEngineCompatibility {

        @Test
        @DisplayName("mem backup can be restored to mem")
        fun memToMemBackup() = runTest {
            db.mutate(":create test { id: Int }")
            db.mutate("?[id] <- [[1], [2], [3]] :put test { id }")

            val backupPath = File(tempDir, "backup.db").absolutePath
            db.backup(backupPath)

            val newDb = CozoGraphDB("mem", "")
            try {
                newDb.mutate(":create test { id: Int }")
                newDb.restore(backupPath)

                val result = newDb.query<Any>("?[count] := count = count(id), *test{ id }")
                assertThat(result.rows[0][0]).isEqualTo(3)
            } finally {
                newDb.close()
            }
        }

        @Test
        @DisplayName("sqlite backup can be restored to mem")
        fun sqliteToMemBackup() = runTest {
            val sqlitePath = File(tempDir, "source.db").absolutePath
            val sqliteDb = CozoGraphDB("sqlite", sqlitePath)

            try {
                sqliteDb.mutate(":create test { id: Int }")
                sqliteDb.mutate("?[id] <- [[1], [2], [3]] :put test { id }")

                val backupPath = File(tempDir, "backup.db").absolutePath
                sqliteDb.backup(backupPath)

                // Restore to memory database
                val memDb = CozoGraphDB("mem", "")
                try {
                    memDb.mutate(":create test { id: Int }")
                    memDb.restore(backupPath)

                    val result = memDb.query<Any>("?[count] := count = count(id), *test{ id }")
                    assertThat(result.rows[0][0]).isEqualTo(3)
                } finally {
                    memDb.close()
                }
            } finally {
                sqliteDb.close()
            }
        }

        @Test
        @DisplayName("mem backup can be restored to sqlite")
        fun memToSqliteBackup() = runTest {
            db.mutate(":create test { id: Int }")
            db.mutate("?[id] <- [[1], [2], [3]] :put test { id }")

            val backupPath = File(tempDir, "backup.db").absolutePath
            db.backup(backupPath)

            // Restore to SQLite database
            val sqlitePath = File(tempDir, "target.db").absolutePath
            val sqliteDb = CozoGraphDB("sqlite", sqlitePath)
            try {
                sqliteDb.mutate(":create test { id: Int }")
                sqliteDb.restore(backupPath)

                val result = sqliteDb.query<Any>("?[count] := count = count(id), *test{ id }")
                assertThat(result.rows[0][0]).isEqualTo(3)
            } finally {
                sqliteDb.close()
            }
        }
    }
}
