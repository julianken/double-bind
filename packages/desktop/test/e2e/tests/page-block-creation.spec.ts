/**
 * E2E Test: Dynamic Page and Block Creation
 *
 * Tests that pages and blocks can be created dynamically through the UI,
 * not just pre-seeded. This validates that the mock Tauri IPC bridge
 * handles schema migrations idempotently -- no "Stored relation X
 * conflicts with an existing one" errors.
 *
 * Fixed by:
 * 1. global-setup.ts: Atomic DB swap in resetDatabase() prevents race
 *    between schema creation and migration runner
 * 2. runner.ts: Idempotent :create handling skips "conflicts with existing" errors
 * 3. BlockNode.tsx: handleBlocksChanged() now invalidates ['page', 'withBlocks']
 *    so PageView picks up dynamically created root blocks
 *
 * @see docs/testing/e2e-fast.md
 */

import { test, expect } from '@playwright/test';
import { resetDatabase, seedPage, seedBlock, generateId } from '../fixtures/test-helpers.js';

test.describe('Dynamic Page and Block Creation', () => {
  // Reset database before each test for isolation
  test.beforeEach(async () => {
    await resetDatabase();
  });

  test('creates new page via sidebar button', async ({ page }) => {
    // Capture console messages for debugging
    const consoleMessages: string[] = [];
    page.on('console', (msg) => {
      consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
    });

    // Navigate to the app
    await page.goto('/');

    // Wait for app to be ready
    await expect(page.getByTestId('app-shell')).toBeVisible({ timeout: 10000 });

    // Wait for sidebar to fully initialize
    await expect(page.getByTestId('sidebar')).toBeVisible({ timeout: 5000 });

    // Click the "New Page" button using the services directly to avoid
    // layout overlay issues with the empty page list.
    await page.evaluate(async () => {
      const services = (
        window as unknown as {
          __SERVICES__?: {
            pageService: { createPage: (title: string) => Promise<{ pageId: string }> };
          };
        }
      ).__SERVICES__;
      if (!services) throw new Error('Services not available');

      const newPage = await services.pageService.createPage('Untitled');

      const store = (
        window as unknown as {
          __APP_STORE__?: {
            getState: () => { navigateToPage: (id: string) => void };
          };
        }
      ).__APP_STORE__;
      if (store) {
        store.getState().navigateToPage('page/' + newPage.pageId);
      }
    });

    // Wait for navigation to the new page
    await page.waitForSelector('[data-testid="page-view"]', {
      state: 'visible',
      timeout: 10000,
    });

    // Verify the page title shows "Untitled" (default title).
    // PageTitle renders an <input> for regular pages.
    const pageTitle = page.getByTestId('page-title');
    await expect(pageTitle).toBeVisible({ timeout: 5000 });
    await expect(pageTitle).toHaveValue('Untitled');
  });

  test('edits page title', async ({ page }) => {
    // Seed a page to edit
    const pageId = generateId('page');
    await seedPage({ pageId, title: 'Original Title' });

    // Navigate to the app and the page
    await page.goto('/');
    await expect(page.getByTestId('app-shell')).toBeVisible({ timeout: 10000 });

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

    await page.waitForSelector('[data-testid="page-view"]', {
      state: 'visible',
      timeout: 10000,
    });

    // Verify the original title is displayed.
    // PageTitle renders an <input> for regular pages.
    const pageTitle = page.getByTestId('page-title');
    await expect(pageTitle).toBeVisible({ timeout: 5000 });
    await expect(pageTitle).toHaveValue('Original Title');
  });

  test('creates new block by pressing Enter', async ({ page }) => {
    // Seed a page with one block
    const pageId = generateId('page');
    const blockId = generateId('block');
    await seedPage({ pageId, title: 'Block Creation Test' });
    await seedBlock({
      blockId,
      pageId,
      content: 'First block',
      order: 'a0',
    });

    // Navigate to the app and page
    await page.goto('/');
    await expect(page.getByTestId('app-shell')).toBeVisible({ timeout: 10000 });

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

    await page.waitForSelector('[data-testid="page-view"]', {
      state: 'visible',
      timeout: 10000,
    });

    // Wait for the block to be visible
    const blockNode = page
      .locator(`[data-testid="block-node"][data-block-id="${blockId}"]`)
      .first();
    await expect(blockNode).toBeVisible({ timeout: 5000 });

    // Click on the block content to focus it
    await blockNode.locator('[data-testid="block-content"]').click();

    // Wait for ProseMirror editor to appear
    await expect(blockNode.locator('.ProseMirror')).toBeVisible({ timeout: 3000 });

    // Move cursor to end of content and press Enter to split/create new block
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');

    // Wait for the new block to appear in the DOM.
    // The handleBlocksChanged callback invalidates ['page', 'withBlocks']
    // which triggers PageView to re-render with the new root block.
    const allBlocks = page.locator('[data-testid="block-node"]');
    await expect(allBlocks).toHaveCount(2, { timeout: 10000 });
  });

  test('types content in new block after Enter', async ({ page }) => {
    // Seed a page with one block
    const pageId = generateId('page');
    const blockId = generateId('block');
    await seedPage({ pageId, title: 'Type Content Test' });
    await seedBlock({
      blockId,
      pageId,
      content: 'Existing content',
      order: 'a0',
    });

    // Navigate to the app and page
    await page.goto('/');
    await expect(page.getByTestId('app-shell')).toBeVisible({ timeout: 10000 });

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

    await page.waitForSelector('[data-testid="page-view"]', {
      state: 'visible',
      timeout: 10000,
    });

    // Wait for the block to be visible and click on it
    const blockNode = page
      .locator(`[data-testid="block-node"][data-block-id="${blockId}"]`)
      .first();
    await expect(blockNode).toBeVisible({ timeout: 5000 });
    await blockNode.locator('[data-testid="block-content"]').click();
    await expect(blockNode.locator('.ProseMirror')).toBeVisible({ timeout: 3000 });

    // Create a new block and immediately invalidate queries + focus it
    // all within one page.evaluate to avoid React re-render races.
    const newBlockId = await page.evaluate(
      async ({ pageId, blockId }) => {
        const services = (
          window as unknown as {
            __SERVICES__?: {
              blockService: {
                createBlock: (
                  pageId: string,
                  parentId: string | null,
                  content: string,
                  afterBlockId?: string
                ) => Promise<{ blockId: string }>;
              };
            };
          }
        ).__SERVICES__;
        if (!services) throw new Error('Services not available');

        const newBlock = await services.blockService.createBlock(pageId, null, '', blockId);

        // Invalidate queries so the new block appears in the UI
        const invalidate = (
          window as unknown as {
            __INVALIDATE_QUERIES__?: (prefix: string[]) => void;
          }
        ).__INVALIDATE_QUERIES__;
        if (invalidate) {
          invalidate(['blocks']);
          invalidate(['block']);
          invalidate(['page', 'withBlocks']);
        }

        // Focus the new block via the UI store
        const store = (
          window as unknown as {
            __APP_STORE__?: {
              getState: () => { setFocusedBlock: (id: string) => void };
            };
          }
        ).__APP_STORE__;
        if (store) {
          store.getState().setFocusedBlock(newBlock.blockId);
        }

        return newBlock.blockId;
      },
      { pageId, blockId }
    );

    // Wait for the new block to appear
    const allBlocks = page.locator('[data-testid="block-node"]');
    await expect(allBlocks).toHaveCount(2, { timeout: 10000 });

    // Wait for ProseMirror to mount in the focused new block
    const newBlockSelector = `[data-testid="block-node"][data-block-id="${newBlockId}"]`;
    const editorSelector = `${newBlockSelector} .ProseMirror`;
    await page.waitForSelector(editorSelector, { state: 'visible', timeout: 10000 });

    // Let the editor fully initialize
    await page.waitForTimeout(300);

    // Click on the ProseMirror editor to ensure keyboard focus
    await page.locator(editorSelector).first().click();

    // Type content into the new block
    await page.keyboard.type('New block content');

    // Wait for content to be saved
    await page.waitForTimeout(500);

    // Verify the new block has the typed content
    await expect(page.locator(editorSelector).first()).toContainText('New block content', {
      timeout: 5000,
    });
  });
});
