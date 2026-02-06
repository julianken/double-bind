/**
 * Playwright Configuration for Layer 3 E2E Tests
 *
 * Tests UI flows in a real browser against the Vite dev server.
 * Tauri's invoke() calls are intercepted by a test shim that routes
 * to cozo-node via HTTP bridge.
 *
 * @see docs/testing/e2e-fast.md for architecture details
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 30000,

  // CRITICAL: JSON reporter for reliable result parsing
  // Terminal output may not show failure counts (TTY issues, background runs)
  reporter: [
    ['list'],
    ['json', { outputFile: '../../test-results/results.json' }],
    ['html', { outputFolder: '../../playwright-report', open: 'never' }],
  ],

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  // Configure projects for different browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // WebKit too, since Tauri uses WebKit on macOS
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  // Start the Vite dev server before running tests
  webServer: {
    command: 'pnpm dev',
    port: 5173,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
