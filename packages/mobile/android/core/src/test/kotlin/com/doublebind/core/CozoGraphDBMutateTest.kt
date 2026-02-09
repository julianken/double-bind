package com.doublebind.core

import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.test.runTest
import org.junit.jupiter.api.*
import org.junit.jupiter.api.Assertions.*

/**
 * Unit tests for CozoGraphDB mutation operations.
 *
 * Tests cover:
 * - Relation creation
 * - Data insertion (put)
 * - Data updates
 * - Data deletion (rm)
 * - Parameterized mutations
 */
@DisplayName("CozoGraphDB Mutation Operations")
class CozoGraphDBMutateTest {

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
    @DisplayName("Relation Creation")
    inner class RelationCreation {

        @Test
        @DisplayName("creates relation with simple schema")
        fun createsSimpleRelation() = runTest {
            val result = db.mutate(":create users { id: Int, name: String }")

            // Verify relation exists by querying it
            val queryResult = db.query<Any>("?[id, name] := *users{ id, name }")
            assertThat(queryResult.headers).containsExactly("id", "name")
        }

        @Test
        @DisplayName("creates relation with primary key")
        fun createsRelationWithPrimaryKey() = runTest {
            db.mutate(":create users { id: Int => name: String, email: String }")

            // Primary key ensures uniqueness
            db.mutate("?[id, name, email] <- [[1, \"Alice\", \"a@test.com\"]] :put users { id => name, email }")
            db.mutate("?[id, name, email] <- [[1, \"Alice Updated\", \"b@test.com\"]] :put users { id => name, email }")

            val result = db.query<Any>("?[name] := *users{ id: 1, name }")
            assertThat(result.rows).hasSize(1)
            assertThat(result.rows[0][0]).isEqualTo("Alice Updated")
        }

        @Test
        @DisplayName("creates relation with multiple key columns")
        fun createsRelationWithCompositeKey() = runTest {
            db.mutate(":create edges { source: Int, target: Int => weight: Float }")

            db.mutate("?[source, target, weight] <- [[1, 2, 1.0]] :put edges { source, target => weight }")
            db.mutate("?[source, target, weight] <- [[1, 2, 2.0]] :put edges { source, target => weight }")

            val result = db.query<Any>("?[weight] := *edges{ source: 1, target: 2, weight }")
            assertThat(result.rows).hasSize(1)
            assertThat((result.rows[0][0] as Number).toDouble()).isEqualTo(2.0)
        }

        @Test
        @DisplayName("creates relation with optional fields")
        fun createsRelationWithOptionalFields() = runTest {
            db.mutate(":create profiles { id: Int => bio: String?, age: Int? }")

            db.mutate("?[id, bio, age] <- [[1, null, null]] :put profiles { id => bio, age }")

            val result = db.query<Any>("?[id, bio, age] := *profiles{ id, bio, age }")
            assertThat(result.rows).hasSize(1)
            assertThat(result.rows[0][1]).isNull()
            assertThat(result.rows[0][2]).isNull()
        }

        @Test
        @DisplayName("creates relation with default values")
        fun createsRelationWithDefaults() = runTest {
            db.mutate(":create counters { id: Int => count: Int default 0 }")

            db.mutate("?[id] <- [[1]] :put counters { id }")

            val result = db.query<Any>("?[count] := *counters{ id: 1, count }")
            assertThat(result.rows).hasSize(1)
            assertThat(result.rows[0][0]).isEqualTo(0)
        }
    }

    @Nested
    @DisplayName("Data Insertion")
    inner class DataInsertion {

        @Test
        @DisplayName("inserts single row")
        fun insertsSingleRow() = runTest {
            db.mutate(":create items { id: Int, value: String }")

            db.mutate("?[id, value] <- [[1, \"test\"]] :put items { id, value }")

            val result = db.query<Any>("?[id, value] := *items{ id, value }")
            assertThat(result.rows).hasSize(1)
        }

        @Test
        @DisplayName("inserts multiple rows")
        fun insertsMultipleRows() = runTest {
            db.mutate(":create items { id: Int, value: String }")

            db.mutate("""
                ?[id, value] <- [
                    [1, "one"],
                    [2, "two"],
                    [3, "three"]
                ] :put items { id, value }
            """.trimIndent())

            val result = db.query<Any>("?[id, value] := *items{ id, value }")
            assertThat(result.rows).hasSize(3)
        }

        @Test
        @DisplayName("inserts with parameterized data")
        fun insertsWithParams() = runTest {
            db.mutate(":create users { id: Int, name: String }")

            db.mutate(
                "?[id, name] <- [[\$id, \$name]] :put users { id, name }",
                mapOf("id" to 1, "name" to "Alice")
            )

            val result = db.query<Any>("?[name] := *users{ id: 1, name }")
            assertThat(result.rows[0][0]).isEqualTo("Alice")
        }

        @Test
        @DisplayName("handles batch insertion")
        fun handlesBatchInsertion() = runTest {
            db.mutate(":create numbers { n: Int }")

            // Insert 100 rows
            val rows = (1..100).map { "[$it]" }.joinToString(", ")
            db.mutate("?[n] <- [$rows] :put numbers { n }")

            val result = db.query<Any>("?[count] := count = count(n), *numbers{ n }")
            assertThat(result.rows[0][0]).isEqualTo(100)
        }
    }

    @Nested
    @DisplayName("Data Updates")
    inner class DataUpdates {

        @Test
        @DisplayName("updates existing row with put")
        fun updatesWithPut() = runTest {
            db.mutate(":create users { id: Int => name: String }")
            db.mutate("?[id, name] <- [[1, \"Alice\"]] :put users { id => name }")

            db.mutate("?[id, name] <- [[1, \"Alice Smith\"]] :put users { id => name }")

            val result = db.query<Any>("?[name] := *users{ id: 1, name }")
            assertThat(result.rows[0][0]).isEqualTo("Alice Smith")
        }

        @Test
        @DisplayName("ensure fails for existing row")
        fun ensureFailsForExisting() = runTest {
            db.mutate(":create items { id: Int }")
            db.mutate("?[id] <- [[1]] :put items { id }")

            assertThrows<CozoException> {
                runTest {
                    db.mutate("?[id] <- [[1]] :ensure items { id }")
                }
            }
        }

        @Test
        @DisplayName("ensure succeeds for new row")
        fun ensureSucceedsForNew() = runTest {
            db.mutate(":create items { id: Int }")

            db.mutate("?[id] <- [[1]] :ensure items { id }")

            val result = db.query<Any>("?[id] := *items{ id }")
            assertThat(result.rows).hasSize(1)
        }
    }

    @Nested
    @DisplayName("Data Deletion")
    inner class DataDeletion {

        @Test
        @DisplayName("deletes single row with rm")
        fun deletesSingleRow() = runTest {
            db.mutate(":create items { id: Int }")
            db.mutate("?[id] <- [[1], [2], [3]] :put items { id }")

            db.mutate("?[id] <- [[2]] :rm items { id }")

            val result = db.query<Any>("?[id] := *items{ id }")
            assertThat(result.rows).hasSize(2)
            val ids = result.rows.map { it[0] as Int }
            assertThat(ids).containsExactly(1, 3)
        }

        @Test
        @DisplayName("deletes multiple rows with rm")
        fun deletesMultipleRows() = runTest {
            db.mutate(":create items { id: Int }")
            db.mutate("?[id] <- [[1], [2], [3], [4], [5]] :put items { id }")

            db.mutate("?[id] <- [[1], [3], [5]] :rm items { id }")

            val result = db.query<Any>("?[id] := *items{ id }")
            val ids = result.rows.map { it[0] as Int }
            assertThat(ids).containsExactly(2, 4)
        }

        @Test
        @DisplayName("deletes with parameterized condition")
        fun deletesWithParams() = runTest {
            db.mutate(":create items { id: Int, category: String }")
            db.mutate("""
                ?[id, category] <- [
                    [1, "A"],
                    [2, "B"],
                    [3, "A"]
                ] :put items { id, category }
            """.trimIndent())

            // Delete all items in category A by querying first
            db.mutate("""
                ?[id, category] := *items{ id, category }, category == "A"
                :rm items { id, category }
            """.trimIndent())

            val result = db.query<Any>("?[id] := *items{ id }")
            assertThat(result.rows).hasSize(1)
            assertThat(result.rows[0][0]).isEqualTo(2)
        }

        @Test
        @DisplayName("delete non-existent row is idempotent")
        fun deleteNonExistentIsIdempotent() = runTest {
            db.mutate(":create items { id: Int }")

            // Should not throw
            db.mutate("?[id] <- [[999]] :rm items { id }")

            val result = db.query<Any>("?[id] := *items{ id }")
            assertThat(result.rows).isEmpty()
        }
    }

    @Nested
    @DisplayName("Schema Operations")
    inner class SchemaOperations {

        @Test
        @DisplayName("drops relation")
        fun dropsRelation() = runTest {
            db.mutate(":create temp { id: Int }")
            db.mutate("?[id] <- [[1]] :put temp { id }")

            db.mutate("::remove temp")

            assertThrows<CozoException> {
                runTest {
                    db.query<Any>("?[id] := *temp{ id }")
                }
            }
        }

        @Test
        @DisplayName("lists relations")
        fun listsRelations() = runTest {
            db.mutate(":create rel_a { id: Int }")
            db.mutate(":create rel_b { id: Int }")

            val result = db.query<Any>("::relations")

            // Should contain our created relations
            val names = result.rows.map { it[0] as String }
            assertThat(names).containsAtLeast("rel_a", "rel_b")
        }

        @Test
        @DisplayName("shows relation columns")
        fun showsRelationColumns() = runTest {
            db.mutate(":create test_rel { id: Int => name: String, age: Int }")

            val result = db.query<Any>("::columns test_rel")

            assertThat(result.rows).hasSize(3)
            val columns = result.rows.map { it[0] as String }
            assertThat(columns).containsExactly("id", "name", "age")
        }
    }
}
