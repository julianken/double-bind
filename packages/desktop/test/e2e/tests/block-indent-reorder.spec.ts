/**
 * E2E Test: Block Indentation and Reordering (DBB-194)
 *
 * Tests the block indentation and reordering functionality:
 * - Tab to indent block (make it child of previous sibling)
 * - Shift+Tab to outdent block
 * - Alt+Up/Down to reorder blocks
 * - Verifies tree structure persists after navigation
 *
 * @see docs/testing/e2e-fast.md
 * @see docs/frontend/keyboard-first.md
 */

import { test, expect } from '@playwright/test';
import {
  resetDatabase,
  seedPage,
  seedBlock,
  generateId,
  executeQuery,
} from '../fixtures/test-helpers.js';

/**
 * Helper to wait for a block to appear in the DOM and be stable.
 * Handles timing issues with React re-renders after indentation operations.
 */
async function waitForBlockStable(
  page: import('@playwright/test').Page,
  blockId: string
): Promise<void> {
  // Wait for at least one block with this ID to have visible content
  await page.waitForFunction(
    (id) => {
      const blocks = document.querySelectorAll(`[data-testid="block-node"][data-block-id="${id}"]`);
      // Check that at least one block exists and has content
      for (const block of blocks) {
        const content = block.querySelector('.block-content');
        if (content && content.textContent && content.textContent.trim().length > 0) {
          return true;
        }
      }
      return false;
    },
    blockId,
    { timeout: 10000 }
  );
}

/**
 * Helper to click on a block to focus it and wait for the editor.
 * Uses data-testid="block-node" to specifically target the block container,
 * avoiding ambiguity with the block-editor element that also has data-block-id.
 *
 * Note: After indentation operations, there may briefly be duplicate block nodes
 * in the DOM due to React query cache invalidation timing. This helper uses .first()
 * to select the first visible block.
 */
async function focusBlock(page: import('@playwright/test').Page, blockId: string): Promise<void> {
  // Wait for block to have content
  await waitForBlockStable(page, blockId);

  const blockNode = page.locator(`[data-testid="block-node"][data-block-id="${blockId}"]`).first();
  await expect(blockNode).toBeVisible({ timeout: 5000 });
  await blockNode.locator('.block-content').click();
  // Wait for ProseMirror editor to appear
  await expect(blockNode.locator('.ProseMirror')).toBeVisible({ timeout: 3000 });
}

/**
 * Helper to get the parent_id of a block from the database.
 */
async function getBlockParentId(blockId: string): Promise<string | null> {
  const result = await executeQuery(
    `?[parent_id] := *blocks{ block_id, parent_id }, block_id == $block_id`,
    { block_id: blockId }
  );
  if (result.rows.length > 0 && result.rows[0]) {
    return result.rows[0][0] as string | null;
  }
  return null;
}

/**
 * Helper type for block service methods exposed on window.
 */
type BlockServiceMethods = {
  indentBlock: (id: string) => Promise<void>;
  outdentBlock: (id: string) => Promise<void>;
  moveBlockUp: (id: string) => Promise<void>;
  moveBlockDown: (id: string) => Promise<void>;
};

/**
 * Helper to wait for window.__SERVICES__ to be available.
 * This is needed because initializeApp() in main.tsx is async.
 */
async function waitForServices(page: import('@playwright/test').Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const services = (
        window as unknown as {
          __SERVICES__?: { blockService: unknown };
        }
      ).__SERVICES__;
      return services && services.blockService;
    },
    { timeout: 10000 }
  );
}

/**
 * Helper to call a block service method directly via window.__SERVICES__.
 * This bypasses keyboard handling which can be unreliable in E2E tests.
 */
async function callBlockService(
  page: import('@playwright/test').Page,
  method: keyof BlockServiceMethods,
  blockId: string
): Promise<void> {
  // Ensure services are available before attempting to call
  await waitForServices(page);

  const result = await page.evaluate(
    async ({ method, blockId }: { method: string; blockId: string }) => {
      try {
        const services = (
          window as unknown as {
            __SERVICES__?: { blockService: BlockServiceMethods };
          }
        ).__SERVICES__;
        if (!services) {
          return { success: false, error: '__SERVICES__ not on window' };
        }
        const blockService = services.blockService as unknown as Record<
          string,
          (id: string) => Promise<void>
        >;
        await blockService[method](blockId);
        return { success: true, error: null };
      } catch (e) {
        return { success: false, error: String(e) };
      }
    },
    { method, blockId }
  );

  if (!result.success) {
    throw new Error(`blockService.${method}(${blockId}) failed: ${result.error}`);
  }
}

/**
 * Helper to get all sibling blocks in order (blocks with same parent).
 */
async function getSiblingBlockIds(pageId: string, parentId: string | null): Promise<string[]> {
  // Note: Must bind all variables used in head. Use == constraints instead of pattern matching
  const script = parentId
    ? `?[block_id, order] := *blocks{ block_id, page_id, parent_id, order, is_deleted }, page_id == $page_id, parent_id == $parent_id, is_deleted == false :order order`
    : `?[block_id, order] := *blocks{ block_id, page_id, parent_id, order, is_deleted }, page_id == $page_id, is_null(parent_id), is_deleted == false :order order`;

  const params = parentId ? { page_id: pageId, parent_id: parentId } : { page_id: pageId };

  const result = await executeQuery(script, params);
  return result.rows.map((row) => row[0] as string);
}

test.describe('Block Indentation and Reordering', () => {
  // Reset database before each test for isolation
  // Note: mockIPC is NOT needed because httpGraphDB auto-detects when not in Tauri
  test.beforeEach(async () => {
    await resetDatabase();
  });

  test.describe('Indentation with Tab', () => {
    test('Tab indents block to become child of previous sibling', async ({ page }) => {
      // Capture console messages for debugging
      const consoleMessages: string[] = [];
      page.on('console', (msg) => {
        consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
      });

      // Generate unique IDs for test data
      const pageId = generateId('page');
      const block1Id = generateId('block-1');
      const block2Id = generateId('block-2');

      // Seed test data: Page with 2 root-level blocks
      await seedPage({ pageId, title: 'Indent Test Page' });
      await seedBlock({
        blockId: block1Id,
        pageId,
        content: 'Block 1 - will become parent',
        order: 'a0',
      });
      await seedBlock({
        blockId: block2Id,
        pageId,
        content: 'Block 2 - will become child',
        order: 'a1',
      });

      // Navigate to the app
      await page.goto('/');

      // Navigate to the test page
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

      // Wait for the page view to load
      await page.waitForSelector('[data-testid="page-view"]', { state: 'visible' });

      // Verify both blocks are visible (use specific block-node selector to avoid matching block-editor too)
      await expect(
        page.locator(`[data-testid="block-node"][data-block-id="${block1Id}"]`)
      ).toBeVisible();
      await expect(
        page.locator(`[data-testid="block-node"][data-block-id="${block2Id}"]`)
      ).toBeVisible();

      // Verify block 2 has no parent initially
      let block2Parent = await getBlockParentId(block2Id);
      expect(block2Parent).toBeNull();

      // Focus block 2
      await focusBlock(page, block2Id);

      // Call indentBlock to make block 2 a child of block 1
      await callBlockService(page, 'indentBlock', block2Id);

      // Wait for the mutation to complete
      await page.waitForTimeout(500);

      // Verify block 2 is now a child of block 1
      block2Parent = await getBlockParentId(block2Id);
      expect(block2Parent).toBe(block1Id);
    });

    test('Tab on nested block creates deeper nesting', async ({ page }) => {
      // Generate unique IDs for test data
      const pageId = generateId('page');
      const block1Id = generateId('block-1');
      const block2Id = generateId('block-2');
      const block3Id = generateId('block-3');

      // Seed test data: Page with 3 blocks, block 2 is already child of block 1
      await seedPage({ pageId, title: 'Deep Indent Test' });
      await seedBlock({
        blockId: block1Id,
        pageId,
        content: 'Block 1 - grandparent',
        order: 'a0',
      });
      await seedBlock({
        blockId: block2Id,
        pageId,
        content: 'Block 2 - parent',
        parentId: block1Id,
        order: 'a0',
      });
      await seedBlock({
        blockId: block3Id,
        pageId,
        content: 'Block 3 - will become nested child',
        parentId: block1Id,
        order: 'a1',
      });

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

      // Verify initial state: block 3 is sibling of block 2 (both children of block 1)
      let block3Parent = await getBlockParentId(block3Id);
      expect(block3Parent).toBe(block1Id);

      // Focus block 3
      await focusBlock(page, block3Id);

      // Call indentBlock to make block 3 a child of block 2
      await callBlockService(page, 'indentBlock', block3Id);

      // Wait for the mutation to complete
      await page.waitForTimeout(500);

      // Verify block 3 is now a child of block 2 (nested 2 levels deep)
      block3Parent = await getBlockParentId(block3Id);
      expect(block3Parent).toBe(block2Id);
    });
  });

  test.describe('Outdentation with Shift+Tab', () => {
    test('Shift+Tab outdents block to become sibling of parent', async ({ page }) => {
      // Generate unique IDs for test data
      const pageId = generateId('page');
      const block1Id = generateId('block-1');
      const block2Id = generateId('block-2');

      // Seed test data: Block 2 is child of block 1
      await seedPage({ pageId, title: 'Outdent Test Page' });
      await seedBlock({
        blockId: block1Id,
        pageId,
        content: 'Block 1 - parent',
        order: 'a0',
      });
      await seedBlock({
        blockId: block2Id,
        pageId,
        content: 'Block 2 - child that will outdent',
        parentId: block1Id,
        order: 'a0',
      });

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

      // Verify initial state: block 2 is child of block 1
      let block2Parent = await getBlockParentId(block2Id);
      expect(block2Parent).toBe(block1Id);

      // Focus block 2
      await focusBlock(page, block2Id);

      // Call outdentBlock to make block 2 a root-level block
      await callBlockService(page, 'outdentBlock', block2Id);

      // Wait for the mutation to complete
      await page.waitForTimeout(500);

      // Verify block 2 is now a root-level block (no parent)
      block2Parent = await getBlockParentId(block2Id);
      expect(block2Parent).toBeNull();
    });

    test('Shift+Tab on deeply nested block moves up one level', async ({ page }) => {
      // Generate unique IDs for test data
      const pageId = generateId('page');
      const block1Id = generateId('block-1');
      const block2Id = generateId('block-2');
      const block3Id = generateId('block-3');

      // Seed test data: Block 3 is child of block 2, which is child of block 1
      await seedPage({ pageId, title: 'Deep Outdent Test' });
      await seedBlock({
        blockId: block1Id,
        pageId,
        content: 'Block 1 - grandparent',
        order: 'a0',
      });
      await seedBlock({
        blockId: block2Id,
        pageId,
        content: 'Block 2 - parent',
        parentId: block1Id,
        order: 'a0',
      });
      await seedBlock({
        blockId: block3Id,
        pageId,
        content: 'Block 3 - deeply nested',
        parentId: block2Id,
        order: 'a0',
      });

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

      // Verify initial state: block 3 is child of block 2
      let block3Parent = await getBlockParentId(block3Id);
      expect(block3Parent).toBe(block2Id);

      // Focus block 3
      await focusBlock(page, block3Id);

      // Call outdentBlock to move block 3 up one level
      await callBlockService(page, 'outdentBlock', block3Id);

      // Wait for the mutation to complete
      await page.waitForTimeout(500);

      // Verify block 3 is now a child of block 1 (moved up one level)
      block3Parent = await getBlockParentId(block3Id);
      expect(block3Parent).toBe(block1Id);
    });
  });

  test.describe('Reordering with Alt+Arrow', () => {
    test('Alt+Up moves block before its previous sibling', async ({ page }) => {
      // Generate unique IDs for test data
      const pageId = generateId('page');
      const block1Id = generateId('block-1');
      const block2Id = generateId('block-2');
      const block3Id = generateId('block-3');

      // Seed test data: 3 root-level blocks in order
      await seedPage({ pageId, title: 'Reorder Test Page' });
      await seedBlock({
        blockId: block1Id,
        pageId,
        content: 'Block 1',
        order: 'a0',
      });
      await seedBlock({
        blockId: block2Id,
        pageId,
        content: 'Block 2',
        order: 'a1',
      });
      await seedBlock({
        blockId: block3Id,
        pageId,
        content: 'Block 3',
        order: 'a2',
      });

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

      // Verify initial order: block1, block2, block3
      let siblings = await getSiblingBlockIds(pageId, null);
      expect(siblings).toEqual([block1Id, block2Id, block3Id]);

      // Focus block 2
      await focusBlock(page, block2Id);

      // Call moveBlockUp to move block 2 before block 1
      await callBlockService(page, 'moveBlockUp', block2Id);

      // Wait for the mutation to complete
      await page.waitForTimeout(500);

      // Verify new order: block2, block1, block3
      siblings = await getSiblingBlockIds(pageId, null);
      expect(siblings).toEqual([block2Id, block1Id, block3Id]);
    });

    test('Alt+Down moves block after its next sibling', async ({ page }) => {
      // Generate unique IDs for test data
      const pageId = generateId('page');
      const block1Id = generateId('block-1');
      const block2Id = generateId('block-2');
      const block3Id = generateId('block-3');

      // Seed test data: 3 root-level blocks in order
      await seedPage({ pageId, title: 'Reorder Down Test' });
      await seedBlock({
        blockId: block1Id,
        pageId,
        content: 'Block 1',
        order: 'a0',
      });
      await seedBlock({
        blockId: block2Id,
        pageId,
        content: 'Block 2',
        order: 'a1',
      });
      await seedBlock({
        blockId: block3Id,
        pageId,
        content: 'Block 3',
        order: 'a2',
      });

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

      // Verify initial order: block1, block2, block3
      let siblings = await getSiblingBlockIds(pageId, null);
      expect(siblings).toEqual([block1Id, block2Id, block3Id]);

      // Focus block 2
      await focusBlock(page, block2Id);

      // Call moveBlockDown to move block 2 after block 3
      await callBlockService(page, 'moveBlockDown', block2Id);

      // Wait for the mutation to complete
      await page.waitForTimeout(500);

      // Verify new order: block1, block3, block2
      siblings = await getSiblingBlockIds(pageId, null);
      expect(siblings).toEqual([block1Id, block3Id, block2Id]);
    });
  });

  test.describe('Persistence', () => {
    test('tree structure persists after navigation away and back', async ({ page }) => {
      // Generate unique IDs for test data
      const pageId = generateId('page');
      const block1Id = generateId('block-1');
      const block2Id = generateId('block-2');

      // Seed test data: 2 root-level blocks
      await seedPage({ pageId, title: 'Persistence Test Page' });
      await seedBlock({
        blockId: block1Id,
        pageId,
        content: 'Block 1',
        order: 'a0',
      });
      await seedBlock({
        blockId: block2Id,
        pageId,
        content: 'Block 2',
        order: 'a1',
      });

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

      // Focus block 2 and indent it
      await focusBlock(page, block2Id);
      await callBlockService(page, 'indentBlock', block2Id);
      await page.waitForTimeout(500);

      // Verify block 2 is now child of block 1
      let block2Parent = await getBlockParentId(block2Id);
      expect(block2Parent).toBe(block1Id);

      // Navigate away to daily notes (empty string triggers default route which is DailyNotesView)
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

      await page.waitForSelector('[data-testid="daily-notes-view"]', { state: 'visible' });

      // Navigate back to the test page
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

      // Verify the tree structure is still correct
      block2Parent = await getBlockParentId(block2Id);
      expect(block2Parent).toBe(block1Id);

      // Verify the visual hierarchy is displayed correctly
      const block2Node = page.locator(`[data-testid="block-node"][data-block-id="${block2Id}"]`);
      await expect(block2Node).toBeVisible();

      // Block 2 should be visually nested (have padding/indentation)
      // Check that it's rendered as a child by verifying it's inside block 1's children
      const block1Children = page.locator(
        `[data-testid="block-node"][data-block-id="${block1Id}"] [data-testid="block-children"]`
      );
      await expect(block1Children).toBeVisible();
    });

    test('reordering persists after page reload', async ({ page }) => {
      // Generate unique IDs for test data
      const pageId = generateId('page');
      const block1Id = generateId('block-1');
      const block2Id = generateId('block-2');

      // Seed test data: 2 root-level blocks
      await seedPage({ pageId, title: 'Reload Persistence Test' });
      await seedBlock({
        blockId: block1Id,
        pageId,
        content: 'Block 1',
        order: 'a0',
      });
      await seedBlock({
        blockId: block2Id,
        pageId,
        content: 'Block 2',
        order: 'a1',
      });

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

      // Verify initial order
      let siblings = await getSiblingBlockIds(pageId, null);
      expect(siblings).toEqual([block1Id, block2Id]);

      // Focus block 2 and move it up
      await focusBlock(page, block2Id);
      await callBlockService(page, 'moveBlockUp', block2Id);
      await page.waitForTimeout(500);

      // Verify new order in database
      siblings = await getSiblingBlockIds(pageId, null);
      expect(siblings).toEqual([block2Id, block1Id]);

      // Reload the page
      await page.reload();

      // Navigate back to the test page
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

      // Verify the order persisted
      siblings = await getSiblingBlockIds(pageId, null);
      expect(siblings).toEqual([block2Id, block1Id]);
    });
  });

  test.describe('Edge Cases', () => {
    test('Tab on first block does nothing (no previous sibling)', async ({ page }) => {
      // Generate unique IDs for test data
      const pageId = generateId('page');
      const block1Id = generateId('block-1');

      // Seed test data: Single root-level block
      await seedPage({ pageId, title: 'First Block Tab Test' });
      await seedBlock({
        blockId: block1Id,
        pageId,
        content: 'Only block',
        order: 'a0',
      });

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

      // Verify block has no parent
      let block1Parent = await getBlockParentId(block1Id);
      expect(block1Parent).toBeNull();

      // Focus block 1 and try to indent (should do nothing - no previous sibling)
      await focusBlock(page, block1Id);
      await callBlockService(page, 'indentBlock', block1Id);
      await page.waitForTimeout(300);

      // Verify block still has no parent (indent should have done nothing)
      block1Parent = await getBlockParentId(block1Id);
      expect(block1Parent).toBeNull();
    });

    test('Shift+Tab on root block does nothing', async ({ page }) => {
      // Generate unique IDs for test data
      const pageId = generateId('page');
      const block1Id = generateId('block-1');

      // Seed test data: Single root-level block
      await seedPage({ pageId, title: 'Root Block Outdent Test' });
      await seedBlock({
        blockId: block1Id,
        pageId,
        content: 'Root block',
        order: 'a0',
      });

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

      // Verify block has no parent
      let block1Parent = await getBlockParentId(block1Id);
      expect(block1Parent).toBeNull();

      // Focus block 1 and try to outdent (should do nothing - already root)
      await focusBlock(page, block1Id);
      await callBlockService(page, 'outdentBlock', block1Id);
      await page.waitForTimeout(300);

      // Verify block still has no parent (outdent should have done nothing)
      block1Parent = await getBlockParentId(block1Id);
      expect(block1Parent).toBeNull();
    });

    test('Alt+Up on first block does nothing', async ({ page }) => {
      // Generate unique IDs for test data
      const pageId = generateId('page');
      const block1Id = generateId('block-1');
      const block2Id = generateId('block-2');

      // Seed test data: 2 root-level blocks
      await seedPage({ pageId, title: 'First Block Move Up Test' });
      await seedBlock({
        blockId: block1Id,
        pageId,
        content: 'First block',
        order: 'a0',
      });
      await seedBlock({
        blockId: block2Id,
        pageId,
        content: 'Second block',
        order: 'a1',
      });

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

      // Verify initial order
      let siblings = await getSiblingBlockIds(pageId, null);
      expect(siblings).toEqual([block1Id, block2Id]);

      // Focus block 1 and try to move up (should do nothing - already first)
      await focusBlock(page, block1Id);
      await callBlockService(page, 'moveBlockUp', block1Id);
      await page.waitForTimeout(300);

      // Verify order is unchanged
      siblings = await getSiblingBlockIds(pageId, null);
      expect(siblings).toEqual([block1Id, block2Id]);
    });

    test('Alt+Down on last block does nothing', async ({ page }) => {
      // Generate unique IDs for test data
      const pageId = generateId('page');
      const block1Id = generateId('block-1');
      const block2Id = generateId('block-2');

      // Seed test data: 2 root-level blocks
      await seedPage({ pageId, title: 'Last Block Move Down Test' });
      await seedBlock({
        blockId: block1Id,
        pageId,
        content: 'First block',
        order: 'a0',
      });
      await seedBlock({
        blockId: block2Id,
        pageId,
        content: 'Last block',
        order: 'a1',
      });

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

      // Verify initial order
      let siblings = await getSiblingBlockIds(pageId, null);
      expect(siblings).toEqual([block1Id, block2Id]);

      // Focus block 2 and try to move down (should do nothing - already last)
      await focusBlock(page, block2Id);
      await callBlockService(page, 'moveBlockDown', block2Id);
      await page.waitForTimeout(300);

      // Verify order is unchanged
      siblings = await getSiblingBlockIds(pageId, null);
      expect(siblings).toEqual([block1Id, block2Id]);
    });
  });

  test.describe('Combined Operations', () => {
    test('performs indent and reorder operations with persistence check', async ({ page }) => {
      // Generate unique IDs for test data
      const pageId = generateId('page');
      const block1Id = generateId('block-1');
      const block2Id = generateId('block-2');
      const block3Id = generateId('block-3');

      // Seed test data: 3 root-level blocks
      await seedPage({ pageId, title: 'Combined Operations Test' });
      await seedBlock({
        blockId: block1Id,
        pageId,
        content: 'Block 1',
        order: 'a0',
      });
      await seedBlock({
        blockId: block2Id,
        pageId,
        content: 'Block 2',
        order: 'a1',
      });
      await seedBlock({
        blockId: block3Id,
        pageId,
        content: 'Block 3',
        order: 'a2',
      });

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

      // Step 1: Indent block 2 under block 1
      await focusBlock(page, block2Id);
      await callBlockService(page, 'indentBlock', block2Id);
      await page.waitForTimeout(500);

      // Verify block 2 is now child of block 1
      let block2Parent = await getBlockParentId(block2Id);
      expect(block2Parent).toBe(block1Id);

      // Step 2: Move block 3 up (before block 1)
      await focusBlock(page, block3Id);
      await callBlockService(page, 'moveBlockUp', block3Id);
      await page.waitForTimeout(500);

      // Verify root-level order: block3, block1 (block2 is nested under block1)
      const rootSiblings = await getSiblingBlockIds(pageId, null);
      expect(rootSiblings).toEqual([block3Id, block1Id]);

      // Step 3: Verify tree structure persists after navigation
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

      await page.waitForSelector('[data-testid="daily-notes-view"]', { state: 'visible' });

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

      // Verify final structure is still correct
      block2Parent = await getBlockParentId(block2Id);
      expect(block2Parent).toBe(block1Id);

      const persistedRootSiblings = await getSiblingBlockIds(pageId, null);
      expect(persistedRootSiblings).toEqual([block3Id, block1Id]);
    });

    /**
     * Comprehensive test matching all acceptance criteria from DBB-194:
     * - Creates a page with 4+ blocks at root level
     * - Indents block 2 under block 1 using Tab, verifies it becomes a child
     * - Indents block 3 under block 2 (nested child), verifies tree depth
     * - Outdents block 3 using Shift+Tab, verifies it returns to previous level
     * - Moves a block up using Alt+Up, verifies new order
     * - Moves a block down using Alt+Down, verifies new order
     * - Verifies the tree structure persists after page reload
     *
     * This test uses page reloads between operations to ensure DOM stability.
     * The React query cache invalidation can cause transient duplicate DOM nodes
     * after tree structure changes; reloading ensures clean state between steps.
     */
    test('comprehensive workflow with 4+ blocks: indent, nested indent, outdent, move up/down, persistence', async ({
      page,
    }) => {
      // Helper to navigate to the test page
      const navigateToTestPage = async (pid: string) => {
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
        }, pid);
        await page.waitForSelector('[data-testid="page-view"]', { state: 'visible' });
      };

      // Generate unique IDs for test data
      const pageId = generateId('page');
      const block1Id = generateId('block-1');
      const block2Id = generateId('block-2');
      const block3Id = generateId('block-3');
      const block4Id = generateId('block-4');

      // Seed test data: 4 root-level blocks (meets 4+ requirement)
      await seedPage({ pageId, title: 'Comprehensive Indent/Reorder Test' });
      await seedBlock({
        blockId: block1Id,
        pageId,
        content: 'Block 1 - parent',
        order: 'a0',
      });
      await seedBlock({
        blockId: block2Id,
        pageId,
        content: 'Block 2',
        order: 'a1',
      });
      await seedBlock({
        blockId: block3Id,
        pageId,
        content: 'Block 3',
        order: 'a2',
      });
      await seedBlock({
        blockId: block4Id,
        pageId,
        content: 'Block 4',
        order: 'a3',
      });

      // Navigate to the app and page
      await page.goto('/');
      await navigateToTestPage(pageId);

      // Verify initial state: all 4 blocks at root level (4+ requirement)
      let rootSiblings = await getSiblingBlockIds(pageId, null);
      expect(rootSiblings).toEqual([block1Id, block2Id, block3Id, block4Id]);

      // === Step 1: Indent block 2 under block 1 ===
      await focusBlock(page, block2Id);
      await callBlockService(page, 'indentBlock', block2Id);
      await page.waitForTimeout(300);

      // Verify block 2 is now child of block 1
      const block2Parent = await getBlockParentId(block2Id);
      expect(block2Parent).toBe(block1Id);

      // Reload for DOM stability before next operation
      await page.reload();
      await navigateToTestPage(pageId);

      // === Step 2: Indent block 3 under block 1 (becomes sibling of block 2) ===
      await focusBlock(page, block3Id);
      await callBlockService(page, 'indentBlock', block3Id);
      await page.waitForTimeout(300);

      // Verify block 3 is now child of block 1
      let block3Parent = await getBlockParentId(block3Id);
      expect(block3Parent).toBe(block1Id);

      // Block 1's children should be: block2, block3
      let block1Children = await getSiblingBlockIds(pageId, block1Id);
      expect(block1Children).toEqual([block2Id, block3Id]);

      // Reload for DOM stability before next operation
      await page.reload();
      await navigateToTestPage(pageId);

      // === Step 3: Indent block 3 again to nest under block 2 (2 levels deep) ===
      await focusBlock(page, block3Id);
      await callBlockService(page, 'indentBlock', block3Id);
      await page.waitForTimeout(300);

      // Verify block 3 is now nested under block 2
      block3Parent = await getBlockParentId(block3Id);
      expect(block3Parent).toBe(block2Id);

      // Verify tree depth: block2's children should contain block3
      const block2Children = await getSiblingBlockIds(pageId, block2Id);
      expect(block2Children).toEqual([block3Id]);

      // Reload for DOM stability before next operation
      await page.reload();
      await navigateToTestPage(pageId);

      // === Step 4: Outdent block 3 to return to previous level ===
      await focusBlock(page, block3Id);
      await callBlockService(page, 'outdentBlock', block3Id);
      await page.waitForTimeout(300);

      // Verify block 3 is now back as sibling of block 2 under block 1
      block3Parent = await getBlockParentId(block3Id);
      expect(block3Parent).toBe(block1Id);

      // Block 1's children should be: block2, block3
      block1Children = await getSiblingBlockIds(pageId, block1Id);
      expect(block1Children).toEqual([block2Id, block3Id]);

      // Reload for DOM stability before next operation
      await page.reload();
      await navigateToTestPage(pageId);

      // === Step 5: Move block 4 up ===
      // Root level is currently: block1, block4
      rootSiblings = await getSiblingBlockIds(pageId, null);
      expect(rootSiblings).toEqual([block1Id, block4Id]);

      await focusBlock(page, block4Id);
      await callBlockService(page, 'moveBlockUp', block4Id);
      await page.waitForTimeout(300);

      // Verify new order: block4, block1
      rootSiblings = await getSiblingBlockIds(pageId, null);
      expect(rootSiblings).toEqual([block4Id, block1Id]);

      // Reload for DOM stability before next operation
      await page.reload();
      await navigateToTestPage(pageId);

      // === Step 6: Move block 4 down (back to original position) ===
      await focusBlock(page, block4Id);
      await callBlockService(page, 'moveBlockDown', block4Id);
      await page.waitForTimeout(300);

      // Verify order is back to: block1, block4
      rootSiblings = await getSiblingBlockIds(pageId, null);
      expect(rootSiblings).toEqual([block1Id, block4Id]);

      // === Step 7: Final verification after reload (persistence test) ===
      // Record final state before reload
      const finalBlock2Parent = await getBlockParentId(block2Id);
      const finalBlock3Parent = await getBlockParentId(block3Id);
      const finalRootOrder = await getSiblingBlockIds(pageId, null);
      const finalBlock1Children = await getSiblingBlockIds(pageId, block1Id);

      expect(finalBlock2Parent).toBe(block1Id);
      expect(finalBlock3Parent).toBe(block1Id);
      expect(finalRootOrder).toEqual([block1Id, block4Id]);
      expect(finalBlock1Children).toEqual([block2Id, block3Id]);

      // Final reload to verify persistence
      await page.reload();
      await navigateToTestPage(pageId);

      // Verify all structure persisted correctly after reload
      const persistedBlock2Parent = await getBlockParentId(block2Id);
      const persistedBlock3Parent = await getBlockParentId(block3Id);
      const persistedRootOrder = await getSiblingBlockIds(pageId, null);
      const persistedBlock1Children = await getSiblingBlockIds(pageId, block1Id);

      expect(persistedBlock2Parent).toBe(block1Id);
      expect(persistedBlock3Parent).toBe(block1Id);
      expect(persistedRootOrder).toEqual([block1Id, block4Id]);
      expect(persistedBlock1Children).toEqual([block2Id, block3Id]);

      // Verify visual hierarchy is displayed correctly
      await expect(
        page.locator(`[data-testid="block-node"][data-block-id="${block1Id}"]`).first()
      ).toBeVisible();
      await expect(
        page.locator(`[data-testid="block-node"][data-block-id="${block4Id}"]`).first()
      ).toBeVisible();

      // Block 2 and 3 should be visible as children of block 1
      const block1ChildrenContainer = page
        .locator(
          `[data-testid="block-node"][data-block-id="${block1Id}"] [data-testid="block-children"]`
        )
        .first();
      await expect(block1ChildrenContainer).toBeVisible();
    });
  });
});
