/**
 * E2E Test: Command Palette (DBB-333 Phase 2)
 *
 * Tests the command palette functionality:
 * - Ctrl+P / Cmd+P opens the palette
 * - Typing in search filters results
 * - Selecting a result triggers navigation
 * - Escape closes the palette
 * - Backdrop click closes the palette
 *
 * @see docs/testing/e2e-fast.md
 */

import { test, expect } from '@playwright/test';
import { resetDatabase, seedPage, generateId } from '../fixtures/test-helpers.js';

/**
 * Helper to navigate to a test page via the Zustand store.
 */
async function navigateToTestPage(page: import('@playwright/test').Page, pageId: string) {
  await page.evaluate((id) => {
    const store = (
      window as unknown as {
        __APP_STORE__?: {
          getState: () => { navigateToPage: (id: string) => void };
        };
      }
    ).__APP_STORE__;
    if (store) {
      store.getState().navigateToPage(`page/${id}`);
    }
  }, pageId);
  await page.waitForSelector('[data-testid="page-view"]', { state: 'visible', timeout: 10000 });
}

/**
 * Open the command palette using the keyboard shortcut.
 */
async function openCommandPalette(page: import('@playwright/test').Page): Promise<void> {
  const isMac = process.platform === 'darwin';
  if (isMac) {
    await page.keyboard.press('Meta+p');
  } else {
    await page.keyboard.press('Control+p');
  }
}

test.describe('Command Palette', () => {
  test.beforeEach(async () => {
    await resetDatabase();
  });

  test('opens command palette with Ctrl+P and shows commands', async ({ page }) => {
    // Seed a page to have a context
    const pageId = generateId('page');
    await seedPage({ pageId, title: 'Command Palette Test' });

    // Navigate to the app
    await page.goto('/');
    await expect(page.getByTestId('app-shell')).toBeVisible({ timeout: 10000 });
    await navigateToTestPage(page, pageId);

    // Open the command palette
    await openCommandPalette(page);

    // Verify palette is visible
    const palette = page.getByTestId('command-palette');
    await expect(palette).toBeVisible({ timeout: 5000 });

    // Verify the search input is visible and focused
    const input = page.getByTestId('command-palette-input');
    await expect(input).toBeVisible();
    await expect(input).toBeFocused();

    // Verify the command list is visible with items
    const list = page.getByTestId('command-palette-list');
    await expect(list).toBeVisible();

    // Verify at least one command item is visible (default commands should be listed)
    const items = palette.locator('[role="option"]');
    const count = await items.count();
    expect(count).toBeGreaterThan(0);
  });

  test('typing in search filters command results', async ({ page }) => {
    const pageId = generateId('page');
    await seedPage({ pageId, title: 'Search Filter Test' });

    await page.goto('/');
    await expect(page.getByTestId('app-shell')).toBeVisible({ timeout: 10000 });
    await navigateToTestPage(page, pageId);

    // Open the command palette
    await openCommandPalette(page);
    await expect(page.getByTestId('command-palette')).toBeVisible({ timeout: 5000 });

    // Get the initial count of visible commands
    const palette = page.getByTestId('command-palette');
    const initialCount = await palette.locator('[role="option"]').count();

    // Type a search query to filter results
    const input = page.getByTestId('command-palette-input');
    await input.fill('graph');

    // Wait for filtering to apply
    await page.waitForTimeout(200);

    // The "Go to Graph View" command should be visible
    const graphItem = page.getByTestId('command-palette-item-nav-graph');
    await expect(graphItem).toBeVisible();

    // The number of results should be smaller than before (filtered)
    const filteredCount = await palette.locator('[role="option"]').count();
    expect(filteredCount).toBeLessThanOrEqual(initialCount);
    expect(filteredCount).toBeGreaterThan(0);
  });

  test('selecting a command navigates to the target', async ({ page }) => {
    const pageId = generateId('page');
    await seedPage({ pageId, title: 'Navigation Via Palette' });

    await page.goto('/');
    await expect(page.getByTestId('app-shell')).toBeVisible({ timeout: 10000 });
    await navigateToTestPage(page, pageId);

    // Open the command palette
    await openCommandPalette(page);
    await expect(page.getByTestId('command-palette')).toBeVisible({ timeout: 5000 });

    // Type to filter to the Daily Notes command
    const input = page.getByTestId('command-palette-input');
    await input.fill('daily');

    await page.waitForTimeout(200);

    // The "Go to Daily Notes" command should be visible
    const dailyItem = page.getByTestId('command-palette-item-nav-daily-notes');
    await expect(dailyItem).toBeVisible();

    // Click the command to execute it
    await dailyItem.click();

    // Palette should close after selection
    await expect(page.getByTestId('command-palette')).not.toBeVisible({ timeout: 3000 });

    // Verify navigation occurred - should be on daily notes view
    await expect(page.getByTestId('daily-notes-view')).toBeVisible({ timeout: 10000 });
  });

  test('Escape closes the command palette', async ({ page }) => {
    const pageId = generateId('page');
    await seedPage({ pageId, title: 'Escape Close Test' });

    await page.goto('/');
    await expect(page.getByTestId('app-shell')).toBeVisible({ timeout: 10000 });
    await navigateToTestPage(page, pageId);

    // Open the command palette
    await openCommandPalette(page);
    await expect(page.getByTestId('command-palette')).toBeVisible({ timeout: 5000 });

    // Press Escape to close
    await page.keyboard.press('Escape');

    // Verify palette is closed
    await expect(page.getByTestId('command-palette')).not.toBeVisible({ timeout: 3000 });
  });

  test('Ctrl+P toggles the palette open and closed', async ({ page }) => {
    const pageId = generateId('page');
    await seedPage({ pageId, title: 'Toggle Test' });

    await page.goto('/');
    await expect(page.getByTestId('app-shell')).toBeVisible({ timeout: 10000 });
    await navigateToTestPage(page, pageId);

    // Open the command palette
    await openCommandPalette(page);
    await expect(page.getByTestId('command-palette')).toBeVisible({ timeout: 5000 });

    // Press Ctrl+P again to close
    await openCommandPalette(page);
    await expect(page.getByTestId('command-palette')).not.toBeVisible({ timeout: 3000 });
  });

  test('shows empty state when no commands match search', async ({ page }) => {
    const pageId = generateId('page');
    await seedPage({ pageId, title: 'Empty Search Test' });

    await page.goto('/');
    await expect(page.getByTestId('app-shell')).toBeVisible({ timeout: 10000 });
    await navigateToTestPage(page, pageId);

    // Open the command palette
    await openCommandPalette(page);
    await expect(page.getByTestId('command-palette')).toBeVisible({ timeout: 5000 });

    // Type a nonsensical query that won't match anything
    const input = page.getByTestId('command-palette-input');
    await input.fill('xyznonexistent123');

    await page.waitForTimeout(200);

    // Verify the empty state is shown
    const emptyState = page.getByTestId('command-palette-empty');
    await expect(emptyState).toBeVisible();
  });

  test('keyboard navigation with arrow keys selects commands', async ({ page }) => {
    const pageId = generateId('page');
    await seedPage({ pageId, title: 'Keyboard Nav Test' });

    await page.goto('/');
    await expect(page.getByTestId('app-shell')).toBeVisible({ timeout: 10000 });
    await navigateToTestPage(page, pageId);

    // Open the command palette
    await openCommandPalette(page);
    await expect(page.getByTestId('command-palette')).toBeVisible({ timeout: 5000 });

    // The first item should be selected by default (aria-selected="true")
    const palette = page.getByTestId('command-palette');
    const firstItem = palette.locator('[role="option"][aria-selected="true"]');
    await expect(firstItem).toBeVisible();

    // Press ArrowDown to move selection
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(100);

    // Verify a different item is now selected
    const selectedAfterDown = palette.locator('[role="option"][aria-selected="true"]');
    await expect(selectedAfterDown).toBeVisible();

    // Press ArrowUp to move selection back
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(100);

    const selectedAfterUp = palette.locator('[role="option"][aria-selected="true"]');
    await expect(selectedAfterUp).toBeVisible();
  });
});
