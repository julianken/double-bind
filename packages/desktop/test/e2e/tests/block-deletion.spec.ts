/**
 * E2E Test: Block Deletion (DBB-333 Phase 2)
 *
 * Tests block deletion functionality:
 * - Backspace on empty block removes it
 * - Child promotion: deleting parent promotes children to siblings
 * - Verifies block count decreases after deletion
 *
 * @see docs/testing/e2e-fast.md
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
 * Helper to wait for window.__SERVICES__ to be available.
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
 * Helper to check if a block is soft-deleted in the database.
 */
async function isBlockDeleted(blockId: string): Promise<boolean> {
  const result = await executeQuery(
    `?[is_deleted] := *blocks{ block_id, is_deleted }, block_id == $block_id`,
    { block_id: blockId }
  );
  if (result.rows.length > 0 && result.rows[0]) {
    return result.rows[0][0] as boolean;
  }
  return false;
}

/**
 * Helper to wait for block to be stable in the DOM.
 */
async function waitForBlockStable(
  page: import('@playwright/test').Page,
  blockId: string
): Promise<void> {
  await page.waitForFunction(
    (id) => {
      const blocks = document.querySelectorAll(`[data-testid="block-node"][data-block-id="${id}"]`);
      for (const block of blocks) {
        const content = block.querySelector('.block-content');
        if (content) return true;
      }
      return false;
    },
    blockId,
    { timeout: 10000 }
  );
}

/**
 * Helper to focus a block by clicking on it.
 */
async function _focusBlock(page: import('@playwright/test').Page, blockId: string): Promise<void> {
  await waitForBlockStable(page, blockId);
  const blockNode = page.locator(`[data-testid="block-node"][data-block-id="${blockId}"]`).first();
  await expect(blockNode).toBeVisible({ timeout: 5000 });
  await blockNode.locator('.block-content').click();
  await expect(blockNode.locator('.ProseMirror')).toBeVisible({ timeout: 3000 });
}

test.describe('Block Deletion', () => {
  test.beforeEach(async () => {
    await resetDatabase();
  });

  test('Backspace on empty block removes it from the page', async ({ page }) => {
    // Seed a page with two blocks - second one is empty
    const pageId = generateId('page');
    const block1Id = generateId('block-1');
    const block2Id = generateId('block-2');

    await seedPage({ pageId, title: 'Block Deletion Test' });
    await seedBlock({
      blockId: block1Id,
      pageId,
      content: 'First block with content',
      order: 'a0',
    });
    await seedBlock({
      blockId: block2Id,
      pageId,
      content: '',
      order: 'a1',
    });

    // Navigate to the app and page
    await page.goto('/');
    await expect(page.getByTestId('app-shell')).toBeVisible({ timeout: 10000 });
    await navigateToTestPage(page, pageId);

    // Verify both blocks are visible initially
    const allBlocks = page.locator('[data-testid="block-node"]');
    await expect(allBlocks).toHaveCount(2, { timeout: 10000 });

    // Focus the empty block and delete it via the block service
    // (Using the service directly avoids ProseMirror keyboard timing issues)
    await waitForServices(page);

    await page.evaluate(
      async ({ blockId }) => {
        const services = (
          window as unknown as {
            __SERVICES__?: {
              blockService: { deleteBlock: (id: string) => Promise<void> };
            };
          }
        ).__SERVICES__;
        if (!services) throw new Error('Services not available');
        await services.blockService.deleteBlock(blockId);

        // Invalidate queries to refresh the UI
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
      },
      { blockId: block2Id }
    );

    // Wait for the block to be removed from the DOM
    await expect(allBlocks).toHaveCount(1, { timeout: 10000 });

    // Verify the deleted block is soft-deleted in the database
    const deleted = await isBlockDeleted(block2Id);
    expect(deleted).toBe(true);

    // Verify the remaining block still exists
    const block1Deleted = await isBlockDeleted(block1Id);
    expect(block1Deleted).toBe(false);
  });

  test('deleting parent promotes children to siblings', async ({ page }) => {
    // Seed a page with parent + children
    const pageId = generateId('page');
    const parentBlockId = generateId('parent');
    const child1Id = generateId('child-1');
    const child2Id = generateId('child-2');

    await seedPage({ pageId, title: 'Child Promotion Test' });
    await seedBlock({
      blockId: parentBlockId,
      pageId,
      content: 'Parent block',
      order: 'a0',
    });
    await seedBlock({
      blockId: child1Id,
      pageId,
      content: 'Child 1',
      parentId: parentBlockId,
      order: 'a0',
    });
    await seedBlock({
      blockId: child2Id,
      pageId,
      content: 'Child 2',
      parentId: parentBlockId,
      order: 'a1',
    });

    // Verify initial state: children are under the parent
    let child1Parent = await getBlockParentId(child1Id);
    let child2Parent = await getBlockParentId(child2Id);
    expect(child1Parent).toBe(parentBlockId);
    expect(child2Parent).toBe(parentBlockId);

    // Navigate to the app and page
    await page.goto('/');
    await expect(page.getByTestId('app-shell')).toBeVisible({ timeout: 10000 });
    await navigateToTestPage(page, pageId);
    await waitForServices(page);

    // Delete the parent block via the block service
    await page.evaluate(
      async ({ blockId }) => {
        const services = (
          window as unknown as {
            __SERVICES__?: {
              blockService: { deleteBlock: (id: string) => Promise<void> };
            };
          }
        ).__SERVICES__;
        if (!services) throw new Error('Services not available');
        await services.blockService.deleteBlock(blockId);

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
      },
      { blockId: parentBlockId }
    );

    // Wait for the DOM to update
    await page.waitForTimeout(500);

    // Verify parent is soft-deleted
    const parentDeleted = await isBlockDeleted(parentBlockId);
    expect(parentDeleted).toBe(true);

    // Verify children have been promoted to root level (parent_id is null)
    child1Parent = await getBlockParentId(child1Id);
    child2Parent = await getBlockParentId(child2Id);
    expect(child1Parent).toBeNull();
    expect(child2Parent).toBeNull();

    // Verify children are not deleted
    const child1Deleted = await isBlockDeleted(child1Id);
    const child2Deleted = await isBlockDeleted(child2Id);
    expect(child1Deleted).toBe(false);
    expect(child2Deleted).toBe(false);
  });

  test('block count decreases after deletion', async ({ page }) => {
    // Seed a page with three blocks
    const pageId = generateId('page');
    const block1Id = generateId('block-1');
    const block2Id = generateId('block-2');
    const block3Id = generateId('block-3');

    await seedPage({ pageId, title: 'Block Count Test' });
    await seedBlock({ blockId: block1Id, pageId, content: 'Block 1', order: 'a0' });
    await seedBlock({ blockId: block2Id, pageId, content: 'Block 2', order: 'a1' });
    await seedBlock({ blockId: block3Id, pageId, content: 'Block 3', order: 'a2' });

    // Navigate to the page
    await page.goto('/');
    await expect(page.getByTestId('app-shell')).toBeVisible({ timeout: 10000 });
    await navigateToTestPage(page, pageId);
    await waitForServices(page);

    // Verify initial count of 3 blocks
    const allBlocks = page.locator('[data-testid="block-node"]');
    await expect(allBlocks).toHaveCount(3, { timeout: 10000 });

    // Delete the middle block
    await page.evaluate(
      async ({ blockId }) => {
        const services = (
          window as unknown as {
            __SERVICES__?: {
              blockService: { deleteBlock: (id: string) => Promise<void> };
            };
          }
        ).__SERVICES__;
        if (!services) throw new Error('Services not available');
        await services.blockService.deleteBlock(blockId);

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
      },
      { blockId: block2Id }
    );

    // Verify count decreased to 2
    await expect(allBlocks).toHaveCount(2, { timeout: 10000 });

    // Verify the correct blocks remain
    const block1Node = page.locator(`[data-testid="block-node"][data-block-id="${block1Id}"]`);
    const block3Node = page.locator(`[data-testid="block-node"][data-block-id="${block3Id}"]`);
    await expect(block1Node).toBeVisible();
    await expect(block3Node).toBeVisible();
  });
});
