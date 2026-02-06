/**
 * E2E Test: [[page link]] creation and navigation
 *
 * Layer 3 E2E test using Playwright that exercises the full [[page link]] workflow:
 * - Typing `[[` to trigger autocomplete
 * - Selecting a page from dropdown
 * - Verifying the link renders correctly
 * - Clicking the link to navigate to the target page
 * - Testing creating a link to a non-existent page
 *
 * These tests use the mock Tauri IPC infrastructure defined in e2e-fast.md.
 * Tests are marked with .fixme() when they depend on features not yet implemented.
 *
 * @see docs/testing/e2e-fast.md for test infrastructure details
 * @see DBB-210 for the Linear issue tracking this work
 */

import { test, expect, type Page } from '@playwright/test';

// ============================================================================
// Test Fixtures and Helpers
// ============================================================================

/**
 * Helper to wait for the autocomplete dropdown to appear
 */
async function waitForAutocomplete(page: Page) {
  await expect(page.getByTestId('autocomplete-dropdown')).toBeVisible({ timeout: 5000 });
}

/**
 * Helper to type in the block editor and trigger autocomplete
 */
async function typeInEditor(page: Page, text: string) {
  // Find the ProseMirror editor element
  const editor = page.locator('.ProseMirror').first();
  await editor.waitFor({ state: 'visible', timeout: 5000 });
  await editor.click();
  await page.keyboard.type(text, { delay: 50 });
}

/**
 * Helper to select an autocomplete item by clicking
 */
async function selectAutocompleteItem(page: Page, index: number) {
  const item = page.getByTestId(`autocomplete-item-${index}`);
  await expect(item).toBeVisible();
  await item.click();
}

/**
 * Helper to navigate to a page with a block editor
 * Note: This requires the app to have proper routing and page creation
 */
async function navigateToPageWithEditor(page: Page, pageId: string) {
  // Navigate to a specific page that has a block editor
  // The current routing uses Zustand state, so we need to trigger navigation
  await page.goto('/');
  await page.evaluate((id) => {
    // Access the Zustand store to navigate to a page
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

// ============================================================================
// Test Suite: Autocomplete Trigger
// ============================================================================

test.describe('[[page link]] autocomplete trigger', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('app-shell')).toBeVisible();
  });

  // This test requires a functional block editor with the autocomplete plugin wired up
  test.fixme('typing [[ in block editor triggers autocomplete dropdown', async ({ page }) => {
    // Navigate to a page with an editor
    await navigateToPageWithEditor(page, 'test-page-1');

    // Type [[ to trigger autocomplete
    await typeInEditor(page, '[[');

    // Autocomplete dropdown should appear
    await waitForAutocomplete(page);
    await expect(page.getByTestId('autocomplete-dropdown')).toBeVisible();
  });

  test.fixme('typing partial page name filters autocomplete results', async ({ page }) => {
    await navigateToPageWithEditor(page, 'test-page-1');

    // Type [[ followed by partial name
    await typeInEditor(page, '[[Test');

    // Wait for autocomplete with filtered results
    await waitForAutocomplete(page);

    // Check that results are filtered
    const items = page.locator('[data-testid^="autocomplete-item-"]');
    await expect(items.first()).toBeVisible();

    // Each visible item should contain 'Test' (case-insensitive)
    const count = await items.count();
    for (let i = 0; i < count; i++) {
      const text = await items.nth(i).textContent();
      expect(text?.toLowerCase()).toContain('test');
    }
  });
});

// ============================================================================
// Test Suite: Autocomplete Selection
// ============================================================================

test.describe('[[page link]] autocomplete selection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('app-shell')).toBeVisible();
  });

  test.fixme('selecting page from dropdown inserts [[Page Title]]', async ({ page }) => {
    await navigateToPageWithEditor(page, 'test-page-1');

    // Type [[ to trigger autocomplete
    await typeInEditor(page, '[[');
    await waitForAutocomplete(page);

    // Click on the first suggestion
    await selectAutocompleteItem(page, 0);

    // Autocomplete should close
    await expect(page.getByTestId('autocomplete-dropdown')).not.toBeVisible();

    // Editor should contain [[Page Title]] format
    const editor = page.locator('.ProseMirror');
    await expect(editor).toContainText('[[');
    await expect(editor).toContainText(']]');
  });

  test.fixme('pressing Enter selects the highlighted autocomplete item', async ({ page }) => {
    await navigateToPageWithEditor(page, 'test-page-1');

    await typeInEditor(page, '[[');
    await waitForAutocomplete(page);

    // First item should be selected by default
    const firstItem = page.getByTestId('autocomplete-item-0');
    await expect(firstItem).toHaveAttribute('aria-selected', 'true');

    // Press Enter to select
    await page.keyboard.press('Enter');

    // Autocomplete should close and link should be inserted
    await expect(page.getByTestId('autocomplete-dropdown')).not.toBeVisible();
  });

  test.fixme('pressing Tab selects autocomplete item', async ({ page }) => {
    await navigateToPageWithEditor(page, 'test-page-1');

    await typeInEditor(page, '[[test');
    await waitForAutocomplete(page);

    // Press Tab to select
    await page.keyboard.press('Tab');

    // Autocomplete should close and link should be inserted
    await expect(page.getByTestId('autocomplete-dropdown')).not.toBeVisible();
  });

  test.fixme('pressing Escape closes autocomplete without inserting', async ({ page }) => {
    await navigateToPageWithEditor(page, 'test-page-1');

    await typeInEditor(page, '[[test');
    await waitForAutocomplete(page);

    // Press Escape to dismiss
    await page.keyboard.press('Escape');

    // Autocomplete should close
    await expect(page.getByTestId('autocomplete-dropdown')).not.toBeVisible();

    // The text [[test should remain (not converted to a link)
    const editor = page.locator('.ProseMirror');
    await expect(editor).toContainText('[[test');
    // Should NOT have closing brackets since no selection was made
    const content = await editor.textContent();
    expect(content).not.toContain('[[test]]');
  });
});

// ============================================================================
// Test Suite: Keyboard Navigation
// ============================================================================

test.describe('[[page link]] keyboard navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('app-shell')).toBeVisible();
  });

  test.fixme('ArrowDown moves selection to next item', async ({ page }) => {
    await navigateToPageWithEditor(page, 'test-page-1');

    await typeInEditor(page, '[[');
    await waitForAutocomplete(page);

    // First item should be selected initially
    await expect(page.getByTestId('autocomplete-item-0')).toHaveAttribute('aria-selected', 'true');

    // Press ArrowDown
    await page.keyboard.press('ArrowDown');

    // Second item should now be selected
    await expect(page.getByTestId('autocomplete-item-1')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('autocomplete-item-0')).toHaveAttribute('aria-selected', 'false');
  });

  test.fixme('ArrowUp moves selection to previous item', async ({ page }) => {
    await navigateToPageWithEditor(page, 'test-page-1');

    await typeInEditor(page, '[[');
    await waitForAutocomplete(page);

    // Move down first
    await page.keyboard.press('ArrowDown');
    await expect(page.getByTestId('autocomplete-item-1')).toHaveAttribute('aria-selected', 'true');

    // Press ArrowUp
    await page.keyboard.press('ArrowUp');

    // First item should be selected again
    await expect(page.getByTestId('autocomplete-item-0')).toHaveAttribute('aria-selected', 'true');
  });

  test.fixme('keyboard navigation wraps around at boundaries', async ({ page }) => {
    await navigateToPageWithEditor(page, 'test-page-1');

    await typeInEditor(page, '[[');
    await waitForAutocomplete(page);

    // Get total items
    const items = page.locator('[data-testid^="autocomplete-item-"]');
    const count = await items.count();

    // Press ArrowUp from first item should go to last
    await page.keyboard.press('ArrowUp');
    await expect(page.getByTestId(`autocomplete-item-${count - 1}`)).toHaveAttribute(
      'aria-selected',
      'true'
    );

    // Press ArrowDown from last item should go to first
    await page.keyboard.press('ArrowDown');
    await expect(page.getByTestId('autocomplete-item-0')).toHaveAttribute('aria-selected', 'true');
  });
});

// ============================================================================
// Test Suite: Link Rendering
// ============================================================================

test.describe('[[page link]] rendering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('app-shell')).toBeVisible();
  });

  test.fixme('page link renders with distinct styling in static content', async ({ page }) => {
    // Navigate to a page that has existing [[page links]] in its content
    await navigateToPageWithEditor(page, 'page-with-links');

    // Find the inline page link component
    const link = page.getByTestId('inline-page-link').first();
    await expect(link).toBeVisible();

    // Verify it has the expected structure with brackets
    await expect(link).toContainText('[[');
    await expect(link).toContainText(']]');

    // Verify it has the page title
    const title = page.getByTestId('inline-page-link-title').first();
    await expect(title).toBeVisible();
  });

  test.fixme('missing page link shows strikethrough styling', async ({ page }) => {
    // Navigate to a page with a link to a deleted/non-existent page
    await navigateToPageWithEditor(page, 'page-with-broken-link');

    // Find the link that points to a non-existent page
    const link = page.locator('[data-testid="inline-page-link"][data-exists="false"]').first();
    await expect(link).toBeVisible();

    // Should have aria-disabled for accessibility
    await expect(link).toHaveAttribute('aria-disabled', 'true');
  });
});

// ============================================================================
// Test Suite: Link Navigation
// ============================================================================

test.describe('[[page link]] navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('app-shell')).toBeVisible();
  });

  test.fixme('clicking rendered link navigates to target page', async ({ page }) => {
    // Navigate to a page with a [[page link]] to another existing page
    await navigateToPageWithEditor(page, 'page-with-links');

    // Find and click the page link
    const link = page.getByTestId('inline-page-link').first();
    await expect(link).toBeVisible();

    // Get the target page ID
    const targetPageId = await link.getAttribute('data-page-id');

    // Click the link
    await link.click();

    // Should navigate to the target page
    // Verify by checking the page view has the correct page ID
    await expect(
      page.locator(`[data-testid="page-view"][data-page-id="${targetPageId}"]`)
    ).toBeVisible({ timeout: 5000 });
  });

  test.fixme('keyboard Enter on focused link navigates to target page', async ({ page }) => {
    await navigateToPageWithEditor(page, 'page-with-links');

    // Focus the page link using keyboard navigation
    const link = page.getByTestId('inline-page-link').first();
    await link.focus();

    // Get target page ID
    const targetPageId = await link.getAttribute('data-page-id');

    // Press Enter to navigate
    await page.keyboard.press('Enter');

    // Should navigate to the target page
    await expect(
      page.locator(`[data-testid="page-view"][data-page-id="${targetPageId}"]`)
    ).toBeVisible({ timeout: 5000 });
  });
});

// ============================================================================
// Test Suite: Create New Page
// ============================================================================

test.describe('[[page link]] create new page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('app-shell')).toBeVisible();
  });

  test.fixme('typing non-existent page name shows "Create" option in dropdown', async ({
    page,
  }) => {
    await navigateToPageWithEditor(page, 'test-page-1');

    // Type a page name that doesn't exist
    await typeInEditor(page, '[[UniqueNewPageName123');
    await waitForAutocomplete(page);

    // Should show "Create: [[UniqueNewPageName123]]" option
    const createOption = page.locator('.autocomplete-dropdown__item--create-new');
    await expect(createOption).toBeVisible();
    await expect(createOption).toContainText('Create:');
    await expect(createOption).toContainText('UniqueNewPageName123');
  });

  test.fixme('selecting "Create" option inserts link to new page', async ({ page }) => {
    await navigateToPageWithEditor(page, 'test-page-1');

    await typeInEditor(page, '[[BrandNewTestPage');
    await waitForAutocomplete(page);

    // Click the Create option
    const createOption = page.locator('.autocomplete-dropdown__item--create-new');
    await createOption.click();

    // Link should be inserted
    const editor = page.locator('.ProseMirror');
    await expect(editor).toContainText('[[BrandNewTestPage]]');

    // Autocomplete should close
    await expect(page.getByTestId('autocomplete-dropdown')).not.toBeVisible();
  });

  test.fixme('clicking newly created page link navigates and creates the page', async ({
    page,
  }) => {
    await navigateToPageWithEditor(page, 'test-page-1');

    // Create a link to a new page
    await typeInEditor(page, '[[NewlyCreatedPage');
    await waitForAutocomplete(page);

    const createOption = page.locator('.autocomplete-dropdown__item--create-new');
    await createOption.click();

    // Find and click the newly inserted link
    const link = page.getByTestId('inline-page-link').first();
    await expect(link).toBeVisible();
    await link.click();

    // Should navigate to the new page
    const pageTitle = page.getByTestId('page-title');
    await expect(pageTitle).toContainText('NewlyCreatedPage');
  });
});

// ============================================================================
// Smoke Tests - Basic App Structure (these should pass)
// ============================================================================

test.describe('App smoke tests', () => {
  test('app loads and displays shell', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('app-shell')).toBeVisible();
  });

  test('sidebar is visible by default', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('sidebar')).toBeVisible();
  });

  test('navigation bar is visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('navigation-bar')).toBeVisible();
  });

  test('daily notes view is shown by default', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('daily-notes-view')).toBeVisible();
  });

  test('sidebar navigation buttons are present', async ({ page }) => {
    await page.goto('/');

    // Check for navigation buttons in sidebar
    await expect(page.getByRole('button', { name: 'Daily Notes' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Graph View' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Query Editor' })).toBeVisible();
  });
});
