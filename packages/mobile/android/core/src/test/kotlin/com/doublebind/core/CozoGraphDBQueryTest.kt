package com.doublebind.core

import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.test.runTest
import org.junit.jupiter.api.*
import org.junit.jupiter.api.Assertions.*

/**
 * Unit tests for CozoGraphDB query operations.
 *
 * Tests cover:
 * - Basic query execution
 * - Query with parameters
 * - Empty result handling
 * - Various data types in results
 */
@DisplayName("CozoGraphDB Query Operations")
class CozoGraphDBQueryTest {

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
    @DisplayName("Basic Queries")
    inner class BasicQueries {

        @Test
        @DisplayName("query returns results with correct headers")
        fun queryReturnsCorrectHeaders() = runTest {
            // Create a test relation
            db.mutate(":create test { id: Int, name: String }")
            db.mutate("?[id, name] <- [[1, \"Alice\"]] :put test { id, name }")

            val result = db.query<Any>("?[id, name] := *test{ id, name }")

            assertThat(result.headers).containsExactly("id", "name")
        }

        @Test
        @DisplayName("query returns correct row data")
        fun queryReturnsCorrectRows() = runTest {
            db.mutate(":create test { id: Int, name: String }")
            db.mutate("?[id, name] <- [[1, \"Alice\"], [2, \"Bob\"]] :put test { id, name }")

            val result = db.query<Any>("?[id, name] := *test{ id, name }")

            assertThat(result.rows).hasSize(2)
            // CozoDB returns data but order may vary
            val ids = result.rows.map { it[0] as Int }.toSet()
            assertThat(ids).containsExactly(1, 2)
        }

        @Test
        @DisplayName("query returns empty result for no matches")
        fun queryReturnsEmptyForNoMatches() = runTest {
            db.mutate(":create test { id: Int, name: String }")

            val result = db.query<Any>("?[id, name] := *test{ id, name }")

            assertThat(result.rows).isEmpty()
            assertThat(result.headers).containsExactly("id", "name")
        }

        @Test
        @DisplayName("simple constant query works")
        fun simpleConstantQuery() = runTest {
            val result = db.query<Any>("?[a] <- [[1], [2], [3]]")

            assertThat(result.headers).containsExactly("a")
            assertThat(result.rows).hasSize(3)
        }
    }

    @Nested
    @DisplayName("Parameterized Queries")
    inner class ParameterizedQueries {

        @Test
        @DisplayName("query with string parameter")
        fun queryWithStringParameter() = runTest {
            db.mutate(":create users { id: Int, name: String }")
            db.mutate("?[id, name] <- [[1, \"Alice\"], [2, \"Bob\"]] :put users { id, name }")

            val result = db.query<Any>(
                "?[id, name] := *users{ id, name }, name == \$search_name",
                mapOf("search_name" to "Alice")
            )

            assertThat(result.rows).hasSize(1)
            assertThat(result.rows[0][1]).isEqualTo("Alice")
        }

        @Test
        @DisplayName("query with integer parameter")
        fun queryWithIntParameter() = runTest {
            db.mutate(":create items { id: Int, value: Int }")
            db.mutate("?[id, value] <- [[1, 100], [2, 200]] :put items { id, value }")

            val result = db.query<Any>(
                "?[id, value] := *items{ id, value }, value > \$min_value",
                mapOf("min_value" to 150)
            )

            assertThat(result.rows).hasSize(1)
            assertThat(result.rows[0][1]).isEqualTo(200)
        }

        @Test
        @DisplayName("query with multiple parameters")
        fun queryWithMultipleParams() = runTest {
            db.mutate(":create products { id: Int, name: String, price: Float }")
            db.mutate("""
                ?[id, name, price] <- [
                    [1, "Apple", 1.50],
                    [2, "Banana", 0.75],
                    [3, "Orange", 2.00]
                ] :put products { id, name, price }
            """.trimIndent())

            val result = db.query<Any>(
                "?[name, price] := *products{ name, price }, price >= \$min, price <= \$max",
                mapOf("min" to 1.0, "max" to 2.0)
            )

            assertThat(result.rows).hasSize(2)
        }

        @Test
        @DisplayName("query with list parameter")
        fun queryWithListParameter() = runTest {
            db.mutate(":create tags { id: Int, tag: String }")
            db.mutate("""
                ?[id, tag] <- [
                    [1, "kotlin"],
                    [2, "java"],
                    [3, "swift"]
                ] :put tags { id, tag }
            """.trimIndent())

            val result = db.query<Any>(
                "?[id, tag] := *tags{ id, tag }, tag in \$allowed",
                mapOf("allowed" to listOf("kotlin", "swift"))
            )

            assertThat(result.rows).hasSize(2)
        }

        @Test
        @DisplayName("query with empty parameters map")
        fun queryWithEmptyParams() = runTest {
            val result = db.query<Any>("?[a] <- [[42]]", emptyMap())

            assertThat(result.rows).hasSize(1)
            assertThat(result.rows[0][0]).isEqualTo(42)
        }
    }

    @Nested
    @DisplayName("Data Type Handling")
    inner class DataTypeHandling {

        @Test
        @DisplayName("handles integer values")
        fun handlesIntegers() = runTest {
            db.mutate(":create nums { val: Int }")
            db.mutate("?[val] <- [[0], [-1], [42], [2147483647]] :put nums { val }")

            val result = db.query<Any>("?[val] := *nums{ val }")

            val values = result.rows.map { it[0] as Int }.toSet()
            assertThat(values).containsExactly(0, -1, 42, 2147483647)
        }

        @Test
        @DisplayName("handles float values")
        fun handlesFloats() = runTest {
            db.mutate(":create floats { val: Float }")
            db.mutate("?[val] <- [[0.0], [3.14159], [-1.5]] :put floats { val }")

            val result = db.query<Any>("?[val] := *floats{ val }")

            assertThat(result.rows).hasSize(3)
            val values = result.rows.map { (it[0] as Number).toDouble() }
            assertThat(values).containsAtLeast(0.0, 3.14159, -1.5)
        }

        @Test
        @DisplayName("handles boolean values")
        fun handlesBooleans() = runTest {
            db.mutate(":create flags { val: Bool }")
            db.mutate("?[val] <- [[true], [false]] :put flags { val }")

            val result = db.query<Any>("?[val] := *flags{ val }")

            val values = result.rows.map { it[0] as Boolean }.toSet()
            assertThat(values).containsExactly(true, false)
        }

        @Test
        @DisplayName("handles string values with special characters")
        fun handlesStringWithSpecialChars() = runTest {
            db.mutate(":create texts { val: String }")
            db.mutate("""?[val] <- [["hello"], ["with spaces"], ["with\ttab"]] :put texts { val }""")

            val result = db.query<Any>("?[val] := *texts{ val }")

            assertThat(result.rows).hasSize(3)
        }

        @Test
        @DisplayName("handles null values")
        fun handlesNulls() = runTest {
            db.mutate(":create nullable { id: Int, val: String? }")
            db.mutate("?[id, val] <- [[1, \"value\"], [2, null]] :put nullable { id, val }")

            val result = db.query<Any>("?[id, val] := *nullable{ id, val }")

            assertThat(result.rows).hasSize(2)
            val nullRow = result.rows.find { it[0] == 2 }
            assertThat(nullRow?.get(1)).isNull()
        }
    }

    @Nested
    @DisplayName("Complex Queries")
    inner class ComplexQueries {

        @Test
        @DisplayName("handles join queries")
        fun handlesJoinQueries() = runTest {
            db.mutate(":create users { id: Int => name: String }")
            db.mutate(":create orders { id: Int, user_id: Int, amount: Float }")

            db.mutate("?[id, name] <- [[1, \"Alice\"], [2, \"Bob\"]] :put users { id => name }")
            db.mutate("""
                ?[id, user_id, amount] <- [
                    [1, 1, 100.0],
                    [2, 1, 50.0],
                    [3, 2, 75.0]
                ] :put orders { id, user_id, amount }
            """.trimIndent())

            val result = db.query<Any>("""
                ?[name, total] :=
                    *users{ id: user_id, name },
                    total = sum(amount),
                    *orders{ user_id, amount }
            """.trimIndent())

            assertThat(result.rows).hasSize(2)
        }

        @Test
        @DisplayName("handles aggregation queries")
        fun handlesAggregations() = runTest {
            db.mutate(":create scores { player: String, score: Int }")
            db.mutate("""
                ?[player, score] <- [
                    ["Alice", 100],
                    ["Alice", 150],
                    ["Bob", 200]
                ] :put scores { player, score }
            """.trimIndent())

            val result = db.query<Any>("""
                ?[player, total] :=
                    *scores{ player, score },
                    total = sum(score)
            """.trimIndent())

            assertThat(result.rows).hasSize(2)
        }

        @Test
        @DisplayName("handles limit and offset")
        fun handlesLimitOffset() = runTest {
            db.mutate(":create items { id: Int }")
            db.mutate("?[id] <- [[1], [2], [3], [4], [5]] :put items { id }")

            val result = db.query<Any>("?[id] := *items{ id } :limit 2 :offset 1")

            assertThat(result.rows).hasSize(2)
        }

        @Test
        @DisplayName("handles ordering")
        fun handlesOrdering() = runTest {
            db.mutate(":create items { id: Int, name: String }")
            db.mutate("""
                ?[id, name] <- [[3, "C"], [1, "A"], [2, "B"]]
                :put items { id, name }
            """.trimIndent())

            val result = db.query<Any>("?[id, name] := *items{ id, name } :order id")

            assertThat(result.rows).hasSize(3)
            assertThat(result.rows[0][0]).isEqualTo(1)
            assertThat(result.rows[1][0]).isEqualTo(2)
            assertThat(result.rows[2][0]).isEqualTo(3)
        }
    }
}
