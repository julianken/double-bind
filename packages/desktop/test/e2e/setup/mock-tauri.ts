/**
 * Mock Tauri IPC for E2E Testing
 *
 * This module provides a mock implementation of Tauri's invoke() function
 * that redirects calls to the HTTP bridge server.
 *
 * It's injected into the browser context to intercept Tauri API calls.
 *
 * @see docs/testing/e2e-fast.md
 */

const BRIDGE_URL = 'http://localhost:3001';

/**
 * Mock implementation of Tauri's invoke() function.
 * Redirects IPC calls to the HTTP bridge server.
 */
export async function mockInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${BRIDGE_URL}/invoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cmd, args: args ?? {} }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || `IPC call failed: ${cmd}`);
  }

  return response.json();
}

/**
 * Install the mock Tauri API on the window object.
 * This should be called before any Tauri API usage.
 */
export function installMockTauri(): void {
  // Create mock @tauri-apps/api/core module
  const mockTauriCore = {
    invoke: mockInvoke,
  };

  // Store on window for module interception
  (window as unknown as { __TAURI_MOCK__?: typeof mockTauriCore }).__TAURI_MOCK__ = mockTauriCore;
}

// Auto-install when loaded
if (typeof window !== 'undefined') {
  installMockTauri();
}
