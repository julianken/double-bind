/**
 * E2E Test: Page Creation Flow (DBB-104)
 *
 * Tests page creation, rendering, and editing:
 * 1. Create pages via UI (sidebar button)
 * 2. Verify page renders with correct title
 * 3. Edit page titles
 * 4. Create blocks by typing and pressing Enter
 * 5. Test parent-child block structure
 * 6. Verify blocks render correctly
 * 7. Verify page appears in sidebar
 * 8. Verify editor activation on click
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
    // PageTitle renders an <input> for regular pages
    await expect(pageTitle).toHaveValue('My Test Page');
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
    // PageTitle renders an <input> for regular pages
    await expect(page.getByTestId('page-title')).toHaveValue('Page One');
    await expect(page.getByTestId('block-tree')).toContainText('Content for Page One');

    // Navigate to Page Two
    await navigateToPageById(page, page2Id);
    await expect(page.getByTestId('page-view')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('page-title')).toHaveValue('Page Two');
    await expect(page.getByTestId('block-tree')).toContainText('Content for Page Two');

    // Navigate back to Page One
    await navigateToPageById(page, page1Id);
    await expect(page.getByTestId('page-title')).toHaveValue('Page One');
    await expect(page.getByTestId('block-tree')).toContainText('Content for Page One');
  });

  // ============================================================================
  // UI-Based Page Creation Tests
  // ============================================================================

  // TODO: The "No pages yet" empty state intercepts pointer events on the New Page button.
  // Additionally, the button click doesn't trigger navigation in E2E — likely because
  // the useCreatePage hook needs the ServiceContext wiring that isn't set up for this component.
  // The New Page flow is verified at the unit test level (NewPageButton.test.tsx).
  test.skip('creates a new page via sidebar button', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('app-shell')).toBeVisible({ timeout: 10000 });

    // Wait for sidebar to be ready
    const sidebar = page.getByTestId('sidebar');
    await expect(sidebar).toBeVisible({ timeout: 5000 });

    // Wait for DailyNotesView to finish creating today's note
    // so the page list has at least one entry and the empty state disappears
    await page.waitForTimeout(1000);

    // Click the "New Page" button in the sidebar
    // Use force:true because the page-list-empty state may overlap the button
    const newPageButton = page.getByRole('button', { name: 'Create new page' });
    await expect(newPageButton).toBeVisible({ timeout: 5000 });
    await newPageButton.click({ force: true });

    // Verify a new page is created and we navigate to it - use proper assertion
    await expect(page.getByTestId('page-view')).toBeVisible({ timeout: 10000 });

    // The page should have a default title (Untitled)
    const pageTitle = page.getByTestId('page-title');
    await expect(pageTitle).toBeVisible({ timeout: 5000 });

    // The page should appear in the page list (not empty state anymore)
    const pageList = page.getByTestId('page-list');
    await expect(pageList).toBeVisible({ timeout: 5000 });
    await expect(pageList).toContainText('Untitled', { timeout: 5000 });
  });

  test('edits page title', async ({ page }) => {
    // Seed a page first
    const pageId = generateId('page');
    await seedPage({ pageId, title: 'Original Title' });

    await page.goto('/');
    await expect(page.getByTestId('app-shell')).toBeVisible({ timeout: 10000 });

    // Navigate to the page
    await navigateToPageById(page, pageId);
    await expect(page.getByTestId('page-view')).toBeVisible({ timeout: 5000 });

    // Get the page title input (PageTitle renders an <input> for regular pages)
    const pageTitle = page.getByTestId('page-title');
    await expect(pageTitle).toBeVisible({ timeout: 5000 });

    // Verify it has the original title
    await expect(pageTitle).toHaveValue('Original Title');

    // Clear and type new title (use fill + type for React controlled input)
    await pageTitle.click();
    await pageTitle.fill('');
    await pageTitle.type('Updated Title');

    // Press Enter to flush the debounced save and blur
    await pageTitle.press('Enter');

    // Wait for the async save to complete (debounce + IPC round-trip)
    await page.waitForTimeout(1000);

    // Verify the title updated in the input
    await expect(pageTitle).toHaveValue('Updated Title', { timeout: 5000 });

    // Navigate away and back to verify persistence
    await page.goto('/');
    await expect(page.getByTestId('app-shell')).toBeVisible({ timeout: 10000 });
    await navigateToPageById(page, pageId);

    // Wait for page view to load
    await expect(page.getByTestId('page-view')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('page-title')).toHaveValue('Updated Title', { timeout: 5000 });
  });

  // ============================================================================
  // Block Creation via UI (Enter Key)
  // These tests verify the Enter key creates new blocks (DBB-326 fix)
  // Note: These tests are skipped due to issues with block rendering in the
  // E2E test environment. The seeded block content isn't being displayed,
  // which suggests a data fetching race condition.
  // TODO: Investigate why blocks render without content in some E2E test runs.
  // ============================================================================

  test('creates new block by pressing Enter', async ({ page }) => {
    // Seed a page with one block
    const pageId = generateId('page');
    const blockId = generateId('block');
    await seedPage({ pageId, title: 'Enter Key Test' });
    await seedBlock({
      blockId,
      pageId,
      content: 'First block',
      order: 'a0',
    });

    await page.goto('/');
    await expect(page.getByTestId('app-shell')).toBeVisible({ timeout: 10000 });

    // Navigate to the page
    await navigateToPageById(page, pageId);
    await expect(page.getByTestId('page-view')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('block-tree')).toBeVisible({ timeout: 5000 });

    // Verify initial block count and content
    const initialBlockNodes = page.getByTestId('block-node');
    await expect(initialBlockNodes).toHaveCount(1, { timeout: 5000 });

    // Verify block content is visible before clicking
    await expect(page.getByTestId('block-tree')).toContainText('First block', { timeout: 5000 });

    // Click on the first block to activate the editor
    await clickOnBlock(page);
    const editor = page.locator('.ProseMirror').first();
    await expect(editor).toBeVisible({ timeout: 5000 });
    await expect(editor).toBeFocused({ timeout: 2000 });

    // Verify the editor contains the block content
    await expect(editor).toContainText('First block', { timeout: 5000 });

    // Press Enter to create a new block (cursor position doesn't affect test - we just need 2 blocks)
    await page.keyboard.press('Enter');

    // Wait for new block to be created
    const blockNodes = page.getByTestId('block-node');
    await expect(blockNodes).toHaveCount(2, { timeout: 5000 });
  });

  // TODO: Focus management after Enter needs more work - focusBlock doesn't reliably
  // move focus to the new block's editor in time for typing
  test('types content in new block after Enter', async ({ page }) => {
    // Seed a page with one block
    const pageId = generateId('page');
    const blockId = generateId('block');
    await seedPage({ pageId, title: 'Type After Enter Test' });
    await seedBlock({
      blockId,
      pageId,
      content: 'First block',
      order: 'a0',
    });

    await page.goto('/');
    await expect(page.getByTestId('app-shell')).toBeVisible({ timeout: 10000 });

    // Navigate to the page
    await navigateToPageById(page, pageId);
    await expect(page.getByTestId('page-view')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('block-tree')).toBeVisible({ timeout: 5000 });

    // Click on the first block to activate the editor
    await clickOnBlock(page);
    const editor = page.locator('.ProseMirror').first();
    await expect(editor).toBeVisible({ timeout: 5000 });
    await expect(editor).toBeFocused({ timeout: 2000 });

    // Press Enter to create a new block
    await page.keyboard.press('Enter');

    // Wait for new block to be created - use proper assertion
    const blockNodes = page.getByTestId('block-node');
    await expect(blockNodes).toHaveCount(2, { timeout: 5000 });

    // The new block should be focused - find the currently focused editor
    const focusedEditor = page.locator('.ProseMirror:focus');
    await expect(focusedEditor).toBeVisible({ timeout: 5000 });

    // Type in the new block (which should now be focused)
    await page.keyboard.type('Second block content');

    // Verify the block tree contains both blocks - use waitFor assertion
    const blockTree = page.getByTestId('block-tree');
    await expect(blockTree).toContainText('First block', { timeout: 5000 });
    await expect(blockTree).toContainText('Second block content', { timeout: 5000 });
  });

  // ============================================================================
  // Parent-Child Block Structure Tests
  // Note: These tests are currently skipped due to a data fetching timing issue
  // where useBlockChildren does not return child blocks on initial render.
  // This needs investigation - the data is seeded correctly but the recursive
  // child fetching in BlockNode doesn't get the data in time.
  // See: useBlockChildren in BlockNode.tsx - enabled condition may have timing issue
  // ============================================================================

  test('displays parent-child block structure correctly', async ({ page }) => {
    // Seed a page with parent and child blocks
    const pageId = generateId('page');
    const parentBlockId = generateId('parent-block');
    const childBlockId = generateId('child-block');
    await seedPage({ pageId, title: 'Nested Blocks Page' });

    // Create parent block
    await seedBlock({
      blockId: parentBlockId,
      pageId,
      content: 'Parent block',
      order: 'a0',
    });

    // Create child block with parentId
    await seedBlock({
      blockId: childBlockId,
      pageId,
      content: 'Child block',
      parentId: parentBlockId,
      order: 'a0',
    });

    await page.goto('/');
    await expect(page.getByTestId('app-shell')).toBeVisible({ timeout: 10000 });

    // Navigate to the page
    await navigateToPageById(page, pageId);
    await expect(page.getByTestId('page-view')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('block-tree')).toBeVisible({ timeout: 5000 });

    // Wait for child data fetching
    await page.waitForTimeout(1000);

    // Verify both blocks are visible
    const blockTree = page.getByTestId('block-tree');
    await expect(blockTree).toContainText('Parent block');
    await expect(blockTree).toContainText('Child block');

    // Verify child block is nested (has correct parent via data attribute or nesting)
    const blockNodes = page.getByTestId('block-node');
    await expect(blockNodes).toHaveCount(2, { timeout: 5000 });

    // The child block should be visually nested under the parent
    // Check that Child block appears after Parent block in the DOM
    const blockTreeText = await blockTree.textContent();
    const parentIndex = blockTreeText?.indexOf('Parent block') ?? -1;
    const childIndex = blockTreeText?.indexOf('Child block') ?? -1;
    expect(parentIndex).toBeGreaterThan(-1);
    expect(childIndex).toBeGreaterThan(parentIndex);
  });

  test('displays deeply nested block structure', async ({ page }) => {
    // Seed a page with 3-level nesting
    const pageId = generateId('page');
    const level1Id = generateId('level-1');
    const level2Id = generateId('level-2');
    const level3Id = generateId('level-3');
    await seedPage({ pageId, title: 'Deep Nesting Page' });

    // Level 1 (root)
    await seedBlock({
      blockId: level1Id,
      pageId,
      content: 'Level 1',
      order: 'a0',
    });

    // Level 2 (child of Level 1)
    await seedBlock({
      blockId: level2Id,
      pageId,
      content: 'Level 2',
      parentId: level1Id,
      order: 'a0',
    });

    // Level 3 (child of Level 2)
    await seedBlock({
      blockId: level3Id,
      pageId,
      content: 'Level 3',
      parentId: level2Id,
      order: 'a0',
    });

    await page.goto('/');
    await expect(page.getByTestId('app-shell')).toBeVisible({ timeout: 10000 });

    // Navigate to the page
    await navigateToPageById(page, pageId);
    await expect(page.getByTestId('page-view')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('block-tree')).toBeVisible({ timeout: 5000 });

    // Wait for child data fetching
    await page.waitForTimeout(1000);

    // Verify all blocks are visible
    const blockTree = page.getByTestId('block-tree');
    await expect(blockTree).toContainText('Level 1');
    await expect(blockTree).toContainText('Level 2');
    await expect(blockTree).toContainText('Level 3');

    // Verify proper nesting order
    const blockTreeText = await blockTree.textContent();
    const level1Index = blockTreeText?.indexOf('Level 1') ?? -1;
    const level2Index = blockTreeText?.indexOf('Level 2') ?? -1;
    const level3Index = blockTreeText?.indexOf('Level 3') ?? -1;

    expect(level1Index).toBeGreaterThan(-1);
    expect(level2Index).toBeGreaterThan(level1Index);
    expect(level3Index).toBeGreaterThan(level2Index);

    // Verify we have 3 block nodes
    const blockNodes = page.getByTestId('block-node');
    await expect(blockNodes).toHaveCount(3, { timeout: 5000 });
  });
});
