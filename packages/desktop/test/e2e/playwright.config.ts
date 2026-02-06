/**
 * Playwright configuration for Layer 3 E2E tests
 *
 * Tests UI flows in a real browser against the Vite dev server.
 * Tauri's invoke() calls are intercepted by a test shim that routes to cozo-node.
 *
 * @see docs/testing/e2e-fast.md
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',

  // Run tests in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,

  // Reporter configuration
  // CRITICAL: JSON reporter for reliable result parsing
  // Terminal output may not show failure counts (TTY issues, background runs)
  reporter: [
    ['list'],
    ['json', { outputFile: '../../../../test-results/results.json' }],
    ['html', { outputFolder: '../../../../playwright-report', open: 'never' }],
  ],

  // Shared settings for all projects
  use: {
    // Base URL to use in actions like `await page.goto('/')`
    baseURL: 'http://localhost:5173',

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',
  },

  // Web server configuration
  webServer: {
    command: 'E2E_TEST=true pnpm dev',
    port: 5173,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {
      E2E_TEST: 'true',
    },
  },

  // Global setup for HTTP bridge
  globalSetup: './setup/global-setup.ts',
  globalTeardown: './setup/global-teardown.ts',

  // Configure projects for browsers
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

  // Timeout for each test
  timeout: 30000,

  // Expect timeout
  expect: {
    timeout: 5000,
  },
});
