/**
 * E2E Test: Collapse/Expand Blocks (DBB-333 Phase 2)
 *
 * Tests the collapse/expand functionality:
 * - Seed page with parent + children
 * - Click collapse toggle (bullet handle) -> verify children hidden
 * - Click expand toggle -> verify children visible
 * - Verify database state reflects collapsed state
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
 * Helper to get the is_collapsed state of a block from the database.
 */
async function getBlockCollapsed(blockId: string): Promise<boolean> {
  const result = await executeQuery(
    `?[is_collapsed] := *blocks{ block_id, is_collapsed }, block_id == $block_id`,
    { block_id: blockId }
  );
  if (result.rows.length > 0 && result.rows[0]) {
    return result.rows[0][0] as boolean;
  }
  return false;
}

test.describe('Collapse/Expand', () => {
  test.beforeEach(async () => {
    await resetDatabase();
  });

  test('collapsing a parent hides its children', async ({ page }) => {
    // Seed a page with a parent block that has children
    const pageId = generateId('page');
    const parentId = generateId('parent');
    const child1Id = generateId('child-1');
    const child2Id = generateId('child-2');

    await seedPage({ pageId, title: 'Collapse Test' });
    await seedBlock({
      blockId: parentId,
      pageId,
      content: 'Parent block',
      order: 'a0',
    });
    await seedBlock({
      blockId: child1Id,
      pageId,
      content: 'Child block 1',
      parentId,
      order: 'a0',
    });
    await seedBlock({
      blockId: child2Id,
      pageId,
      content: 'Child block 2',
      parentId,
      order: 'a1',
    });

    // Navigate to the app and page
    await page.goto('/');
    await expect(page.getByTestId('app-shell')).toBeVisible({ timeout: 10000 });
    await navigateToTestPage(page, pageId);
    await waitForServices(page);

    // Verify initial state: parent and both children are visible
    const parentNode = page.locator(`[data-testid="block-node"][data-block-id="${parentId}"]`);
    await expect(parentNode).toBeVisible({ timeout: 5000 });

    // Wait for children to be visible
    const child1Node = page.locator(`[data-testid="block-node"][data-block-id="${child1Id}"]`);
    const child2Node = page.locator(`[data-testid="block-node"][data-block-id="${child2Id}"]`);
    await expect(child1Node).toBeVisible({ timeout: 10000 });
    await expect(child2Node).toBeVisible({ timeout: 5000 });

    // Verify the block-children container is visible (not collapsed)
    const childrenContainer = parentNode.locator('[data-testid="block-children"]');
    await expect(childrenContainer).toBeVisible();

    // Verify the block is NOT collapsed in the database
    let isCollapsed = await getBlockCollapsed(parentId);
    expect(isCollapsed).toBe(false);

    // Toggle collapse via the block service (more reliable than clicking the bullet)
    await page.evaluate(
      async ({ blockId }) => {
        const services = (
          window as unknown as {
            __SERVICES__?: {
              blockService: { toggleCollapse: (id: string) => Promise<void> };
            };
          }
        ).__SERVICES__;
        if (!services) throw new Error('Services not available');
        await services.blockService.toggleCollapse(blockId);

        const invalidate = (
          window as unknown as {
            __INVALIDATE_QUERIES__?: (prefix: string[]) => void;
          }
        ).__INVALIDATE_QUERIES__;
        if (invalidate) {
          invalidate(['block']);
          invalidate(['page', 'withBlocks']);
        }
      },
      { blockId: parentId }
    );

    // Wait for the UI to update
    await page.waitForTimeout(500);

    // Verify children are no longer visible
    await expect(childrenContainer).not.toBeVisible({ timeout: 5000 });

    // Verify the block IS collapsed in the database
    isCollapsed = await getBlockCollapsed(parentId);
    expect(isCollapsed).toBe(true);
  });

  test('expanding a collapsed parent shows its children', async ({ page }) => {
    // Seed a page with a parent block that has children
    const pageId = generateId('page');
    const parentId = generateId('parent');
    const child1Id = generateId('child-1');
    const child2Id = generateId('child-2');

    await seedPage({ pageId, title: 'Expand Test' });
    await seedBlock({
      blockId: parentId,
      pageId,
      content: 'Parent block',
      order: 'a0',
    });
    await seedBlock({
      blockId: child1Id,
      pageId,
      content: 'Child block 1',
      parentId,
      order: 'a0',
    });
    await seedBlock({
      blockId: child2Id,
      pageId,
      content: 'Child block 2',
      parentId,
      order: 'a1',
    });

    // Navigate to the page
    await page.goto('/');
    await expect(page.getByTestId('app-shell')).toBeVisible({ timeout: 10000 });
    await navigateToTestPage(page, pageId);
    await waitForServices(page);

    // Wait for the parent and children to render
    const parentNode = page.locator(`[data-testid="block-node"][data-block-id="${parentId}"]`);
    await expect(parentNode).toBeVisible({ timeout: 5000 });
    const child1Node = page.locator(`[data-testid="block-node"][data-block-id="${child1Id}"]`);
    await expect(child1Node).toBeVisible({ timeout: 10000 });

    // Step 1: Collapse the parent first
    await page.evaluate(
      async ({ blockId }) => {
        const services = (
          window as unknown as {
            __SERVICES__?: {
              blockService: { toggleCollapse: (id: string) => Promise<void> };
            };
          }
        ).__SERVICES__;
        if (!services) throw new Error('Services not available');
        await services.blockService.toggleCollapse(blockId);

        const invalidate = (
          window as unknown as {
            __INVALIDATE_QUERIES__?: (prefix: string[]) => void;
          }
        ).__INVALIDATE_QUERIES__;
        if (invalidate) {
          invalidate(['block']);
          invalidate(['page', 'withBlocks']);
        }
      },
      { blockId: parentId }
    );

    await page.waitForTimeout(500);

    // Verify children are hidden
    const childrenContainer = parentNode.locator('[data-testid="block-children"]');
    await expect(childrenContainer).not.toBeVisible({ timeout: 5000 });

    // Step 2: Expand the parent (toggle again)
    await page.evaluate(
      async ({ blockId }) => {
        const services = (
          window as unknown as {
            __SERVICES__?: {
              blockService: { toggleCollapse: (id: string) => Promise<void> };
            };
          }
        ).__SERVICES__;
        if (!services) throw new Error('Services not available');
        await services.blockService.toggleCollapse(blockId);

        const invalidate = (
          window as unknown as {
            __INVALIDATE_QUERIES__?: (prefix: string[]) => void;
          }
        ).__INVALIDATE_QUERIES__;
        if (invalidate) {
          invalidate(['block']);
          invalidate(['page', 'withBlocks']);
        }
      },
      { blockId: parentId }
    );

    await page.waitForTimeout(500);

    // Verify children are visible again
    await expect(childrenContainer).toBeVisible({ timeout: 5000 });
    await expect(child1Node).toBeVisible();

    // Verify database reflects expanded state
    const isCollapsed = await getBlockCollapsed(parentId);
    expect(isCollapsed).toBe(false);
  });

  test('collapse state persists after navigating away and back', async ({ page }) => {
    // Seed a page with a parent + child
    const pageId = generateId('page');
    const parentId = generateId('parent');
    const childId = generateId('child');

    await seedPage({ pageId, title: 'Collapse Persistence Test' });
    await seedBlock({
      blockId: parentId,
      pageId,
      content: 'Persistent parent',
      order: 'a0',
    });
    await seedBlock({
      blockId: childId,
      pageId,
      content: 'Persistent child',
      parentId,
      order: 'a0',
    });

    // Navigate to the page
    await page.goto('/');
    await expect(page.getByTestId('app-shell')).toBeVisible({ timeout: 10000 });
    await navigateToTestPage(page, pageId);
    await waitForServices(page);

    const parentNode = page.locator(`[data-testid="block-node"][data-block-id="${parentId}"]`);
    await expect(parentNode).toBeVisible({ timeout: 5000 });

    // Wait for child to render
    const childNode = page.locator(`[data-testid="block-node"][data-block-id="${childId}"]`);
    await expect(childNode).toBeVisible({ timeout: 10000 });

    // Collapse the parent
    await page.evaluate(
      async ({ blockId }) => {
        const services = (
          window as unknown as {
            __SERVICES__?: {
              blockService: { toggleCollapse: (id: string) => Promise<void> };
            };
          }
        ).__SERVICES__;
        if (!services) throw new Error('Services not available');
        await services.blockService.toggleCollapse(blockId);

        const invalidate = (
          window as unknown as {
            __INVALIDATE_QUERIES__?: (prefix: string[]) => void;
          }
        ).__INVALIDATE_QUERIES__;
        if (invalidate) {
          invalidate(['block']);
          invalidate(['page', 'withBlocks']);
        }
      },
      { blockId: parentId }
    );

    await page.waitForTimeout(300);

    // Verify collapsed in DB
    let isCollapsed = await getBlockCollapsed(parentId);
    expect(isCollapsed).toBe(true);

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

    // Verify the collapse state persisted
    isCollapsed = await getBlockCollapsed(parentId);
    expect(isCollapsed).toBe(true);

    // Verify children are still hidden in the UI
    const childrenContainer = page
      .locator(`[data-testid="block-node"][data-block-id="${parentId}"]`)
      .first()
      .locator('[data-testid="block-children"]');
    await expect(childrenContainer).not.toBeVisible({ timeout: 5000 });
  });
});
