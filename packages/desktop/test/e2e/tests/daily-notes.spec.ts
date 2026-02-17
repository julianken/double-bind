/**
 * E2E Test: Daily Notes (DBB-333 Phase 2)
 *
 * Tests daily notes functionality:
 * - Navigate to daily notes view
 * - Verify today's date is displayed in the title
 * - Verify auto-creation of today's daily note
 * - Verify daily note page exists in the database
 *
 * Note: The DailyNotesView component auto-creates today's daily note
 * via pageService.getTodaysDailyNote() on mount. This test verifies
 * that flow works end-to-end through the mock IPC bridge.
 *
 * @see docs/testing/e2e-fast.md
 */

import { test, expect } from '@playwright/test';
import { resetDatabase, seedPage, generateId, executeQuery } from '../fixtures/test-helpers.js';

/**
 * Helper to get today's date in ISO format (YYYY-MM-DD).
 */
function getTodayISODate(): string {
  return new Date().toISOString().split('T')[0]!;
}

/**
 * Helper to format a date string for display matching DailyNotesView format.
 * Uses en-US locale with weekday, year, month, day.
 */
function formatDailyNoteDate(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00`);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Helper to wait for services to be available.
 */
async function waitForServices(page: import('@playwright/test').Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const services = (
        window as unknown as {
          __SERVICES__?: { pageService: unknown };
        }
      ).__SERVICES__;
      return services && services.pageService;
    },
    { timeout: 10000 }
  );
}

test.describe('Daily Notes', () => {
  test.beforeEach(async () => {
    await resetDatabase();
  });

  test("navigating to daily notes shows today's date in the title", async ({ page }) => {
    // Navigate to the app - default route shows daily notes
    await page.goto('/');
    await expect(page.getByTestId('app-shell')).toBeVisible({ timeout: 10000 });

    // The default route should show daily notes view
    // Navigate explicitly to ensure we're on daily notes
    await page.evaluate(() => {
      const store = (
        window as unknown as {
          __APP_STORE__?: {
            getState: () => { navigateToPage: (id: string) => void };
          };
        }
      ).__APP_STORE__;
      if (store) {
        store.getState().navigateToPage('');
      }
    });

    // Wait for the daily notes view to be visible
    await expect(page.getByTestId('daily-notes-view')).toBeVisible({ timeout: 15000 });

    // Verify the title contains today's formatted date
    const today = getTodayISODate();
    const expectedTitle = formatDailyNoteDate(today);

    const title = page.getByTestId('daily-notes-title');
    await expect(title).toBeVisible({ timeout: 5000 });
    await expect(title).toContainText(expectedTitle);
  });

  test('daily notes view displays the ISO date', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
    await expect(page.getByTestId('app-shell')).toBeVisible({ timeout: 10000 });

    // Navigate to daily notes
    await page.evaluate(() => {
      const store = (
        window as unknown as {
          __APP_STORE__?: {
            getState: () => { navigateToPage: (id: string) => void };
          };
        }
      ).__APP_STORE__;
      if (store) {
        store.getState().navigateToPage('');
      }
    });

    // Wait for the daily notes view
    await expect(page.getByTestId('daily-notes-view')).toBeVisible({ timeout: 15000 });

    // Verify the ISO date element is present
    const today = getTodayISODate();
    const isoDate = page.getByTestId('daily-notes-date-iso');
    await expect(isoDate).toBeVisible({ timeout: 5000 });
    await expect(isoDate).toContainText(today);
  });

  test('auto-creates daily note page in the database', async ({ page }) => {
    // Navigate to the app and trigger daily notes creation
    await page.goto('/');
    await expect(page.getByTestId('app-shell')).toBeVisible({ timeout: 10000 });

    // Navigate to daily notes
    await page.evaluate(() => {
      const store = (
        window as unknown as {
          __APP_STORE__?: {
            getState: () => { navigateToPage: (id: string) => void };
          };
        }
      ).__APP_STORE__;
      if (store) {
        store.getState().navigateToPage('');
      }
    });

    // Wait for the daily notes view to fully render (including auto-creation)
    await expect(page.getByTestId('daily-notes-view')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('daily-notes-title')).toBeVisible({ timeout: 5000 });

    // Allow time for the async page creation to complete
    await page.waitForTimeout(1000);

    // Verify a page with today's daily_note_date exists in the database
    const today = getTodayISODate();
    const result = await executeQuery(
      `SELECT page_id, title, daily_note_date FROM pages WHERE daily_note_date = $today`,
      { today }
    );

    // Should find at least one daily note for today
    // (Multiple may exist if both the view and sidebar trigger creation)
    expect(result.rows.length).toBeGreaterThanOrEqual(1);

    // Verify the daily_note_date matches today
    const dailyNoteDateValue = result.rows[0]![2];
    expect(dailyNoteDateValue).toBe(today);
  });

  test('daily notes auto-creates an initial empty block for immediate typing', async ({ page }) => {
    // Navigate to daily notes
    await page.goto('/');
    await expect(page.getByTestId('app-shell')).toBeVisible({ timeout: 10000 });

    await page.evaluate(() => {
      const store = (
        window as unknown as {
          __APP_STORE__?: {
            getState: () => { navigateToPage: (id: string) => void };
          };
        }
      ).__APP_STORE__;
      if (store) {
        store.getState().navigateToPage('');
      }
    });

    // Wait for the daily notes view
    await expect(page.getByTestId('daily-notes-view')).toBeVisible({ timeout: 15000 });

    // Wait for the content section to load
    const content = page.getByTestId('daily-notes-content');
    await expect(content).toBeVisible({ timeout: 5000 });

    // Daily notes now auto-create an initial empty block for immediate typing,
    // so the block tree should be visible (not the empty state)
    const blockTree = page.locator('[data-testid="block-tree"]');
    await expect(blockTree).toBeVisible({ timeout: 5000 });
  });

  test('pre-seeded daily note is displayed correctly', async ({ page }) => {
    // Seed a daily note page for today
    const today = getTodayISODate();
    const pageId = generateId('daily');
    await seedPage({
      pageId,
      title: today,
      dailyNoteDate: today,
    });

    // Navigate to daily notes
    await page.goto('/');
    await expect(page.getByTestId('app-shell')).toBeVisible({ timeout: 10000 });

    await page.evaluate(() => {
      const store = (
        window as unknown as {
          __APP_STORE__?: {
            getState: () => { navigateToPage: (id: string) => void };
          };
        }
      ).__APP_STORE__;
      if (store) {
        store.getState().navigateToPage('');
      }
    });

    // Wait for the daily notes view
    await expect(page.getByTestId('daily-notes-view')).toBeVisible({ timeout: 15000 });

    // Verify the title shows the formatted date
    const expectedTitle = formatDailyNoteDate(today);
    const title = page.getByTestId('daily-notes-title');
    await expect(title).toBeVisible({ timeout: 5000 });
    await expect(title).toContainText(expectedTitle);
  });

  test('getTodaysDailyNote via service creates the page', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
    await expect(page.getByTestId('app-shell')).toBeVisible({ timeout: 10000 });
    await waitForServices(page);

    // Call the service directly to create/get today's daily note
    const result = await page.evaluate(async () => {
      const services = (
        window as unknown as {
          __SERVICES__?: {
            pageService: {
              getTodaysDailyNote: () => Promise<{
                pageId: string;
                title: string;
                dailyNoteDate: string | null;
              }>;
            };
          };
        }
      ).__SERVICES__;
      if (!services) throw new Error('Services not available');
      const dailyNote = await services.pageService.getTodaysDailyNote();
      return {
        pageId: dailyNote.pageId,
        title: dailyNote.title,
        dailyNoteDate: dailyNote.dailyNoteDate,
      };
    });

    // Verify the returned daily note has today's date
    const today = getTodayISODate();
    expect(result.dailyNoteDate).toBe(today);

    // Verify the page exists in the database
    const dbResult = await executeQuery(
      `SELECT page_id FROM pages WHERE daily_note_date = $today`,
      { today }
    );
    expect(dbResult.rows.length).toBeGreaterThanOrEqual(1);
  });
});
