/**
 * TypeScript interface for the DatabaseModule React Native native module.
 *
 * This module provides database utilities for the mobile app.
 * With the migration to op-sqlite, it only needs to provide the database path
 * since op-sqlite handles all database operations via JSI.
 */
import { NativeModules, Platform } from 'react-native';

/**
 * Native module interface matching the Kotlin/Swift implementations.
 */
export interface DatabaseNativeModule {
  /**
   * Get the default database path for the app.
   * Returns the path to the app's database directory where the database should be stored.
   *
   * @returns Promise that resolves with the absolute database path
   * @throws Error if the database path cannot be determined
   */
  getDatabasePath(): Promise<string>;

  /**
   * Ensure the database directory exists.
   * Creates the parent directory for the database file if it doesn't exist.
   *
   * @param path Path to the database file
   * @throws Error if the directory cannot be created
   */
  ensureDatabaseDirectory(path: string): Promise<void>;
}

/**
 * Get the DatabaseModule native module.
 *
 * @returns The DatabaseNativeModule interface
 * @throws Error if the native module is not available
 */
export function getDatabaseModule(): DatabaseNativeModule {
  const { DatabaseModule } = NativeModules;

  if (!DatabaseModule) {
    throw new Error(
      `DatabaseModule native module is not available. ` +
        `Platform: ${Platform.OS}. ` +
        `Make sure the native module is properly linked.`
    );
  }

  return DatabaseModule as DatabaseNativeModule;
}
