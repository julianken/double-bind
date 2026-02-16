/**
 * Main entry point for the Double-Bind desktop application.
 *
 * Initializes services using the appropriate GraphDB provider based on
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
  TauriGraphDBProvider,
  HttpGraphDBProvider,
  isInTauri,
  type GraphDBProvider,
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
 * Create the appropriate GraphDB provider based on runtime environment.
 * Uses TauriGraphDBProvider in the desktop app, HttpGraphDBProvider in browser.
 */
function createGraphDBProvider(): GraphDBProvider {
  if (isInTauri()) {
    return new TauriGraphDBProvider();
  }
  return new HttpGraphDBProvider();
}

// Run migrations and then render the app
async function initializeApp() {
  // Create the appropriate provider for this environment
  const provider = createGraphDBProvider();
  await provider.initialize();

  // Get the GraphDB instance from the provider
  // Note: Schema migrations are handled by the data layer:
  // - Production: Rust init_database Tauri command (rusqlite)
  // - E2E tests: global-setup.ts applies SQLite schema directly
  const graphDB = provider.getGraphDB();

  // Create services from the GraphDB
  const services = { ...createServices(graphDB), graphDB };

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
