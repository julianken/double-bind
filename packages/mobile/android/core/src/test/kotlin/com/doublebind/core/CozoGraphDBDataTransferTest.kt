package com.doublebind.core

import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.test.runTest
import org.junit.jupiter.api.*
import org.junit.jupiter.api.Assertions.*

/**
 * Unit tests for CozoGraphDB data transfer operations.
 *
 * Tests cover:
 * - importRelations (bulk import)
 * - exportRelations (bulk export)
 * - Round-trip data integrity
 */
@DisplayName("CozoGraphDB Data Transfer Operations")
class CozoGraphDBDataTransferTest {

    private lateinit var db: CozoGraphDB

    @BeforeEach
    fun setUp() {
        db = CozoGraphDB("mem", "")
    }

    @AfterEach
    fun tearDown() {
        db.close()
    }

    @Nested
    @DisplayName("Import Relations")
    inner class ImportRelations {

        @Test
        @DisplayName("imports single relation with data")
        fun importsSingleRelation() = runTest {
            db.mutate(":create users { id: Int, name: String }")

            db.importRelations(mapOf(
                "users" to listOf(
                    listOf(1, "Alice"),
                    listOf(2, "Bob")
                )
            ))

            val result = db.query<Any>("?[id, name] := *users{ id, name }")
            assertThat(result.rows).hasSize(2)
        }

        @Test
        @DisplayName("imports multiple relations")
        fun importsMultipleRelations() = runTest {
            db.mutate(":create users { id: Int, name: String }")
            db.mutate(":create posts { id: Int, user_id: Int, title: String }")

            db.importRelations(mapOf(
                "users" to listOf(
                    listOf(1, "Alice"),
                    listOf(2, "Bob")
                ),
                "posts" to listOf(
                    listOf(1, 1, "First Post"),
                    listOf(2, 1, "Second Post"),
                    listOf(3, 2, "Bob's Post")
                )
            ))

            val usersResult = db.query<Any>("?[id] := *users{ id }")
            assertThat(usersResult.rows).hasSize(2)

            val postsResult = db.query<Any>("?[id] := *posts{ id }")
            assertThat(postsResult.rows).hasSize(3)
        }

        @Test
        @DisplayName("imports with various data types")
        fun importsVariousDataTypes() = runTest {
            db.mutate(":create data { id: Int, str: String, num: Float, flag: Bool }")

            db.importRelations(mapOf(
                "data" to listOf(
                    listOf(1, "text", 3.14, true),
                    listOf(2, "more", 2.71, false)
                )
            ))

            val result = db.query<Any>("?[id, str, num, flag] := *data{ id, str, num, flag }")
            assertThat(result.rows).hasSize(2)
        }

        @Test
        @DisplayName("imports with null values")
        fun importsWithNulls() = runTest {
            db.mutate(":create nullable { id: Int, value: String? }")

            db.importRelations(mapOf(
                "nullable" to listOf(
                    listOf(1, "has value"),
                    listOf(2, null)
                )
            ))

            val result = db.query<Any>("?[id, value] := *nullable{ id, value }")
            assertThat(result.rows).hasSize(2)

            val nullRow = result.rows.find { it[0] == 2 }
            assertThat(nullRow?.get(1)).isNull()
        }

        @Test
        @DisplayName("imports empty relation")
        fun importsEmptyRelation() = runTest {
            db.mutate(":create empty_rel { id: Int }")

            db.importRelations(mapOf(
                "empty_rel" to emptyList()
            ))

            val result = db.query<Any>("?[id] := *empty_rel{ id }")
            assertThat(result.rows).isEmpty()
        }

        @Test
        @DisplayName("import replaces existing data")
        fun importReplacesExistingData() = runTest {
            db.mutate(":create items { id: Int, value: String }")
            db.mutate("?[id, value] <- [[1, \"old\"]] :put items { id, value }")

            // Import should add to existing data (not replace entire relation)
            db.importRelations(mapOf(
                "items" to listOf(
                    listOf(2, "new")
                )
            ))

            val result = db.query<Any>("?[id, value] := *items{ id, value }")
            // Both old and new data should exist
            assertThat(result.rows).hasSize(2)
        }
    }

    @Nested
    @DisplayName("Export Relations")
    inner class ExportRelations {

        @Test
        @DisplayName("exports single relation")
        fun exportsSingleRelation() = runTest {
            db.mutate(":create users { id: Int, name: String }")
            db.mutate("?[id, name] <- [[1, \"Alice\"], [2, \"Bob\"]] :put users { id, name }")

            val exported = db.exportRelations(listOf("users"))

            assertThat(exported).containsKey("users")
            assertThat(exported["users"]).hasSize(2)
        }

        @Test
        @DisplayName("exports multiple relations")
        fun exportsMultipleRelations() = runTest {
            db.mutate(":create rel_a { id: Int }")
            db.mutate(":create rel_b { id: Int }")
            db.mutate("?[id] <- [[1], [2]] :put rel_a { id }")
            db.mutate("?[id] <- [[10], [20], [30]] :put rel_b { id }")

            val exported = db.exportRelations(listOf("rel_a", "rel_b"))

            assertThat(exported).containsKey("rel_a")
            assertThat(exported).containsKey("rel_b")
            assertThat(exported["rel_a"]).hasSize(2)
            assertThat(exported["rel_b"]).hasSize(3)
        }

        @Test
        @DisplayName("exports empty relation")
        fun exportsEmptyRelation() = runTest {
            db.mutate(":create empty { id: Int }")

            val exported = db.exportRelations(listOf("empty"))

            assertThat(exported).containsKey("empty")
            assertThat(exported["empty"]).isEmpty()
        }

        @Test
        @DisplayName("exports preserves data types")
        fun exportsPreservesDataTypes() = runTest {
            db.mutate(":create typed { id: Int, name: String, value: Float, active: Bool }")
            db.mutate("?[id, name, value, active] <- [[1, \"test\", 3.14, true]] :put typed { id, name, value, active }")

            val exported = db.exportRelations(listOf("typed"))

            val row = exported["typed"]?.firstOrNull()
            assertThat(row).isNotNull()
            assertThat(row!![0]).isEqualTo(1)
            assertThat(row[1]).isEqualTo("test")
            assertThat((row[2] as Number).toDouble()).isWithin(0.001).of(3.14)
            assertThat(row[3]).isEqualTo(true)
        }

        @Test
        @DisplayName("exports relation with null values")
        fun exportsWithNulls() = runTest {
            db.mutate(":create nullable { id: Int, val: String? }")
            db.mutate("?[id, val] <- [[1, null]] :put nullable { id, val }")

            val exported = db.exportRelations(listOf("nullable"))

            val row = exported["nullable"]?.firstOrNull()
            assertThat(row?.get(1)).isNull()
        }
    }

    @Nested
    @DisplayName("Round-Trip Data Integrity")
    inner class RoundTripIntegrity {

        @Test
        @DisplayName("export and import round-trip preserves data")
        fun roundTripPreservesData() = runTest {
            // Create and populate source database
            db.mutate(":create items { id: Int => name: String, count: Int }")
            db.mutate("""
                ?[id, name, count] <- [
                    [1, "Apple", 10],
                    [2, "Banana", 20],
                    [3, "Cherry", 30]
                ] :put items { id => name, count }
            """.trimIndent())

            // Export data
            val exported = db.exportRelations(listOf("items"))

            // Create new database and import
            val db2 = CozoGraphDB("mem", "")
            try {
                db2.mutate(":create items { id: Int => name: String, count: Int }")
                db2.importRelations(exported)

                // Verify data matches
                val original = db.query<Any>("?[id, name, count] := *items{ id, name, count } :order id")
                val imported = db2.query<Any>("?[id, name, count] := *items{ id, name, count } :order id")

                assertThat(imported.rows).hasSize(original.rows.size)
                for (i in original.rows.indices) {
                    assertThat(imported.rows[i]).isEqualTo(original.rows[i])
                }
            } finally {
                db2.close()
            }
        }

        @Test
        @DisplayName("round-trip with complex data types")
        fun roundTripComplexTypes() = runTest {
            db.mutate(":create complex { id: Int, data: Json }")
            db.mutate("""
                ?[id, data] <- [[1, {"key": "value", "nested": {"a": 1}}]]
                :put complex { id, data }
            """.trimIndent())

            val exported = db.exportRelations(listOf("complex"))

            val db2 = CozoGraphDB("mem", "")
            try {
                db2.mutate(":create complex { id: Int, data: Json }")
                db2.importRelations(exported)

                val result = db2.query<Any>("?[data] := *complex{ id: 1, data }")
                assertThat(result.rows).hasSize(1)
            } finally {
                db2.close()
            }
        }

        @Test
        @DisplayName("round-trip preserves multiple relations")
        fun roundTripMultipleRelations() = runTest {
            db.mutate(":create users { id: Int => name: String }")
            db.mutate(":create posts { id: Int, user_id: Int, content: String }")
            db.mutate(":create likes { post_id: Int, user_id: Int }")

            db.mutate("?[id, name] <- [[1, \"Alice\"], [2, \"Bob\"]] :put users { id => name }")
            db.mutate("?[id, user_id, content] <- [[1, 1, \"Hello\"]] :put posts { id, user_id, content }")
            db.mutate("?[post_id, user_id] <- [[1, 2]] :put likes { post_id, user_id }")

            val exported = db.exportRelations(listOf("users", "posts", "likes"))

            val db2 = CozoGraphDB("mem", "")
            try {
                db2.mutate(":create users { id: Int => name: String }")
                db2.mutate(":create posts { id: Int, user_id: Int, content: String }")
                db2.mutate(":create likes { post_id: Int, user_id: Int }")
                db2.importRelations(exported)

                val users = db2.query<Any>("?[count] := count = count(id), *users{ id }")
                val posts = db2.query<Any>("?[count] := count = count(id), *posts{ id }")
                val likes = db2.query<Any>("?[count] := count = count(post_id), *likes{ post_id }")

                assertThat(users.rows[0][0]).isEqualTo(2)
                assertThat(posts.rows[0][0]).isEqualTo(1)
                assertThat(likes.rows[0][0]).isEqualTo(1)
            } finally {
                db2.close()
            }
        }
    }
}
