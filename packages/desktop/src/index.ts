/**
 * @double-bind/desktop - Tauri + React desktop application
 *
 * Main exports for the Double-Bind desktop application.
 */

// Providers
export {
  ServiceProvider,
  useServices,
  type Services,
  type ServiceProviderProps,
} from './providers/index.js';

// Stores
export { useAppStore } from './stores/index.js';
export type { AppStore, RightPanelContent } from './stores/index.js';

// Components
export { Router, ErrorBoundary } from './components/index.js';
export type {
  Route,
  RouteComponentProps,
  RouterProps,
  ErrorBoundaryProps,
  ErrorBoundaryState,
} from './components/index.js';

// Hooks
export {
  useCozoQuery,
  invalidateQueries,
  type UseCozoQueryOptions,
  type UseCozoQueryResult,
} from './hooks/index.js';

// Editor
export {
  createPersistencePlugin,
  persistencePluginKey,
  getPersistenceState,
  DEFAULT_DEBOUNCE_MS,
  type PersistencePluginOptions,
} from './editor/index.js';

// Layout
export { AppShell, type AppShellProps } from './layout/index.js';

// Screens
export { PageView, PageTitle, BlockNode, type PageViewProps } from './screens/index.js';
