/**
 * E2E Test: Backlinks Panel (DBB-211)
 *
 * Tests the backlinks panel functionality:
 * - Creates two pages
 * - Adds a [[link]] from page A to page B
 * - Navigates to page B
 * - Opens backlinks panel with Ctrl+B
 * - Verifies page A appears as a backlink
 * - Verifies clicking the backlink navigates back to page A
 *
 * @see docs/testing/e2e-fast.md
 */

import { test, expect } from '@playwright/test';
import {
  resetDatabase,
  seedPage,
  seedBlock,
  seedLink,
  generateId,
} from '../fixtures/test-helpers.js';

test.describe('Backlinks Panel', () => {
  // Reset database before each test for isolation
  test.beforeEach(async () => {
    await resetDatabase();
  });

  test('displays linked references from another page', async ({ page }) => {
    // Generate unique IDs for test data
    const pageAId = generateId('page-a');
    const pageBId = generateId('page-b');
    const blockId = generateId('block');

    // Seed test data: Page A with a block that links to Page B
    await seedPage({ pageId: pageAId, title: 'Page A' });
    await seedPage({ pageId: pageBId, title: 'Page B' });
    await seedBlock({
      blockId,
      pageId: pageAId,
      content: 'This block links to [[Page B]]',
    });
    await seedLink({
      sourceId: pageAId,
      targetId: pageBId,
      contextBlockId: blockId,
    });

    // Navigate to the app
    await page.goto('/');

    // Navigate to Page B using the store
    await page.evaluate((id) => {
      // Zustand store should be accessible
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
    }, pageBId);

    // Wait for the page view to load
    await page.waitForSelector('[data-testid="page-view"]', { state: 'visible' });

    // Verify we're on Page B
    await expect(page.getByTestId('page-title')).toContainText('Page B');

    // The backlinks section should be visible by default
    const backlinksSection = page.getByTestId('backlinks-section');
    await expect(backlinksSection).toBeVisible();

    // Check the backlinks count
    const backlinksCount = page.getByTestId('backlinks-count');
    await expect(backlinksCount).toContainText('1');

    // Verify the backlinks panel shows Page A as a linked reference
    const backlinksPanel = page.getByTestId('backlinks-panel');
    await expect(backlinksPanel).toBeVisible();

    // Check that the linked references section shows Page A
    const linkedSection = page.getByTestId('linked-section');
    await expect(linkedSection).toBeVisible();

    // Verify the linked header shows correct count
    const linkedHeaderCount = page.getByTestId('linked-header-count');
    await expect(linkedHeaderCount).toContainText('1');

    // Find the page group for Page A (use exact match, not prefix, to avoid matching child elements)
    const pageGroup = page.getByTestId(`page-group-${pageAId}`);
    await expect(pageGroup).toBeVisible();

    // Verify the page title is shown
    const pageTitleButton = page.getByTestId(`page-group-${pageAId}-title`);
    await expect(pageTitleButton).toContainText('Page A');

    // Verify the block content is displayed
    const blockItem = page.getByTestId('block-item-0');
    await expect(blockItem).toBeVisible();
    await expect(blockItem).toContainText('This block links to [[Page B]]');
  });

  test('toggles backlinks panel visibility with Ctrl+B', async ({ page }) => {
    // Seed minimal test data
    const pageId = generateId('page');
    await seedPage({ pageId, title: 'Test Page' });

    // Navigate to the app and page
    await page.goto('/');
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

    await page.waitForSelector('[data-testid="page-view"]', { state: 'visible' });

    // Backlinks section should be visible by default (expanded)
    const backlinksContent = page.getByTestId('backlinks-content');
    await expect(backlinksContent).toBeVisible();

    // Press Ctrl+B (or Cmd+B on Mac) to collapse
    const isMac = process.platform === 'darwin';
    if (isMac) {
      await page.keyboard.press('Meta+b');
    } else {
      await page.keyboard.press('Control+b');
    }

    // Backlinks content should be hidden
    await expect(backlinksContent).not.toBeVisible();

    // Press again to expand
    if (isMac) {
      await page.keyboard.press('Meta+b');
    } else {
      await page.keyboard.press('Control+b');
    }

    // Backlinks content should be visible again
    await expect(backlinksContent).toBeVisible();
  });

  test('clicking backlink navigates to the source page', async ({ page }) => {
    // Generate unique IDs
    const pageAId = generateId('page-a');
    const pageBId = generateId('page-b');
    const blockId = generateId('block');

    // Seed test data
    await seedPage({ pageId: pageAId, title: 'Source Page' });
    await seedPage({ pageId: pageBId, title: 'Target Page' });
    await seedBlock({
      blockId,
      pageId: pageAId,
      content: 'Link to [[Target Page]] here',
    });
    await seedLink({
      sourceId: pageAId,
      targetId: pageBId,
      contextBlockId: blockId,
    });

    // Navigate to the app
    await page.goto('/');

    // Navigate to Target Page (Page B)
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
    }, pageBId);

    await page.waitForSelector('[data-testid="page-view"]', { state: 'visible' });

    // Verify we're on Target Page
    await expect(page.getByTestId('page-title')).toContainText('Target Page');

    // Click on the block item in the backlinks panel to navigate to source
    const blockItem = page.getByTestId('block-item-0');
    await expect(blockItem).toBeVisible();
    await blockItem.click();

    // Verify navigation occurred - we should now be on Source Page
    await expect(page.getByTestId('page-title')).toContainText('Source Page');
  });

  test('clicking page title in backlinks navigates to that page', async ({ page }) => {
    // Generate unique IDs
    const pageAId = generateId('page-a');
    const pageBId = generateId('page-b');
    const blockId = generateId('block');

    // Seed test data
    await seedPage({ pageId: pageAId, title: 'Linking Page' });
    await seedPage({ pageId: pageBId, title: 'Linked Page' });
    await seedBlock({
      blockId,
      pageId: pageAId,
      content: 'Reference to [[Linked Page]]',
    });
    await seedLink({
      sourceId: pageAId,
      targetId: pageBId,
      contextBlockId: blockId,
    });

    // Navigate to Linked Page (Page B)
    await page.goto('/');
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
    }, pageBId);

    await page.waitForSelector('[data-testid="page-view"]', { state: 'visible' });

    // Click on the page title in the backlinks panel (use exact match, not prefix)
    const pageTitleButton = page.getByTestId(`page-group-${pageAId}-title`);
    await expect(pageTitleButton).toBeVisible();
    await pageTitleButton.click();

    // Verify navigation occurred
    await expect(page.getByTestId('page-title')).toContainText('Linking Page');
  });

  test('shows empty state when no backlinks exist', async ({ page }) => {
    // Seed a page with no backlinks
    const pageId = generateId('page');
    await seedPage({ pageId, title: 'Isolated Page' });

    // Navigate to the app and page
    await page.goto('/');
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

    await page.waitForSelector('[data-testid="page-view"]', { state: 'visible' });

    // The backlinks count should show 0
    const backlinksCount = page.getByTestId('backlinks-count');
    await expect(backlinksCount).toContainText('0');

    // The empty state or "No references found" message should be visible
    // when expanded
    const backlinksPanel = page.getByTestId('backlinks-panel');
    await expect(backlinksPanel).toBeVisible();

    // Check for empty state or "No linked references" message
    const emptyState = page.getByTestId('empty-state');
    const linkedEmpty = page.getByTestId('linked-empty');

    // Either the overall empty state or the linked-empty message should be visible
    const hasEmptyState = await emptyState.isVisible().catch(() => false);
    const hasLinkedEmpty = await linkedEmpty.isVisible().catch(() => false);

    expect(hasEmptyState || hasLinkedEmpty).toBe(true);
  });

  test('displays multiple backlinks from different pages', async ({ page }) => {
    // Generate unique IDs
    const pageAId = generateId('page-a');
    const pageBId = generateId('page-b');
    const pageCId = generateId('page-c');
    const blockAId = generateId('block-a');
    const blockBId = generateId('block-b');

    // Seed test data: Pages A and B both link to Page C
    await seedPage({ pageId: pageAId, title: 'Page Alpha' });
    await seedPage({ pageId: pageBId, title: 'Page Beta' });
    await seedPage({ pageId: pageCId, title: 'Page Central' });

    await seedBlock({
      blockId: blockAId,
      pageId: pageAId,
      content: 'Alpha links to [[Page Central]]',
    });
    await seedBlock({
      blockId: blockBId,
      pageId: pageBId,
      content: 'Beta also links to [[Page Central]]',
    });

    await seedLink({
      sourceId: pageAId,
      targetId: pageCId,
      contextBlockId: blockAId,
    });
    await seedLink({
      sourceId: pageBId,
      targetId: pageCId,
      contextBlockId: blockBId,
    });

    // Navigate to Page Central (Page C)
    await page.goto('/');
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
    }, pageCId);

    await page.waitForSelector('[data-testid="page-view"]', { state: 'visible' });

    // Verify we're on Page Central
    await expect(page.getByTestId('page-title')).toContainText('Page Central');

    // The backlinks count should show 2
    const backlinksCount = page.getByTestId('backlinks-count');
    await expect(backlinksCount).toContainText('2');

    // Verify the linked header shows correct count
    const linkedHeaderCount = page.getByTestId('linked-header-count');
    await expect(linkedHeaderCount).toContainText('2');

    // Both block items should be visible
    const blockItem0 = page.getByTestId('block-item-0');
    const blockItem1 = page.getByTestId('block-item-1');
    await expect(blockItem0).toBeVisible();
    await expect(blockItem1).toBeVisible();
  });
});
