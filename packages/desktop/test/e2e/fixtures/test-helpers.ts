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
 * Execute a SQL query against the test database.
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
 * Execute a SQL mutation against the test database.
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
    throw new Error(`Mutation failed: ${JSON.stringify(error, null, 2)}`);
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

  await executeMutation(
    `INSERT INTO pages (page_id, title, daily_note_date, is_deleted, created_at, updated_at)
     VALUES ($page_id, $title, $daily_note_date, 0, $now, $now)`,
    {
      page_id: data.pageId,
      title: data.title,
      daily_note_date: data.dailyNoteDate ?? null,
      now,
    }
  );

  // Also populate the daily_notes lookup table if this is a daily note
  if (data.dailyNoteDate) {
    await executeMutation(
      `INSERT INTO daily_notes (date, page_id) VALUES ($date, $page_id)`,
      {
        date: data.dailyNoteDate,
        page_id: data.pageId,
      }
    );
  }
}

/**
 * Seed a block in the test database.
 * SQLite indexes are automatic — no manual index maintenance needed.
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
  const order = data.order ?? 'a0';

  await executeMutation(
    `INSERT INTO blocks (block_id, page_id, content, content_type, parent_id, "order",
                         is_collapsed, is_deleted, created_at, updated_at)
     VALUES ($block_id, $page_id, $content, 'text', $parent_id, $order, 0, 0, $now, $now)`,
    {
      block_id: data.blockId,
      page_id: data.pageId,
      content: data.content,
      parent_id: parentId,
      order,
      now,
    }
  );
}

/**
 * Seed a link between pages in the test database.
 */
export async function seedLink(data: {
  sourceId: string;
  targetId: string;
  contextBlockId?: string | null;
  linkType?: string;
}): Promise<void> {
  const now = Date.now();

  await executeMutation(
    `INSERT INTO links (source_id, target_id, link_type, context_block_id, created_at)
     VALUES ($source_id, $target_id, $link_type, $context_block_id, $now)`,
    {
      source_id: data.sourceId,
      target_id: data.targetId,
      link_type: data.linkType ?? 'reference',
      context_block_id: data.contextBlockId ?? null,
      now,
    }
  );
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
