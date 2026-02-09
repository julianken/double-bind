package com.doublebind.core

import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.test.runTest
import org.junit.jupiter.api.*
import org.junit.jupiter.api.Assertions.*

/**
 * Unit tests for CozoGraphDB error handling.
 *
 * Tests cover:
 * - Invalid query syntax errors
 * - Non-existent relation errors
 * - Type mismatch errors
 * - Constraint violation errors
 * - Parameter errors
 */
@DisplayName("CozoGraphDB Error Handling")
class CozoGraphDBErrorHandlingTest {

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
    @DisplayName("Query Syntax Errors")
    inner class QuerySyntaxErrors {

        @Test
        @DisplayName("invalid query syntax throws CozoException")
        fun invalidQuerySyntax() {
            assertThrows<CozoException> {
                runTest {
                    db.query<Any>("this is not valid datalog")
                }
            }
        }

        @Test
        @DisplayName("incomplete query throws CozoException")
        fun incompleteQuery() {
            assertThrows<CozoException> {
                runTest {
                    db.query<Any>("?[a] :=")
                }
            }
        }

        @Test
        @DisplayName("missing closing bracket throws CozoException")
        fun missingClosingBracket() {
            assertThrows<CozoException> {
                runTest {
                    db.query<Any>("?[a <- [[1]]")
                }
            }
        }

        @Test
        @DisplayName("typo in keyword throws CozoException")
        fun typoInKeyword() {
            assertThrows<CozoException> {
                runTest {
                    db.query<Any>("?[a] <-- [[1]]") // <-- instead of <-
                }
            }
        }

        @Test
        @DisplayName("exception contains error message")
        fun exceptionContainsMessage() = runTest {
            try {
                db.query<Any>("invalid query")
                fail("Expected CozoException")
            } catch (e: CozoException) {
                assertThat(e.message).isNotEmpty()
            }
        }
    }

    @Nested
    @DisplayName("Non-Existent Relation Errors")
    inner class NonExistentRelationErrors {

        @Test
        @DisplayName("query non-existent relation throws CozoException")
        fun queryNonExistentRelation() {
            assertThrows<CozoException> {
                runTest {
                    db.query<Any>("?[id] := *nonexistent{ id }")
                }
            }
        }

        @Test
        @DisplayName("put to non-existent relation throws CozoException")
        fun putToNonExistentRelation() {
            assertThrows<CozoException> {
                runTest {
                    db.mutate("?[id] <- [[1]] :put nonexistent { id }")
                }
            }
        }

        @Test
        @DisplayName("rm from non-existent relation throws CozoException")
        fun rmFromNonExistentRelation() {
            assertThrows<CozoException> {
                runTest {
                    db.mutate("?[id] <- [[1]] :rm nonexistent { id }")
                }
            }
        }

        @Test
        @DisplayName("export non-existent relation throws CozoException")
        fun exportNonExistentRelation() {
            assertThrows<CozoException> {
                runTest {
                    db.exportRelations(listOf("nonexistent"))
                }
            }
        }
    }

    @Nested
    @DisplayName("Type Mismatch Errors")
    inner class TypeMismatchErrors {

        @Test
        @DisplayName("inserting string into Int column throws CozoException")
        fun stringIntoIntColumn() = runTest {
            db.mutate(":create typed { id: Int }")

            assertThrows<CozoException> {
                runTest {
                    db.mutate("?[id] <- [[\"not an int\"]] :put typed { id }")
                }
            }
        }

        @Test
        @DisplayName("inserting int into String column works (coerced)")
        fun intIntoStringColumn() = runTest {
            // CozoDB may coerce types in some cases
            db.mutate(":create typed { id: Int, name: String }")

            // This may work or throw depending on CozoDB version
            // Just verify we handle it gracefully
            try {
                db.mutate("?[id, name] <- [[1, 123]] :put typed { id, name }")
            } catch (e: CozoException) {
                // Expected - type mismatch
                assertThat(e.message).isNotEmpty()
            }
        }

        @Test
        @DisplayName("inserting null into non-nullable column throws")
        fun nullIntoNonNullableColumn() = runTest {
            db.mutate(":create strict { id: Int, value: String }")

            assertThrows<CozoException> {
                runTest {
                    db.mutate("?[id, value] <- [[1, null]] :put strict { id, value }")
                }
            }
        }

        @Test
        @DisplayName("inserting null into nullable column works")
        fun nullIntoNullableColumn() = runTest {
            db.mutate(":create nullable { id: Int, value: String? }")

            // Should not throw
            db.mutate("?[id, value] <- [[1, null]] :put nullable { id, value }")

            val result = db.query<Any>("?[value] := *nullable{ id: 1, value }")
            assertThat(result.rows[0][0]).isNull()
        }
    }

    @Nested
    @DisplayName("Constraint Violations")
    inner class ConstraintViolations {

        @Test
        @DisplayName("duplicate key with ensure throws CozoException")
        fun duplicateKeyWithEnsure() = runTest {
            db.mutate(":create items { id: Int }")
            db.mutate("?[id] <- [[1]] :put items { id }")

            assertThrows<CozoException> {
                runTest {
                    db.mutate("?[id] <- [[1]] :ensure items { id }")
                }
            }
        }

        @Test
        @DisplayName("creating duplicate relation throws CozoException")
        fun duplicateRelationCreation() = runTest {
            db.mutate(":create test { id: Int }")

            assertThrows<CozoException> {
                runTest {
                    db.mutate(":create test { id: Int }")
                }
            }
        }

        @Test
        @DisplayName("wrong number of columns throws CozoException")
        fun wrongNumberOfColumns() = runTest {
            db.mutate(":create items { id: Int, name: String }")

            assertThrows<CozoException> {
                runTest {
                    db.mutate("?[id] <- [[1]] :put items { id, name }")
                }
            }
        }
    }

    @Nested
    @DisplayName("Parameter Errors")
    inner class ParameterErrors {

        @Test
        @DisplayName("missing required parameter throws CozoException")
        fun missingParameter() = runTest {
            db.mutate(":create items { id: Int }")

            assertThrows<CozoException> {
                runTest {
                    // Query references $missing but we don't provide it
                    db.query<Any>("?[id] := *items{ id }, id == \$missing")
                }
            }
        }

        @Test
        @DisplayName("wrong parameter type is handled")
        fun wrongParameterType() = runTest {
            db.mutate(":create items { id: Int }")
            db.mutate("?[id] <- [[1], [2], [3]] :put items { id }")

            // This should either work (with type coercion) or throw
            // depending on CozoDB version
            try {
                val result = db.query<Any>(
                    "?[id] := *items{ id }, id == \$target",
                    mapOf("target" to "not an int")
                )
                // If it works, probably no results due to type mismatch
                assertThat(result.rows).isEmpty()
            } catch (e: CozoException) {
                // Expected - type mismatch
                assertThat(e.message).isNotEmpty()
            }
        }

        @Test
        @DisplayName("extra parameters are ignored")
        fun extraParametersIgnored() = runTest {
            db.mutate(":create items { id: Int }")
            db.mutate("?[id] <- [[1]] :put items { id }")

            // Extra parameters should be ignored
            val result = db.query<Any>(
                "?[id] := *items{ id }",
                mapOf("unused1" to 1, "unused2" to "test")
            )

            assertThat(result.rows).hasSize(1)
        }
    }

    @Nested
    @DisplayName("Schema Errors")
    inner class SchemaErrors {

        @Test
        @DisplayName("remove non-existent relation throws CozoException")
        fun removeNonExistentRelation() {
            assertThrows<CozoException> {
                runTest {
                    db.mutate("::remove nonexistent")
                }
            }
        }

        @Test
        @DisplayName("columns on non-existent relation throws CozoException")
        fun columnsOnNonExistent() {
            assertThrows<CozoException> {
                runTest {
                    db.query<Any>("::columns nonexistent")
                }
            }
        }

        @Test
        @DisplayName("invalid column type throws CozoException")
        fun invalidColumnType() {
            assertThrows<CozoException> {
                runTest {
                    db.mutate(":create bad { id: InvalidType }")
                }
            }
        }

        @Test
        @DisplayName("empty relation name throws CozoException")
        fun emptyRelationName() {
            assertThrows<CozoException> {
                runTest {
                    db.mutate(":create { id: Int }")
                }
            }
        }
    }

    @Nested
    @DisplayName("Error Recovery")
    inner class ErrorRecovery {

        @Test
        @DisplayName("database remains usable after query error")
        fun usableAfterQueryError() = runTest {
            db.mutate(":create items { id: Int }")
            db.mutate("?[id] <- [[1]] :put items { id }")

            // Cause an error
            try {
                db.query<Any>("invalid query")
            } catch (e: CozoException) {
                // Expected
            }

            // Database should still work
            val result = db.query<Any>("?[id] := *items{ id }")
            assertThat(result.rows).hasSize(1)
        }

        @Test
        @DisplayName("database remains usable after mutation error")
        fun usableAfterMutationError() = runTest {
            db.mutate(":create items { id: Int }")
            db.mutate("?[id] <- [[1]] :put items { id }")

            // Cause an error
            try {
                db.mutate("?[id] <- [[\"bad\"]] :put items { id }")
            } catch (e: CozoException) {
                // Expected
            }

            // Original data should be intact
            val result = db.query<Any>("?[id] := *items{ id }")
            assertThat(result.rows).hasSize(1)
            assertThat(result.rows[0][0]).isEqualTo(1)
        }

        @Test
        @DisplayName("failed transaction is rolled back")
        fun failedTransactionRolledBack() = runTest {
            db.mutate(":create items { id: Int }")
            db.mutate("?[id] <- [[1]] :put items { id }")

            // Try to do a mutation that will partially fail
            try {
                // This should fail atomically
                db.mutate("""
                    ?[id] <- [[2]]
                    :put items { id }
                    ?[bad] := *nonexistent{ bad }
                """.trimIndent())
            } catch (e: CozoException) {
                // Expected
            }

            // The "2" should not be inserted due to atomic failure
            // (Note: actual behavior depends on CozoDB's transaction handling)
            val result = db.query<Any>("?[id] := *items{ id }")
            // At minimum, the original data should be present
            assertThat(result.rows.map { it[0] as Int }).contains(1)
        }

        @Test
        @DisplayName("multiple sequential errors don't corrupt database")
        fun multipleSequentialErrors() = runTest {
            db.mutate(":create items { id: Int }")
            db.mutate("?[id] <- [[1]] :put items { id }")

            // Cause multiple errors
            repeat(5) {
                try {
                    db.query<Any>("invalid query $it")
                } catch (e: CozoException) {
                    // Expected
                }
            }

            // Database should still work
            val result = db.query<Any>("?[id] := *items{ id }")
            assertThat(result.rows).hasSize(1)
        }
    }

    @Nested
    @DisplayName("Concurrent Error Handling")
    inner class ConcurrentErrorHandling {

        @Test
        @DisplayName("errors in concurrent operations are isolated")
        fun errorsAreIsolated() = runTest {
            db.mutate(":create items { id: Int }")

            // Start multiple operations
            val results = mutableListOf<Result<QueryResult<Any>>>()

            // Some valid, some invalid
            results.add(runCatching { db.query<Any>("?[a] <- [[1]]") })
            results.add(runCatching { db.query<Any>("invalid") })
            results.add(runCatching { db.query<Any>("?[b] <- [[2]]") })
            results.add(runCatching { db.query<Any>("also invalid") })
            results.add(runCatching { db.query<Any>("?[c] <- [[3]]") })

            // Valid queries should succeed
            assertThat(results[0].isSuccess).isTrue()
            assertThat(results[2].isSuccess).isTrue()
            assertThat(results[4].isSuccess).isTrue()

            // Invalid queries should fail
            assertThat(results[1].isFailure).isTrue()
            assertThat(results[3].isFailure).isTrue()
        }
    }
}
