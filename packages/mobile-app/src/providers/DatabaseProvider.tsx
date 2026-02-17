/**
 * DatabaseProvider - React context provider for mobile database access.
 *
 * This provider manages the lifecycle of the MobileDatabase instance,
 * handling initialization, platform detection, and proper cleanup.
 *
 * @example
 * ```tsx
 * import { DatabaseProvider } from '@double-bind/mobile-app';
 *
 * function App() {
 *   return (
 *     <DatabaseProvider>
 *       <YourApp />
 *     </DatabaseProvider>
 *   );
 * }
 * ```
 */
import { createContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { Platform, AppState, type AppStateStatus } from 'react-native';
import type { Database } from '@double-bind/types';
import { MobileDatabase } from '@double-bind/mobile';
import { createServices, type Services } from '@double-bind/core';
import { runMigrations } from '@double-bind/migrations';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Database initialization state.
 */
export type DatabaseStatus = 'idle' | 'initializing' | 'ready' | 'error';

/**
 * Platform type for the current runtime environment.
 */
export type MobilePlatform = 'ios' | 'android';

/**
 * Database context value provided to consumers.
 */
export interface DatabaseContextValue {
  /** The database instance, null until initialized */
  db: Database | null;
  /** Application services (pageService, blockService, etc.), null until db is ready */
  services: Services | null;
  /** Current initialization status */
  status: DatabaseStatus;
  /** Error message if initialization failed */
  error: string | null;
  /** Detected platform */
  platform: MobilePlatform;
  /** Retry initialization after an error */
  retry: () => void;
  /** Convenience flags */
  isLoading: boolean;
  isReady: boolean;
}

/**
 * Props for the DatabaseProvider component.
 */
export interface DatabaseProviderProps {
  /** Child components to render */
  children: ReactNode;
  /**
   * Path to the database file.
   * Defaults to platform-specific app documents directory.
   */
  databasePath?: string;
  /**
   * Called when database initialization succeeds.
   */
  onReady?: (db: Database) => void;
  /**
   * Called when database initialization fails.
   */
  onError?: (error: Error) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

/**
 * React context for database access.
 * Use the `useDatabase` hook instead of consuming this directly.
 */
export const DatabaseContext = createContext<DatabaseContextValue | null>(null);

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detect the current mobile platform.
 * @returns The platform identifier ('ios' or 'android')
 */
function detectPlatform(): MobilePlatform {
  return Platform.OS === 'ios' ? 'ios' : 'android';
}

/**
 * Get the default database path for the current platform.
 * @param platform The detected platform
 * @returns Default path for database storage
 */
function getDefaultDatabasePath(platform: MobilePlatform): string {
  // React Native provides platform-specific paths via RNFS or expo-file-system
  // For now, we use a simple convention that native modules understand
  const basePath =
    platform === 'ios' ? 'Library/Application Support' : 'data/data/com.doublebind/files';

  return `${basePath}/double-bind.db`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Provider component that initializes and manages the database connection.
 *
 * Features:
 * - Auto-detects platform (iOS/Android)
 * - Async initialization with loading state
 * - Error handling with retry capability
 * - Handles app lifecycle (background/foreground transitions)
 * - Proper cleanup on unmount
 */
export function DatabaseProvider({
  children,
  databasePath,
  onReady,
  onError,
}: DatabaseProviderProps) {
  const [db, setDb] = useState<Database | null>(null);
  const [services, setServices] = useState<Services | null>(null);
  const [status, setStatus] = useState<DatabaseStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [initAttempt, setInitAttempt] = useState(0);

  const platform = detectPlatform();
  const effectivePath = databasePath ?? getDefaultDatabasePath(platform);

  // ─────────────────────────────────────────────────────────────────────────
  // Database Initialization
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    let mounted = true;
    let dbInstance: MobileDatabase | null = null;

    async function initDatabase() {
      setStatus('initializing');
      setError(null);

      try {
        dbInstance = await MobileDatabase.create(effectivePath);

        if (!mounted) {
          // Component unmounted during initialization
          await dbInstance.close();
          return;
        }

        // Run migrations to ensure schema is set up
        const migrationResult = await runMigrations(dbInstance);
        if (migrationResult.errors.length > 0) {
          const migrationError = migrationResult.errors[0];
          throw new Error(
            `Migration '${migrationError?.migration}' failed: ${migrationError?.error}`
          );
        }

        // Create services from the database instance
        const servicesInstance = createServices(dbInstance);

        setDb(dbInstance);
        setServices(servicesInstance);
        setStatus('ready');
        onReady?.(dbInstance);
      } catch (err) {
        if (!mounted) return;

        const errorMessage = err instanceof Error ? err.message : 'Unknown database error';
        setError(errorMessage);
        setStatus('error');
        onError?.(err instanceof Error ? err : new Error(errorMessage));
      }
    }

    void initDatabase();

    return () => {
      mounted = false;
      if (dbInstance) {
        void dbInstance.close();
      }
      // Reset state to prevent stale closed database references
      setDb(null);
      setServices(null);
      setStatus('idle');
    };
  }, [effectivePath, initAttempt, onReady, onError]);

  // ─────────────────────────────────────────────────────────────────────────
  // App State Handling (Background/Foreground)
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!db) return;

    const mobileDb = db as MobileDatabase;

    function handleAppStateChange(nextState: AppStateStatus) {
      if (nextState === 'background' || nextState === 'inactive') {
        // App is going to background - suspend database
        void mobileDb.suspend();
      } else if (nextState === 'active') {
        // App is returning to foreground - resume database
        void mobileDb.resume();
      }
    }

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [db]);

  // ─────────────────────────────────────────────────────────────────────────
  // Retry Handler
  // ─────────────────────────────────────────────────────────────────────────

  const retry = useCallback(() => {
    if (status === 'error') {
      // Close any existing db instance before retry
      if (db) {
        void (db as MobileDatabase).close();
        setDb(null);
        setServices(null);
      }
      setInitAttempt((prev) => prev + 1);
    }
  }, [status, db]);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  const contextValue: DatabaseContextValue = {
    db,
    services,
    status,
    error,
    platform,
    retry,
    isLoading: status === 'initializing',
    isReady: status === 'ready' && db !== null && services !== null,
  };

  return <DatabaseContext.Provider value={contextValue}>{children}</DatabaseContext.Provider>;
}
