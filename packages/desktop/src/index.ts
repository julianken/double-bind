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
export { Router } from './components/index.js';
export type { Route, RouteComponentProps, RouterProps } from './components/index.js';
