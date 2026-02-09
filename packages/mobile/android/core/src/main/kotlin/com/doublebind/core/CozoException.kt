package com.doublebind.core

/**
 * Exception thrown when a CozoDB operation fails.
 * This wraps errors from the native CozoDB library.
 */
class CozoException(
    message: String,
    cause: Throwable? = null
) : Exception(message, cause) {

    companion object {
        /**
         * Create a CozoException from a CozoDB error response.
         */
        fun fromErrorResponse(response: String): CozoException {
            return CozoException("CozoDB error: $response")
        }
    }
}

/**
 * Exception thrown when an operation is attempted on a closed database.
 */
class DatabaseClosedException(
    message: String = "Database has been closed"
) : IllegalStateException(message)

/**
 * Exception thrown when database initialization fails.
 */
class DatabaseInitializationException(
    message: String,
    cause: Throwable? = null
) : Exception(message, cause)
