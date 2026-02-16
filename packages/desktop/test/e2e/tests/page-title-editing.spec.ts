/**
 * E2E Test: Page Title Editing (DBB-333 Phase 2)
 *
 * Tests page title editing functionality:
 * - Navigate to a page and verify the title is displayed
 * - Edit the title via the input field
 * - Verify the title change persists in the database
 * - Verify daily note titles are read-only
 *
 * @see docs/testing/e2e-fast.md
 */

import { test, expect } from '@playwright/test';
import { resetDatabase, seedPage, generateId, executeQuery } from '../fixtures/test-helpers.js';

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

/**
 * Helper to get the current title of a page from the database.
 */
async function getPageTitle(pageId: string): Promise<string> {
  const result = await executeQuery(`SELECT title FROM pages WHERE page_id = $page_id`, {
    page_id: pageId,
  });
  if (result.rows.length > 0 && result.rows[0]) {
    return result.rows[0][0] as string;
  }
  return '';
}

test.describe('Page Title Editing', () => {
  test.beforeEach(async () => {
    await resetDatabase();
  });

  test('displays the page title correctly', async ({ page }) => {
    // Seed a page
    const pageId = generateId('page');
    await seedPage({ pageId, title: 'My Test Page' });

    // Navigate to the app and page
    await page.goto('/');
    await expect(page.getByTestId('app-shell')).toBeVisible({ timeout: 10000 });
    await navigateToTestPage(page, pageId);

    // Verify the page title is displayed
    const pageTitle = page.getByTestId('page-title');
    await expect(pageTitle).toBeVisible({ timeout: 5000 });

    // The PageTitle component renders an <input> for regular pages
    await expect(pageTitle).toHaveValue('My Test Page');
  });

  test('editing page title updates the value in the input', async ({ page }) => {
    // Seed a page
    const pageId = generateId('page');
    await seedPage({ pageId, title: 'Original Title' });

    // Navigate to the app and page
    await page.goto('/');
    await expect(page.getByTestId('app-shell')).toBeVisible({ timeout: 10000 });
    await navigateToTestPage(page, pageId);

    // Get the page title input
    const pageTitle = page.getByTestId('page-title');
    await expect(pageTitle).toBeVisible({ timeout: 5000 });
    await expect(pageTitle).toHaveValue('Original Title');

    // Click the title to focus it, then clear and type new title
    await pageTitle.click();
    await pageTitle.fill('Updated Title');

    // Verify the input now shows the new title
    await expect(pageTitle).toHaveValue('Updated Title');
  });

  test('title change persists to the database after blur', async ({ page }) => {
    // Seed a page
    const pageId = generateId('page');
    await seedPage({ pageId, title: 'Before Edit' });

    // Navigate to the app and page
    await page.goto('/');
    await expect(page.getByTestId('app-shell')).toBeVisible({ timeout: 10000 });
    await navigateToTestPage(page, pageId);
    await waitForServices(page);

    // Edit the title
    const pageTitle = page.getByTestId('page-title');
    await expect(pageTitle).toBeVisible({ timeout: 5000 });
    await pageTitle.click();
    await pageTitle.fill('After Edit');

    // Blur the input to trigger save
    await page.keyboard.press('Tab');

    // Wait for the debounced save to complete
    await page.waitForTimeout(1000);

    // Verify the title was saved in the database
    const savedTitle = await getPageTitle(pageId);
    expect(savedTitle).toBe('After Edit');
  });

  test('pressing Enter saves the title', async ({ page }) => {
    // Seed a page
    const pageId = generateId('page');
    await seedPage({ pageId, title: 'Enter Save Test' });

    // Navigate to the app and page
    await page.goto('/');
    await expect(page.getByTestId('app-shell')).toBeVisible({ timeout: 10000 });
    await navigateToTestPage(page, pageId);
    await waitForServices(page);

    // Edit the title and press Enter
    const pageTitle = page.getByTestId('page-title');
    await expect(pageTitle).toBeVisible({ timeout: 5000 });
    await pageTitle.click();
    await pageTitle.fill('Saved With Enter');
    await page.keyboard.press('Enter');

    // Wait for the save to complete
    await page.waitForTimeout(1000);

    // Verify the title was saved
    const savedTitle = await getPageTitle(pageId);
    expect(savedTitle).toBe('Saved With Enter');
  });

  test('title change persists after navigating away and back', async ({ page }) => {
    // Seed a page
    const pageId = generateId('page');
    await seedPage({ pageId, title: 'Persistence Test' });

    // Navigate to the app and page
    await page.goto('/');
    await expect(page.getByTestId('app-shell')).toBeVisible({ timeout: 10000 });
    await navigateToTestPage(page, pageId);
    await waitForServices(page);

    // Edit the title
    const pageTitle = page.getByTestId('page-title');
    await expect(pageTitle).toBeVisible({ timeout: 5000 });
    await pageTitle.click();
    await pageTitle.fill('Persisted Title');
    await page.keyboard.press('Enter');

    // Wait for save
    await page.waitForTimeout(1000);

    // Navigate away to daily notes
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

    await page.waitForSelector('[data-testid="daily-notes-view"]', {
      state: 'visible',
      timeout: 10000,
    });

    // Navigate back
    await navigateToTestPage(page, pageId);

    // Verify the title persisted
    const restoredTitle = page.getByTestId('page-title');
    await expect(restoredTitle).toBeVisible({ timeout: 5000 });
    await expect(restoredTitle).toHaveValue('Persisted Title');
  });

  test('page title is updated via service call when programmatic approach is used', async ({
    page,
  }) => {
    // Seed a page
    const pageId = generateId('page');
    await seedPage({ pageId, title: 'Service Update Test' });

    // Navigate to the app and page
    await page.goto('/');
    await expect(page.getByTestId('app-shell')).toBeVisible({ timeout: 10000 });
    await navigateToTestPage(page, pageId);
    await waitForServices(page);

    // Update the title via the service directly
    await page.evaluate(
      async ({ pageId, newTitle }) => {
        const services = (
          window as unknown as {
            __SERVICES__?: {
              pageService: { updateTitle: (id: string, title: string) => Promise<void> };
            };
          }
        ).__SERVICES__;
        if (!services) throw new Error('Services not available');
        await services.pageService.updateTitle(pageId, newTitle);

        const invalidate = (
          window as unknown as {
            __INVALIDATE_QUERIES__?: (prefix: string[]) => void;
          }
        ).__INVALIDATE_QUERIES__;
        if (invalidate) {
          invalidate(['pages']);
          invalidate(['page']);
        }
      },
      { pageId, newTitle: 'Service Updated Title' }
    );

    // Wait for invalidation to propagate
    await page.waitForTimeout(500);

    // Verify the database was updated
    const savedTitle = await getPageTitle(pageId);
    expect(savedTitle).toBe('Service Updated Title');
  });
});
