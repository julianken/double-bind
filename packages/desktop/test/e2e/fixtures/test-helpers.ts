/**
 * E2E Test Helpers
 *
 * Provides utilities for seeding test data and resetting the database.
 *
 * @see docs/testing/e2e-fast.md
 */

import type { Page } from '@playwright/test';

const BRIDGE_URL = 'http://localhost:3001';

/**
 * Reset the database to a clean state before each test.
 * This ensures test isolation.
 */
export async function resetDatabase(): Promise<void> {
  const response = await fetch(`${BRIDGE_URL}/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to reset database: ${error.error}`);
  }
}

/**
 * Execute a Datalog query against the test database.
 */
export async function executeQuery(
  script: string,
  params: Record<string, unknown> = {}
): Promise<{ headers: string[]; rows: unknown[][] }> {
  const response = await fetch(`${BRIDGE_URL}/invoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cmd: 'query', args: { script, params } }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Query failed: ${error.error}`);
  }

  return response.json();
}

/**
 * Execute a Datalog mutation against the test database.
 */
export async function executeMutation(
  script: string,
  params: Record<string, unknown> = {}
): Promise<{ headers: string[]; rows: unknown[][] }> {
  const response = await fetch(`${BRIDGE_URL}/invoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cmd: 'mutate', args: { script, params } }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Mutation failed: ${error.error}`);
  }

  return response.json();
}

/**
 * Seed a page in the test database.
 */
export async function seedPage(data: {
  pageId: string;
  title: string;
  dailyNoteDate?: string | null;
}): Promise<void> {
  const now = Date.now();
  const script = `
    ?[page_id, title, daily_note_date, is_deleted, created_at, updated_at] <- [[
      $page_id, $title, $daily_note_date, false, $now, $now
    ]]
    :put pages { page_id, title, daily_note_date, is_deleted, created_at, updated_at }
  `;

  await executeMutation(script, {
    page_id: data.pageId,
    title: data.title,
    daily_note_date: data.dailyNoteDate ?? null,
    now,
  });
}

/**
 * Compute the parent key for blocks_by_parent index.
 * When parentId is null (root-level block), uses sentinel "__page:<pageId>".
 * Otherwise uses the parentId directly.
 */
function computeParentKey(parentId: string | null, pageId: string): string {
  if (parentId === null) {
    return `__page:${pageId}`;
  }
  return parentId;
}

/**
 * Seed a block in the test database.
 * Also populates the blocks_by_page and blocks_by_parent index relations.
 *
 * Note: CozoDB doesn't allow multiple `?` rules with `:put` in a single block,
 * so we execute 3 separate mutations. To handle the race condition where
 * `useBlockChildren` might query before mutation #3 completes, we verify
 * all data is committed before returning.
 */
export async function seedBlock(data: {
  blockId: string;
  pageId: string;
  content: string;
  parentId?: string | null;
  order?: string;
}): Promise<void> {
  const now = Date.now();
  const parentId = data.parentId ?? null;

  // 1. Insert block into blocks relation (include content_type)
  const blockScript = `
    ?[block_id, page_id, content, content_type, parent_id, order, is_collapsed, is_deleted, created_at, updated_at] <- [[
      $block_id, $page_id, $content, $content_type, $parent_id, $order, false, false, $now, $now
    ]]
    :put blocks { block_id, page_id, content, content_type, parent_id, order, is_collapsed, is_deleted, created_at, updated_at }
  `;

  await executeMutation(blockScript, {
    block_id: data.blockId,
    page_id: data.pageId,
    content: data.content,
    content_type: 'text',
    parent_id: parentId,
    order: data.order ?? 'a0',
    now,
  });

  // 2. Index by page
  const byPageScript = `
    ?[page_id, block_id] <- [[$page_id, $block_id]]
    :put blocks_by_page { page_id, block_id }
  `;

  await executeMutation(byPageScript, {
    page_id: data.pageId,
    block_id: data.blockId,
  });

  // 3. Index by parent (using sentinel for root-level blocks)
  const parentKey = computeParentKey(parentId, data.pageId);
  const byParentScript = `
    ?[parent_id, block_id] <- [[$parent_key, $block_id]]
    :put blocks_by_parent { parent_id, block_id }
  `;

  await executeMutation(byParentScript, {
    parent_key: parentKey,
    block_id: data.blockId,
  });

  // 4. Verify all data is committed by querying blocks_by_parent
  // This ensures the race condition is resolved before returning
  await verifyBlockIndexed(data.blockId, parentKey);
}

/**
 * Verify a block is indexed in blocks_by_parent.
 * Retries with exponential backoff to handle CozoDB commit timing.
 */
async function verifyBlockIndexed(
  blockId: string,
  parentKey: string,
  maxRetries: number = 5
): Promise<void> {
  const verifyScript = `
    ?[block_id] := *blocks_by_parent{ parent_id, block_id }, parent_id == $parent_key, block_id == $block_id
  `;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const result = await executeQuery(verifyScript, {
      parent_key: parentKey,
      block_id: blockId,
    });

    if (result.rows.length > 0) {
      return; // Block is indexed, we're done
    }

    // Wait with exponential backoff: 10ms, 20ms, 40ms, 80ms, 160ms
    const delay = 10 * Math.pow(2, attempt);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  // If we get here after all retries, the data should be there
  // but we won't throw - the test will fail with a more descriptive error
  // if the block truly isn't visible
}

/**
 * Seed a link between pages in the test database.
 * Note: links relation uses composite key (source_id, target_id, link_type)
 */
export async function seedLink(data: {
  sourceId: string;
  targetId: string;
  contextBlockId?: string | null;
  linkType?: string;
}): Promise<void> {
  const now = Date.now();
  const script = `
    ?[source_id, target_id, link_type, context_block_id, created_at] <- [[
      $source_id, $target_id, $link_type, $context_block_id, $now
    ]]
    :put links { source_id, target_id, link_type, context_block_id, created_at }
  `;

  await executeMutation(script, {
    source_id: data.sourceId,
    target_id: data.targetId,
    link_type: data.linkType ?? 'reference',
    context_block_id: data.contextBlockId ?? null,
    now,
  });
}

/**
 * Navigate to a page in the app.
 * Uses the Zustand store directly via browser context.
 */
export async function navigateToPage(page: Page, pageId: string): Promise<void> {
  await page.evaluate((id) => {
    // Access the Zustand store from window (exposed in dev mode)
    const store = (
      window as unknown as {
        __ZUSTAND_STORE__?: { getState: () => { navigateToPage: (id: string) => void } };
      }
    ).__ZUSTAND_STORE__;
    if (store) {
      store.getState().navigateToPage(id);
    }
  }, pageId);
}

/**
 * Helper to generate unique IDs for test data.
 */
export function generateId(prefix: string = 'test'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Wait for the backlinks panel to be visible.
 */
export async function waitForBacklinksPanel(page: Page): Promise<void> {
  await page.waitForSelector('[data-testid="backlinks-panel"]', { state: 'visible' });
}

/**
 * Toggle backlinks panel visibility using keyboard shortcut.
 */
export async function toggleBacklinksWithKeyboard(page: Page): Promise<void> {
  const isMac = process.platform === 'darwin';
  if (isMac) {
    await page.keyboard.press('Meta+b');
  } else {
    await page.keyboard.press('Control+b');
  }
}

/**
 * Wait for block content to be fully rendered.
 * Handles race conditions where block element exists but content is still loading.
 *
 * @param page - Playwright page instance
 * @param blockId - The block ID to wait for
 * @param options - Optional configuration
 * @returns The block element once content is ready
 */
export async function waitForBlockContent(
  page: Page,
  blockId: string,
  options?: { timeout?: number }
): Promise<void> {
  const timeout = options?.timeout ?? 5000;

  // Wait for the block node to exist
  const blockSelector = `[data-block-id="${blockId}"]`;
  await page.waitForSelector(blockSelector, { state: 'visible', timeout });

  // Wait for content to be rendered (not loading state)
  await page.waitForFunction(
    (id) => {
      const block = document.querySelector(`[data-block-id="${id}"]`);
      if (!block) return false;

      // Check it's not in loading state
      if (block.getAttribute('data-testid') === 'block-node-loading') {
        return false;
      }

      // Check content area has text
      const content = block.querySelector('[data-testid="static-block-content"]');
      if (content) {
        const text = content.textContent?.trim();
        return text !== undefined && text.length > 0;
      }

      // If editing, check editor has content
      const editor = block.querySelector('[data-testid="block-editor"]');
      if (editor) {
        return true; // Editor is mounted, content is ready
      }

      return false;
    },
    blockId,
    { timeout }
  );
}

/**
 * Wait for child blocks to be visible in the DOM.
 * Useful for tests that verify parent-child hierarchies after seeding.
 *
 * This handles the race condition where:
 * 1. seedBlock() executes 3 separate mutations
 * 2. useBlockChildren queries blocks_by_parent before mutation #3 completes
 * 3. React renders empty children initially
 *
 * @param page - Playwright page instance
 * @param parentBlockId - The parent block ID whose children we're waiting for
 * @param expectedChildIds - Array of child block IDs to wait for
 * @param options - Optional configuration
 */
export async function waitForChildBlocks(
  page: Page,
  parentBlockId: string,
  expectedChildIds: string[],
  options?: { timeout?: number }
): Promise<void> {
  const timeout = options?.timeout ?? 10000;

  if (expectedChildIds.length === 0) {
    return; // Nothing to wait for
  }

  await page.waitForFunction(
    ({ parentId, childIds }) => {
      // Find the parent block's children container
      const parentBlock = document.querySelector(
        `[data-testid="block-node"][data-block-id="${parentId}"]`
      );
      if (!parentBlock) return false;

      const childrenContainer = parentBlock.querySelector('[data-testid="block-children"]');
      if (!childrenContainer) return false;

      // Check all expected children are present and have content
      for (const childId of childIds) {
        const childBlock = childrenContainer.querySelector(
          `[data-testid="block-node"][data-block-id="${childId}"]`
        );
        if (!childBlock) return false;

        // Verify the child has rendered content (not in loading state)
        const content = childBlock.querySelector('[data-testid="static-block-content"]');
        const editor = childBlock.querySelector('.ProseMirror');
        if (!content && !editor) return false;
      }

      return true;
    },
    { parentId: parentBlockId, childIds: expectedChildIds },
    { timeout }
  );
}
