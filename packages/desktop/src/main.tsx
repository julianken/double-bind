/**
 * Main entry point for the Double-Bind desktop application.
 *
 * Initializes services using the Tauri GraphDB client and renders the app
 * wrapped in ServiceProvider for dependency injection.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { tauriGraphDB, httpGraphDB, isInTauri, createServices } from '@double-bind/core';
import { runMigrations } from '@double-bind/migrations';
import { ServiceProvider } from './providers/ServiceProvider.js';
import { App } from './App.js';
import { invalidateQueries } from './hooks/useCozoQuery.js';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Failed to find root element');
}

// Type assertion is safe because we throw above if null
const root = rootElement as HTMLElement;

// Run migrations and then render the app
async function initializeApp() {
  // Auto-detect environment: use Tauri IPC in desktop app, HTTP bridge in browser
  const graphDB = isInTauri() ? tauriGraphDB : httpGraphDB;

  try {
    // Run database migrations before rendering
    await runMigrations(graphDB);
  } catch {
    // Continue rendering - app will show error state
  }

  // Create services from the GraphDB
  const services = createServices(graphDB);

  // Expose services on window for E2E testing/debugging
  (window as unknown as { __SERVICES__: typeof services }).__SERVICES__ = services;

  // Expose invalidateQueries on window for E2E testing
  (
    window as unknown as { __INVALIDATE_QUERIES__: typeof invalidateQueries }
  ).__INVALIDATE_QUERIES__ = invalidateQueries;

  createRoot(root).render(
    <StrictMode>
      <ServiceProvider services={services}>
        <App />
      </ServiceProvider>
    </StrictMode>
  );
}

initializeApp();
