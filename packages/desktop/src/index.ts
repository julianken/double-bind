/**
 * @double-bind/desktop - Tauri + React desktop application
 *
 * Barrel exports for the desktop package.
 * This file exports components, providers, and utilities that can be
 * used by other parts of the application or for testing.
 */

// Providers
export {
  ServiceProvider,
  useServices,
  type Services,
  type ServiceProviderProps,
} from './providers/index.js';
