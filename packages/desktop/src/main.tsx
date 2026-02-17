/**
 * Main entry point for the Double-Bind desktop application.
 *
 * Initializes services using the appropriate Database provider based on
 * the runtime environment (Tauri desktop or browser for E2E testing).
 * Renders the app wrapped in ServiceProvider and QueryClientProvider
 * for dependency injection.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { createServices } from '@double-bind/core';
import {
  ServiceProvider,
  TauriDatabaseProvider,
  HttpDatabaseProvider,
  isInTauri,
  type DatabaseProvider,
} from './providers/index.js';
import { App } from './App.js';
import { queryClient } from './lib/queryClient.js';
import { invalidateQueries } from './hooks/useCozoQuery.js';
import { initializeTheme } from './hooks/useTheme.js';

// Design system - tokens, reset, and global styles
import '@double-bind/ui-primitives/styles';

// Initialize theme before React renders to prevent flash
initializeTheme();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Failed to find root element');
}

// Type assertion is safe because we throw above if null
const root = rootElement as HTMLElement;

/**
 * Create the appropriate Database provider based on runtime environment.
 * Uses TauriDatabaseProvider in the desktop app, HttpDatabaseProvider in browser.
 */
function createDatabaseProvider(): DatabaseProvider {
  if (isInTauri()) {
    return new TauriDatabaseProvider();
  }
  return new HttpDatabaseProvider();
}

// Run migrations and then render the app
async function initializeApp() {
  // Create the appropriate provider for this environment
  const provider = createDatabaseProvider();
  await provider.initialize();

  // Get the Database instance from the provider
  // Note: Schema migrations are handled by the data layer:
  // - Production: Rust init_database Tauri command (rusqlite)
  // - E2E tests: global-setup.ts applies SQLite schema directly
  const database = provider.getDatabase();

  // Create services from the Database
  const services = { ...createServices(database), database };

  // Expose services on window for E2E testing/debugging
  (window as unknown as { __SERVICES__: typeof services }).__SERVICES__ = services;

  // Expose invalidateQueries on window for E2E testing
  (
    window as unknown as { __INVALIDATE_QUERIES__: typeof invalidateQueries }
  ).__INVALIDATE_QUERIES__ = invalidateQueries;

  createRoot(root).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <ServiceProvider services={services}>
          <App />
        </ServiceProvider>
      </QueryClientProvider>
    </StrictMode>
  );
}

initializeApp();
