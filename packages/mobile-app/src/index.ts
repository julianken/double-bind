/**
 * Double-Bind Mobile App Package
 *
 * This package provides React Native components and hooks for building
 * the Double-Bind mobile application.
 *
 * @example
 * ```tsx
 * import { DatabaseProvider, useDatabase } from '@double-bind/mobile-app';
 *
 * function App() {
 *   return (
 *     <DatabaseProvider>
 *       <MainScreen />
 *     </DatabaseProvider>
 *   );
 * }
 *
 * function MainScreen() {
 *   const { db, status } = useDatabase();
 *   // ...
 * }
 * ```
 */

// Providers
export {
  DatabaseProvider,
  DatabaseContext,
  type DatabaseContextValue,
  type DatabaseProviderProps,
  type DatabaseStatus,
  type MobilePlatform,
} from './providers';

// Hooks
export { useDatabase, useDatabaseReady } from './hooks';
