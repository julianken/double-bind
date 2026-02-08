/**
 * E2E Test: App smoke tests
 *
 * Layer 3 E2E test using Playwright that verifies basic app structure.
 *
 * @see docs/testing/e2e-fast.md for test infrastructure details
 */

import { test, expect } from '@playwright/test';

// ============================================================================
// Smoke Tests - Basic App Structure
// ============================================================================

test.describe('App smoke tests', () => {
  test('app loads and displays shell', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('app-shell')).toBeVisible();
  });

  test('sidebar is visible by default', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('sidebar')).toBeVisible();
  });

  test('navigation bar is visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('navigation-bar')).toBeVisible();
  });

  test('daily notes view is shown by default', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('daily-notes-view')).toBeVisible();
  });

  // "sidebar navigation buttons" test removed: it expected Daily Notes, Graph View,
  // and Query Editor buttons from SimpleSidebar (dead code). The real Sidebar component
  // only has Graph View and Create new page. Sidebar buttons are covered by Sidebar.test.tsx.
});
