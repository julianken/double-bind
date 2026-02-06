/**
 * Main entry point for the Double-Bind desktop application.
 *
 * Initializes services using the Tauri GraphDB client and renders the app
 * wrapped in ServiceProvider for dependency injection.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { tauriGraphDB, createServices } from '@double-bind/core';
import { ServiceProvider } from './providers/ServiceProvider.js';
import { App } from './App.js';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Failed to find root element');
}

// Create services from the GraphDB
// In E2E mode, tauriGraphDB is mocked to use the HTTP bridge
const services = createServices(tauriGraphDB);

createRoot(rootElement).render(
  <StrictMode>
    <ServiceProvider services={services}>
      <App />
    </ServiceProvider>
  </StrictMode>
);
