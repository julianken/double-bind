/**
 * E2E Test: Page Creation Flow (DBB-104)
 *
 * Tests the page view and block rendering using seeded data:
 * 1. Navigate to a seeded page
 * 2. Verify page renders with correct title
 * 3. Verify blocks render correctly
 * 4. Verify page appears in sidebar
 * 5. Verify editor activation on click
 *
 * Note: These tests seed pages directly rather than using the "New Page" button
 * because the migration system has conflicts in the E2E test environment.
 * Block editing tests are deferred until DBB-326 fixes the Enter key behavior.
 *
 * @see docs/testing/e2e-fast.md
 */

import { test, expect } from '@playwright/test';
import { resetDatabase, seedPage, seedBlock, generateId } from '../fixtures/test-helpers.js';

// ============================================================================
// Helpers
// ============================================================================

/**
 * Navigate to a page using the Zustand store
 */
async function navigateToPageById(page: import('@playwright/test').Page, pageId: string) {
  await page.evaluate((id) => {
    const store = (
      window as unknown as {
        __APP_STORE__?: {
          getState: () => { navigateToPage: (path: string) => void };
        };
      }
    ).__APP_STORE__;
    if (store) {
      store.getState().navigateToPage(`page/${id}`);
    }
  }, pageId);
}

/**
 * Click on a block to focus it
 * Handles both static content blocks and empty block editor states
 */
async function clickOnBlock(page: import('@playwright/test').Page, index: number = 0) {
  // Wait for block tree to be ready
  await page.waitForTimeout(300);

  // Try clicking on the block node's content area
  const blockNode = page.getByTestId('block-node').nth(index);
  await expect(blockNode).toBeVisible({ timeout: 5000 });

  // First try clicking on static content if available
  const staticContent = blockNode.locator('[data-testid="static-block-content"]');
  const hasStaticContent = await staticContent.isVisible().catch(() => false);

  if (hasStaticContent) {
    await staticContent.click();
  } else {
    // Block may already have an editor (empty block) - click on the block content area
    const blockContent = blockNode.locator('.block-content');
    await blockContent.click();
  }
}

// ============================================================================
// Test Suite: Page Creation Flow
// ============================================================================

test.describe('Page Creation Flow', () => {
  test.beforeEach(async () => {
    await resetDatabase();
  });

  test('displays a seeded page with correct title', async ({ page }) => {
    // Seed test data
    const pageId = generateId('page');
    await seedPage({ pageId, title: 'My Test Page' });

    await page.goto('/');
    await expect(page.getByTestId('app-shell')).toBeVisible({ timeout: 10000 });

    // Navigate to the page
    await navigateToPageById(page, pageId);
    await expect(page.getByTestId('page-view')).toBeVisible({ timeout: 5000 });

    // Verify page title
    const pageTitle = page.getByTestId('page-title');
    await expect(pageTitle).toContainText('My Test Page');
  });

  test('displays page with seeded blocks', async ({ page }) => {
    // Seed test data
    const pageId = generateId('page');
    const blockId = generateId('block');
    await seedPage({ pageId, title: 'Page With Blocks' });
    await seedBlock({
      blockId,
      pageId,
      content: 'This is block content',
      order: 'a0',
    });

    await page.goto('/');
    await expect(page.getByTestId('app-shell')).toBeVisible({ timeout: 10000 });

    // Navigate to the page
    await navigateToPageById(page, pageId);
    await expect(page.getByTestId('page-view')).toBeVisible({ timeout: 5000 });

    // Verify block tree exists
    const blockTree = page.getByTestId('block-tree');
    await expect(blockTree).toBeVisible({ timeout: 5000 });

    // Verify block content
    await expect(blockTree).toContainText('This is block content');
  });

  test('displays multiple blocks in correct order', async ({ page }) => {
    // Seed test data
    const pageId = generateId('page');
    await seedPage({ pageId, title: 'Ordered Blocks Page' });
    await seedBlock({
      blockId: generateId('block-1'),
      pageId,
      content: 'First Block',
      order: 'a0',
    });
    await seedBlock({
      blockId: generateId('block-2'),
      pageId,
      content: 'Second Block',
      order: 'a1',
    });
    await seedBlock({
      blockId: generateId('block-3'),
      pageId,
      content: 'Third Block',
      order: 'a2',
    });

    await page.goto('/');
    await expect(page.getByTestId('app-shell')).toBeVisible({ timeout: 10000 });

    // Navigate to the page
    await navigateToPageById(page, pageId);
    await expect(page.getByTestId('page-view')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('block-tree')).toBeVisible({ timeout: 5000 });

    // Verify blocks are present
    const blockNodes = page.getByTestId('block-node');
    await expect(blockNodes).toHaveCount(3, { timeout: 5000 });

    // Verify order by checking text content positions
    const blockTree = page.getByTestId('block-tree');
    const blockTreeText = await blockTree.textContent();

    const firstIndex = blockTreeText?.indexOf('First Block') ?? -1;
    const secondIndex = blockTreeText?.indexOf('Second Block') ?? -1;
    const thirdIndex = blockTreeText?.indexOf('Third Block') ?? -1;

    expect(firstIndex).toBeGreaterThan(-1);
    expect(secondIndex).toBeGreaterThan(firstIndex);
    expect(thirdIndex).toBeGreaterThan(secondIndex);
  });

  test('page appears in sidebar page list', async ({ page }) => {
    // Seed test data
    const pageId = generateId('page');
    await seedPage({ pageId, title: 'Sidebar Test Page' });

    await page.goto('/');
    await expect(page.getByTestId('app-shell')).toBeVisible({ timeout: 10000 });

    // Check the page list shows the page
    const pageList = page.getByTestId('page-list');
    await expect(pageList).toBeVisible({ timeout: 5000 });

    // Find the page item
    const pageItem = pageList
      .locator('.page-list-item__title')
      .filter({ hasText: 'Sidebar Test Page' });
    await expect(pageItem).toBeVisible();
  });

  test('can click on a block to activate the editor', async ({ page }) => {
    // Seed test data - page with a block
    const pageId = generateId('page');
    const blockId = generateId('block');
    await seedPage({ pageId, title: 'Edit Test Page' });
    await seedBlock({
      blockId,
      pageId,
      content: 'Click me to edit',
      order: 'a0',
    });

    await page.goto('/');
    await expect(page.getByTestId('app-shell')).toBeVisible({ timeout: 10000 });

    // Navigate to the page
    await navigateToPageById(page, pageId);
    await expect(page.getByTestId('page-view')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('block-tree')).toBeVisible({ timeout: 5000 });

    // Click on the block
    await clickOnBlock(page);

    // The ProseMirror editor should now be visible
    const editor = page.locator('.ProseMirror').first();
    await expect(editor).toBeVisible({ timeout: 5000 });
  });

  test('can navigate between multiple pages', async ({ page }) => {
    // Seed test data - two pages with distinct content
    const page1Id = generateId('page-1');
    const page2Id = generateId('page-2');
    await seedPage({ pageId: page1Id, title: 'Page One' });
    await seedPage({ pageId: page2Id, title: 'Page Two' });
    await seedBlock({
      blockId: generateId('block-1'),
      pageId: page1Id,
      content: 'Content for Page One',
      order: 'a0',
    });
    await seedBlock({
      blockId: generateId('block-2'),
      pageId: page2Id,
      content: 'Content for Page Two',
      order: 'a0',
    });

    await page.goto('/');
    await expect(page.getByTestId('app-shell')).toBeVisible({ timeout: 10000 });

    // Navigate to Page One
    await navigateToPageById(page, page1Id);
    await expect(page.getByTestId('page-view')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('page-title')).toContainText('Page One');
    await expect(page.getByTestId('block-tree')).toContainText('Content for Page One');

    // Navigate to Page Two
    await navigateToPageById(page, page2Id);
    await expect(page.getByTestId('page-view')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('page-title')).toContainText('Page Two');
    await expect(page.getByTestId('block-tree')).toContainText('Content for Page Two');

    // Navigate back to Page One
    await navigateToPageById(page, page1Id);
    await expect(page.getByTestId('page-title')).toContainText('Page One');
    await expect(page.getByTestId('block-tree')).toContainText('Content for Page One');
  });
});
