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
  // CRITICAL: Never run E2E tests in parallel - causes severe resource exhaustion
  // See CLAUDE.md for details
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // CRITICAL: Always use single worker - parallel E2E causes severe resource exhaustion
  workers: 1,
  timeout: 30000,

  // Global setup/teardown to start HTTP bridge server for mock Tauri IPC
  globalSetup: './test/e2e/setup/global-setup.ts',
  globalTeardown: './test/e2e/setup/global-teardown.ts',

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
  // E2E_TEST=true enables Tauri mock module aliasing in vite.config.ts
  webServer: {
    command: 'E2E_TEST=true pnpm dev',
    port: 5173,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {
      E2E_TEST: 'true',
    },
  },
});
