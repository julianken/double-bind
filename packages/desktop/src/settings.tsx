/**
 * Settings window entry point — placeholder for WP-1B.
 *
 * Full settings UI implementation is tracked in a future work package.
 * This stub allows the multi-page Vite build to resolve settings.html.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Design system — tokens, reset, and global styles
import '@double-bind/ui-primitives/styles';

const rootElement = document.getElementById('settings-root');
if (!rootElement) {
  throw new Error('Failed to find settings-root element');
}

createRoot(rootElement).render(
  <StrictMode>
    <div style={{ padding: '2rem', fontFamily: 'var(--font-ui)' }}>
      <h1 style={{ fontSize: 'var(--text-h1)' }}>Settings</h1>
      <p style={{ color: 'var(--text-secondary)' }}>Settings UI coming soon.</p>
    </div>
  </StrictMode>
);
