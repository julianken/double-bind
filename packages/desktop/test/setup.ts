/**
 * Test setup for desktop package.
 *
 * Configures:
 * - React Testing Library cleanup
 * - DOM cleanup between tests
 */

import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup after each test
afterEach(() => {
  cleanup();
  // Clear the document body safely
  document.body.textContent = '';
});
