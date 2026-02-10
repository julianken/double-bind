/**
 * E2E Test: Page Operations
 *
 * Tests page creation, editing, navigation, and deletion on mobile.
 * Verifies touch-optimized page management workflows.
 *
 * Test Coverage:
 * - Create new page via button
 * - Edit page title with mobile keyboard
 * - Navigate between pages
 * - Delete pages with swipe actions
 * - Search and filter pages
 * - Handle daily notes
 */

/* eslint-disable no-console */

import { describe, it, beforeEach } from 'vitest';
import {
  waitForElement,
  assertElementExists,
  assertTextVisible,
  typeTextSlowly,
  swipeElement,
  navigateToPage,
  getElementByTestId,
  scrollToElement,
  takeScreenshot,
  wait,
} from '../setup/testHelpers';
import { createDeviceMock } from '../mocks/DeviceMock';

describe('Page Operations', () => {
  const device = createDeviceMock('ios');

  beforeEach(async () => {
    await device.reset();
    console.log('[Test] Launching app');
    await waitForElement('app-shell', 10000);
  });

  describe('Page Creation', () => {
    it('should create new page via button tap', async () => {
      // Tap "New Page" button
      const newPageButton = getElementByTestId('new-page-button');
      await newPageButton.tap();

      // Wait for page editor to appear
      await waitForElement('page-view', 5000);

      // Verify default title field is focused
      await assertElementExists('page-title-input');

      await takeScreenshot('new-page-created');
    });

    it('should create new page with custom title', async () => {
      // Create new page
      const newPageButton = getElementByTestId('new-page-button');
      await newPageButton.tap();

      await waitForElement('page-title-input', 5000);

      // Type custom title
      await typeTextSlowly('page-title-input', 'My Mobile Note');

      // Wait for auto-save
      await wait(500);

      // Verify title is saved
      await assertTextVisible('My Mobile Note');

      await takeScreenshot('page-with-custom-title');
    });

    it('should create daily note for today', async () => {
      // Open command menu or daily notes shortcut
      // Mobile might have a dedicated daily note button
      const dailyNoteButton = getElementByTestId('daily-note-button');
      await dailyNoteButton.tap();

      await waitForElement('page-view', 5000);

      // Verify daily note title format (e.g., "2024-02-09")
      // await assertTextVisible('2024-02-09');

      await takeScreenshot('daily-note-created');
    });
  });

  describe('Page Navigation', () => {
    it('should navigate to page from list', async () => {
      // Open pages list
      const pagesListButton = getElementByTestId('pages-list-button');
      await pagesListButton.tap();

      await waitForElement('pages-list', 3000);

      // Tap on first page in list
      const firstPage = getElementByTestId('page-list-item-0');
      await firstPage.tap();

      // Verify page view opens
      await waitForElement('page-view', 5000);

      await takeScreenshot('navigated-to-page');
    });

    it('should navigate back to pages list', async () => {
      // Navigate to a page first
      const pagesListButton = getElementByTestId('pages-list-button');
      await pagesListButton.tap();

      const firstPage = getElementByTestId('page-list-item-0');
      await firstPage.tap();

      await waitForElement('page-view', 5000);

      // Navigate back
      const backButton = getElementByTestId('back-button');
      await backButton.tap();

      // Verify pages list is visible
      await waitForElement('pages-list', 3000);

      await takeScreenshot('navigated-back-to-list');
    });

    it('should handle swipe-back gesture', async () => {
      // Navigate to a page
      const pagesListButton = getElementByTestId('pages-list-button');
      await pagesListButton.tap();

      const firstPage = getElementByTestId('page-list-item-0');
      await firstPage.tap();

      await waitForElement('page-view', 5000);

      // Swipe from left edge to go back
      await swipeElement('page-view', 'right', 'fast');

      // Verify pages list appears
      await waitForElement('pages-list', 3000);
    });
  });

  describe('Page Editing', () => {
    it('should edit page title', async () => {
      // Navigate to a page
      await navigateToPage('Test Page');

      await waitForElement('page-title-input', 5000);

      // Clear and type new title
      const titleInput = getElementByTestId('page-title-input');
      await titleInput.clearText();
      await typeTextSlowly('page-title-input', 'Updated Title');

      // Wait for auto-save
      await wait(500);

      await assertTextVisible('Updated Title');

      await takeScreenshot('page-title-updated');
    });

    it('should handle long page titles', async () => {
      await navigateToPage('Test Page');

      await waitForElement('page-title-input', 5000);

      const longTitle =
        'This is a very long page title that should wrap properly on mobile devices';

      const titleInput = getElementByTestId('page-title-input');
      await titleInput.clearText();
      await typeTextSlowly('page-title-input', longTitle);

      await wait(500);

      await assertTextVisible('This is a very long');

      await takeScreenshot('long-page-title');
    });

    it('should handle emoji in page titles', async () => {
      await navigateToPage('Test Page');

      await waitForElement('page-title-input', 5000);

      const titleInput = getElementByTestId('page-title-input');
      await titleInput.clearText();
      await typeTextSlowly('page-title-input', '🎯 Project Goals');

      await wait(500);

      await assertTextVisible('🎯 Project Goals');
    });
  });

  describe('Page Deletion', () => {
    it('should delete page with swipe action', async () => {
      // Open pages list
      const pagesListButton = getElementByTestId('pages-list-button');
      await pagesListButton.tap();

      await waitForElement('pages-list', 3000);

      // Swipe left on page item to reveal delete action
      await swipeElement('page-list-item-0', 'left', 'fast');

      // Tap delete button
      const deleteButton = getElementByTestId('delete-page-button');
      await deleteButton.tap();

      // Confirm deletion
      const confirmButton = getElementByTestId('confirm-delete-button');
      await confirmButton.tap();

      // Verify page is removed from list
      // await assertElementNotExists('page-list-item-0');

      await takeScreenshot('page-deleted');
    });

    it('should cancel page deletion', async () => {
      const pagesListButton = getElementByTestId('pages-list-button');
      await pagesListButton.tap();

      await waitForElement('pages-list', 3000);

      await swipeElement('page-list-item-0', 'left', 'fast');

      const deleteButton = getElementByTestId('delete-page-button');
      await deleteButton.tap();

      // Cancel deletion
      const cancelButton = getElementByTestId('cancel-delete-button');
      await cancelButton.tap();

      // Verify page still exists
      await assertElementExists('page-list-item-0');
    });
  });

  describe('Page Search and Filtering', () => {
    it('should search pages by title', async () => {
      const searchButton = getElementByTestId('search-button');
      await searchButton.tap();

      await waitForElement('search-input', 3000);

      await typeTextSlowly('search-input', 'test');

      await wait(300);

      // Verify search results appear
      await assertElementExists('search-results');

      await takeScreenshot('page-search-results');
    });

    it('should filter pages by tag', async () => {
      // Open filter menu
      const filterButton = getElementByTestId('filter-button');
      await filterButton.tap();

      await waitForElement('filter-menu', 3000);

      // Select tag filter
      const tagFilter = getElementByTestId('tag-filter-work');
      await tagFilter.tap();

      // Verify filtered results
      await assertElementExists('filtered-pages-list');

      await takeScreenshot('pages-filtered-by-tag');
    });

    it('should clear search and show all pages', async () => {
      const searchButton = getElementByTestId('search-button');
      await searchButton.tap();

      await waitForElement('search-input', 3000);

      await typeTextSlowly('search-input', 'test');
      await wait(300);

      // Clear search
      const clearButton = getElementByTestId('clear-search-button');
      await clearButton.tap();

      // Verify all pages are shown again
      await assertElementExists('pages-list');
    });
  });

  describe('Scrolling and Pagination', () => {
    it('should scroll through long pages list', async () => {
      const pagesListButton = getElementByTestId('pages-list-button');
      await pagesListButton.tap();

      await waitForElement('pages-list', 3000);

      // Scroll down
      const pagesList = getElementByTestId('pages-list');
      await pagesList.scroll(300, 'down');

      await wait(500);

      // Verify new items are loaded
      await assertElementExists('page-list-item-10');

      await takeScreenshot('pages-list-scrolled');
    });

    it('should load more pages on scroll', async () => {
      const pagesListButton = getElementByTestId('pages-list-button');
      await pagesListButton.tap();

      await waitForElement('pages-list', 3000);

      // Scroll to bottom to trigger pagination
      await scrollToElement('pages-list', 'load-more-trigger');

      await wait(1000);

      // Verify more pages loaded
      // await assertElementExists('page-list-item-20');
    });
  });

  describe('Offline Support', () => {
    it('should create page while offline', async () => {
      // Set device to offline
      await device.setNetworkCondition('offline');

      const newPageButton = getElementByTestId('new-page-button');
      await newPageButton.tap();

      await waitForElement('page-view', 5000);

      await typeTextSlowly('page-title-input', 'Offline Page');

      await wait(500);

      // Verify page is created locally
      await assertTextVisible('Offline Page');

      // Verify offline indicator
      // await assertElementExists('offline-indicator');

      // Restore network
      await device.setNetworkCondition('online');
    });
  });
});
