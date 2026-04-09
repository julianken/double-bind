/**
 * Test setup for desktop package.
 *
 * Configures:
 * - React Testing Library cleanup
 * - DOM cleanup between tests
 * - Global browser API mocks for jsdom compatibility
 */

import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// ============================================================================
// ResizeObserver mock
// ============================================================================
// jsdom does not implement ResizeObserver. Both dnd-kit and CodeMirror use it,
// and without this mock they throw during mount/unmount causing test pollution.
// The mock satisfies the observe/unobserve/disconnect contract as no-ops.

class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (typeof window !== 'undefined') {
  window.ResizeObserver = MockResizeObserver;
}

// ============================================================================
// Cleanup after each test
// ============================================================================

afterEach(() => {
  cleanup();
  // Remove all child nodes from body without using innerHTML assignment
  while (document.body.firstChild) {
    document.body.removeChild(document.body.firstChild);
  }
});
