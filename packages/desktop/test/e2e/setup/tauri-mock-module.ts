/**
 * Mock @tauri-apps/api/core Module for E2E Testing
 *
 * This module replaces the real Tauri core module during E2E testing.
 * It redirects all invoke() calls to the HTTP bridge server running on localhost:3001.
 *
 * Vite is configured to alias @tauri-apps/api/core to this file when E2E_TEST=true.
 *
 * @see docs/testing/e2e-fast.md
 */

const BRIDGE_URL = 'http://localhost:3001';

/**
 * Mock implementation of Tauri's invoke() function.
 * Redirects IPC calls to the HTTP bridge server.
 *
 * @param cmd - The command name (e.g., 'query', 'mutate')
 * @param args - The command arguments
 * @returns Promise resolving to the command result
 * @throws Error if the IPC call fails
 */
export async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
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
  } catch (error) {
    // Re-throw with context
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Mock invoke failed for ${cmd}: ${String(error)}`);
  }
}

// Export other commonly used Tauri core functions as no-ops or stubs
export function transformCallback(): number {
  return 0;
}

export class Channel<T = unknown> {
  id = 0;
  onmessage: ((message: T) => void) | null = null;
}

export class PluginListener {
  plugin = '';
  event = '';
  channelId = 0;
}

export function addPluginListener(): Promise<PluginListener> {
  return Promise.resolve(new PluginListener());
}

export async function convertFileSrc(): Promise<string> {
  return '';
}

export const isTauri = (): boolean => false;
