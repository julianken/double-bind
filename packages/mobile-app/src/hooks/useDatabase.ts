/**
 * useDatabase hook - Access the database context from any component.
 *
 * This hook provides access to the MobileDatabase instance and its
 * initialization state. It must be used within a DatabaseProvider.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { db, status, error } = useDatabase();
 *
 *   if (status === 'initializing') return <Loading />;
 *   if (status === 'error') return <Error message={error} />;
 *   if (!db) return null;
 *
 *   // Use db for queries...
 * }
 * ```
 */
import { useContext } from 'react';
import { DatabaseContext, type DatabaseContextValue } from '../providers/DatabaseProvider';

/**
 * Hook to access the database context.
 *
 * @returns The database context value containing db instance and status
 * @throws Error if used outside of a DatabaseProvider
 */
export function useDatabase(): DatabaseContextValue {
  const context = useContext(DatabaseContext);

  if (context === null) {
    throw new Error(
      'useDatabase must be used within a DatabaseProvider. ' +
        'Wrap your app with <DatabaseProvider> to fix this error.'
    );
  }

  return context;
}

/**
 * Hook to access the database instance only when ready.
 *
 * This is a convenience hook that throws if the database is not ready,
 * useful for components that should only render when the database is available.
 *
 * @returns The ready database instance
 * @throws Error if database is not ready or used outside provider
 */
export function useDatabaseReady(): DatabaseContextValue & {
  db: NonNullable<DatabaseContextValue['db']>;
} {
  const context = useDatabase();

  if (context.status !== 'ready' || context.db === null) {
    throw new Error(
      'useDatabaseReady requires the database to be initialized. ' +
        `Current status: ${context.status}. ` +
        'Use useDatabase for components that handle loading states.'
    );
  }

  return context as DatabaseContextValue & {
    db: NonNullable<DatabaseContextValue['db']>;
  };
}
