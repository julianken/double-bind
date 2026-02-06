/**
 * Test Data Fixtures for E2E Tests
 *
 * Provides helpers to seed test data via the HTTP bridge.
 * Each test should call seedTestData() with the required pages/blocks/links
 * to set up its test scenario.
 */

import type { Page } from '@playwright/test';
import { ulid } from 'ulid';

// Bridge server URL
const BRIDGE_URL = 'http://localhost:3001';

/**
 * Page definition for seeding
 */
export interface SeedPage {
  id?: string;
  title: string;
  blocks?: SeedBlock[];
  dailyNoteDate?: string | null;
}

/**
 * Block definition for seeding
 */
export interface SeedBlock {
  id?: string;
  content: string;
  parentId?: string | null;
  order?: string;
}

/**
 * Reset the database to a clean state
 */
export async function resetDatabase(): Promise<void> {
  const response = await fetch(`${BRIDGE_URL}/reset`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`Failed to reset database: ${response.statusText}`);
  }
}

/**
 * Seed test data into the database.
 *
 * Creates pages with optional blocks. Links are automatically extracted
 * from [[wiki-style links]] in block content.
 *
 * @example
 * ```typescript
 * await seedTestData({
 *   pages: [
 *     {
 *       id: 'page-1',
 *       title: 'Page One',
 *       blocks: [{ content: 'See [[Page Two]]' }],
 *     },
 *     { id: 'page-2', title: 'Page Two' },
 *   ],
 * });
 * ```
 */
export async function seedTestData(data: { pages: SeedPage[] }): Promise<Map<string, string>> {
  const { pages } = data;

  // Generate IDs if not provided and build title->id map
  const titleToId = new Map<string, string>();
  const pageIds: string[] = [];

  for (const page of pages) {
    const id = page.id || ulid();
    pageIds.push(id);
    titleToId.set(page.title, id);
  }

  // Create pages
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]!;
    const pageId = pageIds[i]!;
    const now = Date.now();

    await invokeCommand('mutate', {
      script: `
        ?[page_id, title, daily_note_date, created_at, updated_at, is_deleted] <- [[
          $page_id, $title, $daily_note_date, $created_at, $updated_at, false
        ]]
        :put pages { page_id, title, daily_note_date, created_at, updated_at, is_deleted }
      `,
      params: {
        page_id: pageId,
        title: page.title,
        daily_note_date: page.dailyNoteDate ?? null,
        created_at: now,
        updated_at: now,
      },
    });

    // Create blocks for this page
    if (page.blocks && page.blocks.length > 0) {
      for (let j = 0; j < page.blocks.length; j++) {
        const block = page.blocks[j]!;
        const blockId = block.id || ulid();
        const order = block.order || String(j).padStart(5, '0');

        await invokeCommand('mutate', {
          script: `
            ?[block_id, page_id, parent_id, content, order, is_collapsed, created_at, updated_at, is_deleted] <- [[
              $block_id, $page_id, $parent_id, $content, $order, false, $created_at, $updated_at, false
            ]]
            :put blocks { block_id, page_id, parent_id, content, order, is_collapsed, created_at, updated_at, is_deleted }
          `,
          params: {
            block_id: blockId,
            page_id: pageId,
            parent_id: block.parentId ?? null,
            content: block.content,
            order: order,
            created_at: now,
            updated_at: now,
          },
        });

        // Extract links from block content
        const linkRegex = /\[\[([^\]]+)\]\]/g;
        let match;
        while ((match = linkRegex.exec(block.content)) !== null) {
          const targetTitle = match[1]!;
          const targetId = titleToId.get(targetTitle);

          if (targetId) {
            await invokeCommand('mutate', {
              script: `
                ?[source_id, target_id, link_type, context_block_id, created_at] <- [[
                  $source_id, $target_id, "reference", $block_id, $created_at
                ]]
                :put links { source_id, target_id, link_type, context_block_id, created_at }
              `,
              params: {
                source_id: pageId,
                target_id: targetId,
                block_id: blockId,
                created_at: now,
              },
            });
          }
        }
      }
    }
  }

  return titleToId;
}

/**
 * Invoke a command on the bridge server
 */
async function invokeCommand(cmd: string, args: Record<string, unknown>): Promise<unknown> {
  const response = await fetch(`${BRIDGE_URL}/invoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cmd, args }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Bridge command failed: ${error.error || response.statusText}`);
  }

  return response.json();
}

/**
 * Configure the page to use mock IPC that forwards to the bridge server.
 * This should be called in page.addInitScript().
 */
export function getMockIPCScript(): string {
  return `
    // Mock Tauri IPC to forward to HTTP bridge
    window.__TAURI_INTERNALS__ = window.__TAURI_INTERNALS__ || {};

    window.__TAURI_INTERNALS__.invoke = async function(cmd, args) {
      const response = await fetch('http://localhost:3001/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cmd, args }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Bridge request failed');
      }

      return response.json();
    };

    // Mark as test environment
    window.__E2E_TEST__ = true;
  `;
}

/**
 * Setup a Playwright page with mock IPC before navigation.
 * Call this before page.goto().
 */
export async function setupMockIPC(page: Page): Promise<void> {
  await page.addInitScript(getMockIPCScript());
}
