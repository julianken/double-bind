package com.doublebind.core

import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.test.runTest
import org.junit.jupiter.api.*
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.io.TempDir
import java.io.File

/**
 * Unit tests for CozoGraphDB lifecycle operations.
 *
 * Tests cover:
 * - close (resource cleanup)
 * - suspend (background transition)
 * - resume (foreground transition)
 * - onLowMemory (memory pressure handling)
 */
@DisplayName("CozoGraphDB Lifecycle Operations")
class CozoGraphDBLifecycleTest {

    @TempDir
    lateinit var tempDir: File

    @Nested
    @DisplayName("Close Operations")
    inner class CloseOperations {

        @Test
        @DisplayName("close releases resources")
        fun closeReleasesResources() = runTest {
            val db = CozoGraphDB("mem", "")
            db.mutate(":create test { id: Int }")
            db.mutate("?[id] <- [[1]] :put test { id }")

            db.close()

            // After close, operations should fail
            assertThrows<DatabaseClosedException> {
                db.query<Any>("?[id] := *test{ id }")
            }
        }

        @Test
        @DisplayName("mutate after close throws DatabaseClosedException")
        fun mutateAfterCloseThrows() = runTest {
            val db = CozoGraphDB("mem", "")
            db.close()

            assertThrows<DatabaseClosedException> {
                db.mutate(":create test { id: Int }")
            }
        }

        @Test
        @DisplayName("importRelations after close throws")
        fun importAfterCloseThrows() = runTest {
            val db = CozoGraphDB("mem", "")
            db.close()

            assertThrows<DatabaseClosedException> {
                db.importRelations(mapOf("test" to listOf(listOf(1))))
            }
        }

        @Test
        @DisplayName("exportRelations after close throws")
        fun exportAfterCloseThrows() = runTest {
            val db = CozoGraphDB("mem", "")
            db.close()

            assertThrows<DatabaseClosedException> {
                db.exportRelations(listOf("test"))
            }
        }

        @Test
        @DisplayName("backup after close throws")
        fun backupAfterCloseThrows() = runTest {
            val db = CozoGraphDB("mem", "")
            db.close()

            assertThrows<DatabaseClosedException> {
                db.backup(File(tempDir, "backup.db").absolutePath)
            }
        }

        @Test
        @DisplayName("restore after close throws")
        fun restoreAfterCloseThrows() = runTest {
            val db = CozoGraphDB("mem", "")
            db.close()

            assertThrows<DatabaseClosedException> {
                db.restore(File(tempDir, "backup.db").absolutePath)
            }
        }

        @Test
        @DisplayName("close is idempotent")
        fun closeIsIdempotent() {
            val db = CozoGraphDB("mem", "")

            // Multiple closes should not throw
            db.close()
            db.close()
            db.close()
        }

        @Test
        @DisplayName("close on sqlite database releases file lock")
        fun closeSqliteReleasesLock() = runTest {
            val dbPath = File(tempDir, "test.db").absolutePath

            // Create and close first database
            val db1 = CozoGraphDB("sqlite", dbPath)
            db1.mutate(":create test { id: Int }")
            db1.mutate("?[id] <- [[1]] :put test { id }")
            db1.close()

            // Should be able to open a new database on same path
            val db2 = CozoGraphDB("sqlite", dbPath)
            try {
                val result = db2.query<Any>("?[id] := *test{ id }")
                assertThat(result.rows).hasSize(1)
            } finally {
                db2.close()
            }
        }
    }

    @Nested
    @DisplayName("Suspend Operations")
    inner class SuspendOperations {

        @Test
        @DisplayName("suspend completes without error")
        fun suspendCompletesSuccessfully() = runTest {
            val db = CozoGraphDB("mem", "")
            try {
                db.mutate(":create test { id: Int }")
                db.mutate("?[id] <- [[1], [2], [3]] :put test { id }")

                // Should not throw
                db.suspend()
            } finally {
                db.close()
            }
        }

        @Test
        @DisplayName("data is preserved after suspend")
        fun dataPreservedAfterSuspend() = runTest {
            val db = CozoGraphDB("mem", "")
            try {
                db.mutate(":create test { id: Int }")
                db.mutate("?[id] <- [[1], [2], [3]] :put test { id }")

                db.suspend()

                // Data should still be accessible
                val result = db.query<Any>("?[count] := count = count(id), *test{ id }")
                assertThat(result.rows[0][0]).isEqualTo(3)
            } finally {
                db.close()
            }
        }

        @Test
        @DisplayName("suspend flushes pending writes for sqlite")
        fun suspendFlushesSqliteWrites() = runTest {
            val dbPath = File(tempDir, "suspend_test.db").absolutePath
            val db = CozoGraphDB("sqlite", dbPath)

            try {
                db.mutate(":create test { id: Int }")
                db.mutate("?[id] <- [[1], [2], [3]] :put test { id }")

                // Suspend should ensure data is durable
                db.suspend()

                // Verify data is on disk by opening new connection
                db.close()

                val db2 = CozoGraphDB("sqlite", dbPath)
                try {
                    val result = db2.query<Any>("?[count] := count = count(id), *test{ id }")
                    assertThat(result.rows[0][0]).isEqualTo(3)
                } finally {
                    db2.close()
                }
            } catch (e: Exception) {
                db.close()
                throw e
            }
        }

        @Test
        @DisplayName("multiple suspends are safe")
        fun multipleSuspendsAreSafe() = runTest {
            val db = CozoGraphDB("mem", "")
            try {
                db.mutate(":create test { id: Int }")

                // Multiple suspends should not throw
                db.suspend()
                db.suspend()
                db.suspend()

                // Should still work
                db.mutate("?[id] <- [[1]] :put test { id }")
                val result = db.query<Any>("?[id] := *test{ id }")
                assertThat(result.rows).hasSize(1)
            } finally {
                db.close()
            }
        }

        @Test
        @DisplayName("suspend on closed database is ignored")
        fun suspendOnClosedIsIgnored() = runTest {
            val db = CozoGraphDB("mem", "")
            db.close()

            // Should not throw - just a no-op on closed database
            db.suspend()
        }
    }

    @Nested
    @DisplayName("Resume Operations")
    inner class ResumeOperations {

        @Test
        @DisplayName("resume completes without error")
        fun resumeCompletesSuccessfully() = runTest {
            val db = CozoGraphDB("mem", "")
            try {
                db.mutate(":create test { id: Int }")

                // Should not throw
                db.resume()
            } finally {
                db.close()
            }
        }

        @Test
        @DisplayName("resume validates database is accessible")
        fun resumeValidatesAccessibility() = runTest {
            val db = CozoGraphDB("mem", "")
            try {
                db.mutate(":create test { id: Int }")
                db.mutate("?[id] <- [[1]] :put test { id }")

                db.suspend()
                db.resume()

                // Database should still work
                val result = db.query<Any>("?[id] := *test{ id }")
                assertThat(result.rows).hasSize(1)
            } finally {
                db.close()
            }
        }

        @Test
        @DisplayName("operations work after suspend/resume cycle")
        fun operationsWorkAfterCycle() = runTest {
            val db = CozoGraphDB("mem", "")
            try {
                db.mutate(":create items { id: Int, value: String }")
                db.mutate("?[id, value] <- [[1, \"before\"]] :put items { id, value }")

                db.suspend()
                db.resume()

                // All operations should work
                db.mutate("?[id, value] <- [[2, \"after\"]] :put items { id, value }")
                val result = db.query<Any>("?[count] := count = count(id), *items{ id }")
                assertThat(result.rows[0][0]).isEqualTo(2)
            } finally {
                db.close()
            }
        }

        @Test
        @DisplayName("multiple suspend/resume cycles work")
        fun multipleCyclesWork() = runTest {
            val db = CozoGraphDB("mem", "")
            try {
                db.mutate(":create counter { id: Int }")

                for (i in 1..5) {
                    db.mutate("?[id] <- [[$i]] :put counter { id }")
                    db.suspend()
                    db.resume()
                }

                val result = db.query<Any>("?[count] := count = count(id), *counter{ id }")
                assertThat(result.rows[0][0]).isEqualTo(5)
            } finally {
                db.close()
            }
        }

        @Test
        @DisplayName("resume on closed database is ignored")
        fun resumeOnClosedIsIgnored() = runTest {
            val db = CozoGraphDB("mem", "")
            db.close()

            // Should not throw - just a no-op on closed database
            db.resume()
        }
    }

    @Nested
    @DisplayName("OnLowMemory Operations")
    inner class OnLowMemoryOperations {

        @Test
        @DisplayName("onLowMemory completes without error")
        fun onLowMemoryCompletesSuccessfully() = runTest {
            val db = CozoGraphDB("mem", "")
            try {
                db.mutate(":create test { id: Int }")
                db.mutate("?[id] <- [[1], [2], [3]] :put test { id }")

                // Should not throw
                db.onLowMemory()
            } finally {
                db.close()
            }
        }

        @Test
        @DisplayName("data is preserved after onLowMemory")
        fun dataPreservedAfterLowMemory() = runTest {
            val db = CozoGraphDB("mem", "")
            try {
                db.mutate(":create test { id: Int }")
                db.mutate("?[id] <- [[1], [2], [3]] :put test { id }")

                db.onLowMemory()

                // Data should still be accessible
                val result = db.query<Any>("?[count] := count = count(id), *test{ id }")
                assertThat(result.rows[0][0]).isEqualTo(3)
            } finally {
                db.close()
            }
        }

        @Test
        @DisplayName("operations work after onLowMemory")
        fun operationsWorkAfterLowMemory() = runTest {
            val db = CozoGraphDB("mem", "")
            try {
                db.mutate(":create items { id: Int }")
                db.mutate("?[id] <- [[1]] :put items { id }")

                db.onLowMemory()

                // All operations should still work
                db.mutate("?[id] <- [[2]] :put items { id }")

                val result = db.query<Any>("?[count] := count = count(id), *items{ id }")
                assertThat(result.rows[0][0]).isEqualTo(2)
            } finally {
                db.close()
            }
        }

        @Test
        @DisplayName("multiple onLowMemory calls are safe")
        fun multipleOnLowMemoryAreSafe() = runTest {
            val db = CozoGraphDB("mem", "")
            try {
                db.mutate(":create test { id: Int }")

                // Multiple calls should not throw
                db.onLowMemory()
                db.onLowMemory()
                db.onLowMemory()

                db.mutate("?[id] <- [[1]] :put test { id }")
                val result = db.query<Any>("?[id] := *test{ id }")
                assertThat(result.rows).hasSize(1)
            } finally {
                db.close()
            }
        }

        @Test
        @DisplayName("onLowMemory on closed database is ignored")
        fun onLowMemoryOnClosedIsIgnored() = runTest {
            val db = CozoGraphDB("mem", "")
            db.close()

            // Should not throw - just a no-op on closed database
            db.onLowMemory()
        }

        @Test
        @DisplayName("lifecycle methods can be called in any order")
        fun lifecycleMethodsAnyOrder() = runTest {
            val db = CozoGraphDB("mem", "")
            try {
                db.mutate(":create test { id: Int }")

                // Call lifecycle methods in various orders
                db.suspend()
                db.onLowMemory()
                db.resume()
                db.onLowMemory()
                db.suspend()
                db.suspend()
                db.resume()

                // Should still work
                db.mutate("?[id] <- [[1]] :put test { id }")
                val result = db.query<Any>("?[id] := *test{ id }")
                assertThat(result.rows).hasSize(1)
            } finally {
                db.close()
            }
        }
    }

    @Nested
    @DisplayName("Initialization")
    inner class Initialization {

        @Test
        @DisplayName("creates in-memory database with default constructor")
        fun createsInMemoryDefault() = runTest {
            val db = CozoGraphDB()
            try {
                db.mutate(":create test { id: Int }")
                db.mutate("?[id] <- [[1]] :put test { id }")

                val result = db.query<Any>("?[id] := *test{ id }")
                assertThat(result.rows).hasSize(1)
            } finally {
                db.close()
            }
        }

        @Test
        @DisplayName("creates in-memory database with explicit engine")
        fun createsInMemoryExplicit() = runTest {
            val db = CozoGraphDB("mem", "")
            try {
                db.mutate(":create test { id: Int }")
                val result = db.query<Any>("?[] <- [[true]]")
                assertThat(result.rows).hasSize(1)
            } finally {
                db.close()
            }
        }

        @Test
        @DisplayName("creates sqlite database")
        fun createsSqliteDatabase() = runTest {
            val dbPath = File(tempDir, "test.db").absolutePath
            val db = CozoGraphDB("sqlite", dbPath)
            try {
                db.mutate(":create test { id: Int }")
                db.mutate("?[id] <- [[1]] :put test { id }")

                val result = db.query<Any>("?[id] := *test{ id }")
                assertThat(result.rows).hasSize(1)

                // Verify file was created
                assertThat(File(dbPath).exists() || File("$dbPath-wal").exists()).isTrue()
            } finally {
                db.close()
            }
        }

        @Test
        @DisplayName("throws on invalid engine")
        fun throwsOnInvalidEngine() {
            assertThrows<DatabaseInitializationException> {
                CozoGraphDB("invalid_engine", "")
            }
        }

        @Test
        @DisplayName("throws on invalid path for sqlite")
        fun throwsOnInvalidPath() {
            assertThrows<DatabaseInitializationException> {
                CozoGraphDB("sqlite", "/nonexistent/path/that/cannot/be/created/db.db")
            }
        }
    }
}
