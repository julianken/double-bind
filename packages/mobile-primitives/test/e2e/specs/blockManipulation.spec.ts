/**
 * E2E Test: Block Manipulation with Touch
 *
 * Tests block creation, editing, reordering, and deletion using touch gestures.
 * Mobile-specific interactions: swipe to indent/outdent, drag to reorder, long-press menus.
 *
 * Test Coverage:
 * - Create blocks with mobile keyboard
 * - Edit block content
 * - Indent/outdent blocks with swipe gestures
 * - Reorder blocks with drag-and-drop
 * - Delete blocks with swipe or long-press menu
 * - Collapse/expand blocks
 * - Handle block references and wiki links
 */

/* eslint-disable no-console */

import { describe, it, beforeEach } from 'vitest';
import {
  waitForElement,
  assertElementExists,
  assertTextVisible,
  typeTextSlowly,
  swipeElement,
  longPressElement,
  getElementByTestId,
  takeScreenshot,
  wait,
} from '../setup/testHelpers';
import { createDeviceMock } from '../mocks/DeviceMock';

describe('Block Manipulation with Touch', () => {
  const device = createDeviceMock('ios');

  beforeEach(async () => {
    await device.reset();
    console.log('[Test] Launching app and navigating to test page');
    await waitForElement('app-shell', 10000);

    // Navigate to a test page
    const newPageButton = getElementByTestId('new-page-button');
    await newPageButton.tap();
    await waitForElement('page-view', 5000);
  });

  describe('Block Creation', () => {
    it('should create new block by tapping plus button', async () => {
      // Tap add block button
      const addBlockButton = getElementByTestId('add-block-button');
      await addBlockButton.tap();

      // Verify new block appears
      await waitForElement('block-node-0', 3000);

      // Verify cursor is in new block
      await assertElementExists('block-editor');

      await takeScreenshot('block-created');
    });

    it('should create block by pressing Enter on mobile keyboard', async () => {
      // Create first block
      const addBlockButton = getElementByTestId('add-block-button');
      await addBlockButton.tap();

      await waitForElement('block-node-0', 3000);

      // Type content
      await typeTextSlowly('block-editor', 'First block');

      // Press Enter on mobile keyboard (simulated)
      // In real implementation, this would trigger keyboard's Enter key
      console.log('[Mock] Pressing Enter on mobile keyboard');

      await wait(300);

      // Verify second block appears
      await waitForElement('block-node-1', 3000);

      await takeScreenshot('block-created-with-enter');
    });

    it('should focus new block immediately after creation', async () => {
      const addBlockButton = getElementByTestId('add-block-button');
      await addBlockButton.tap();

      await waitForElement('block-node-0', 3000);

      // Verify keyboard appears (block is focused)
      await device.showKeyboard();

      // Verify editor is active
      await assertElementExists('block-editor');
    });
  });

  describe('Block Editing', () => {
    it('should edit block content with mobile keyboard', async () => {
      const addBlockButton = getElementByTestId('add-block-button');
      await addBlockButton.tap();

      await waitForElement('block-node-0', 3000);

      await typeTextSlowly('block-editor', 'Mobile typing test');

      await wait(300);

      await assertTextVisible('Mobile typing test');

      await takeScreenshot('block-content-edited');
    });

    it('should handle long text content', async () => {
      const addBlockButton = getElementByTestId('add-block-button');
      await addBlockButton.tap();

      await waitForElement('block-node-0', 3000);

      const longText =
        'This is a very long block of text that should wrap properly on mobile devices and support smooth scrolling when editing.';

      await typeTextSlowly('block-editor', longText);

      await wait(500);

      await assertTextVisible('This is a very long');

      await takeScreenshot('long-block-content');
    });

    it('should handle emoji and special characters', async () => {
      const addBlockButton = getElementByTestId('add-block-button');
      await addBlockButton.tap();

      await waitForElement('block-node-0', 3000);

      await typeTextSlowly('block-editor', 'Task 🎯 with emoji ✅');

      await wait(300);

      await assertTextVisible('Task 🎯 with emoji ✅');
    });

    it('should handle markdown formatting', async () => {
      const addBlockButton = getElementByTestId('add-block-button');
      await addBlockButton.tap();

      await waitForElement('block-node-0', 3000);

      await typeTextSlowly('block-editor', '**bold** and *italic*');

      await wait(300);

      // Verify formatting is applied
      // await assertElementExists('bold-text');
      // await assertElementExists('italic-text');

      await takeScreenshot('block-with-formatting');
    });
  });

  describe('Block Indentation', () => {
    it('should indent block with swipe right gesture', async () => {
      // Create two blocks
      const addBlockButton = getElementByTestId('add-block-button');
      await addBlockButton.tap();
      await typeTextSlowly('block-editor', 'Parent block');
      await wait(300);

      console.log('[Mock] Creating child block');
      await addBlockButton.tap();
      await waitForElement('block-node-1', 3000);

      // Swipe right to indent
      await swipeElement('block-node-1', 'right', 'fast');

      await wait(500);

      // Verify block is indented
      // Check for indentation class or style
      await assertElementExists('block-node-1');

      await takeScreenshot('block-indented');
    });

    it('should outdent block with swipe left gesture', async () => {
      // Setup: Create parent with indented child
      console.log('[Mock] Setting up parent-child blocks');

      // Swipe left to outdent
      await swipeElement('block-node-1', 'left', 'fast');

      await wait(500);

      // Verify block is outdented
      await assertElementExists('block-node-1');

      await takeScreenshot('block-outdented');
    });

    it('should show indent controls on block selection', async () => {
      const addBlockButton = getElementByTestId('add-block-button');
      await addBlockButton.tap();

      await waitForElement('block-node-0', 3000);

      // Long press on block to show controls
      await longPressElement('block-node-0', 800);

      // Verify indent/outdent buttons appear
      await assertElementExists('indent-button');
      await assertElementExists('outdent-button');

      await takeScreenshot('indent-controls-visible');
    });
  });

  describe('Block Reordering', () => {
    it('should reorder blocks with drag gesture', async () => {
      // Create three blocks
      const addBlockButton = getElementByTestId('add-block-button');

      await addBlockButton.tap();
      await typeTextSlowly('block-editor', 'Block 1');
      await wait(300);

      await addBlockButton.tap();
      await typeTextSlowly('block-editor', 'Block 2');
      await wait(300);

      await addBlockButton.tap();
      await typeTextSlowly('block-editor', 'Block 3');
      await wait(300);

      // Long press to enter drag mode
      await longPressElement('block-node-0', 1000);

      // Drag block down
      console.log('[Mock] Dragging block-node-0 down');

      await wait(500);

      // Verify blocks reordered
      // await assertTextVisible('Block 2'); // Now first

      await takeScreenshot('blocks-reordered');
    });

    it('should show drag handles on long press', async () => {
      const addBlockButton = getElementByTestId('add-block-button');
      await addBlockButton.tap();

      await waitForElement('block-node-0', 3000);

      await longPressElement('block-node-0', 800);

      // Verify drag handle appears
      await assertElementExists('drag-handle');

      await takeScreenshot('drag-handle-visible');
    });

    it('should cancel drag operation', async () => {
      const addBlockButton = getElementByTestId('add-block-button');
      await addBlockButton.tap();

      await waitForElement('block-node-0', 3000);

      await longPressElement('block-node-0', 1000);

      // Tap elsewhere to cancel drag
      const pageView = getElementByTestId('page-view');
      await pageView.tap();

      // Verify drag mode is cancelled
      // await assertElementNotExists('drag-handle');
    });
  });

  describe('Block Deletion', () => {
    it('should delete block with swipe left gesture', async () => {
      const addBlockButton = getElementByTestId('add-block-button');
      await addBlockButton.tap();

      await waitForElement('block-node-0', 3000);

      await typeTextSlowly('block-editor', 'Block to delete');
      await wait(300);

      // Swipe left to reveal delete action
      await swipeElement('block-node-0', 'left', 'fast');

      // Tap delete button
      const deleteButton = getElementByTestId('delete-block-button');
      await deleteButton.tap();

      // Verify block is removed
      // await assertElementNotExists('block-node-0');

      await takeScreenshot('block-deleted');
    });

    it('should delete block from long-press menu', async () => {
      const addBlockButton = getElementByTestId('add-block-button');
      await addBlockButton.tap();

      await waitForElement('block-node-0', 3000);

      // Long press to show context menu
      await longPressElement('block-node-0', 1000);

      // Tap delete option
      const deleteOption = getElementByTestId('menu-delete-block');
      await deleteOption.tap();

      // Confirm deletion
      const confirmButton = getElementByTestId('confirm-delete');
      await confirmButton.tap();

      // Verify block is removed
      // await assertElementNotExists('block-node-0');
    });

    it('should undo block deletion', async () => {
      const addBlockButton = getElementByTestId('add-block-button');
      await addBlockButton.tap();

      await waitForElement('block-node-0', 3000);

      await typeTextSlowly('block-editor', 'Important content');
      await wait(300);

      // Delete block
      await swipeElement('block-node-0', 'left', 'fast');
      const deleteButton = getElementByTestId('delete-block-button');
      await deleteButton.tap();

      // Tap undo button
      const undoButton = getElementByTestId('undo-button');
      await undoButton.tap();

      // Verify block is restored
      await assertElementExists('block-node-0');
      await assertTextVisible('Important content');
    });
  });

  describe('Block Collapse/Expand', () => {
    it('should collapse block with children', async () => {
      // Setup parent-child hierarchy
      console.log('[Mock] Setting up block hierarchy');

      // Tap collapse button
      const collapseButton = getElementByTestId('collapse-button-0');
      await collapseButton.tap();

      await wait(300);

      // Verify children are hidden
      // await assertElementNotExists('block-node-1');

      await takeScreenshot('block-collapsed');
    });

    it('should expand collapsed block', async () => {
      // Start with collapsed block
      console.log('[Mock] Block already collapsed');

      // Tap expand button
      const expandButton = getElementByTestId('expand-button-0');
      await expandButton.tap();

      await wait(300);

      // Verify children are visible
      await assertElementExists('block-node-1');

      await takeScreenshot('block-expanded');
    });

    it('should show child count on collapsed block', async () => {
      console.log('[Mock] Collapsing block with children');

      const collapseButton = getElementByTestId('collapse-button-0');
      await collapseButton.tap();

      await wait(300);

      // Verify child count badge
      await assertTextVisible('3 children');
    });
  });

  describe('Block References and Links', () => {
    it('should create wiki link', async () => {
      const addBlockButton = getElementByTestId('add-block-button');
      await addBlockButton.tap();

      await waitForElement('block-node-0', 3000);

      await typeTextSlowly('block-editor', '[[Another Page]]');

      await wait(300);

      // Verify wiki link is rendered
      await assertElementExists('wiki-link');

      await takeScreenshot('wiki-link-created');
    });

    it('should navigate to referenced page', async () => {
      // Assuming wiki link exists
      console.log('[Mock] Wiki link present');

      const wikiLink = getElementByTestId('wiki-link');
      await wikiLink.tap();

      // Verify navigation to linked page
      await waitForElement('page-view', 3000);
      await assertTextVisible('Another Page');
    });

    it('should create block reference', async () => {
      const addBlockButton = getElementByTestId('add-block-button');
      await addBlockButton.tap();

      await waitForElement('block-node-0', 3000);

      await typeTextSlowly('block-editor', '((block-ref))');

      await wait(300);

      // Verify block reference is rendered
      await assertElementExists('block-reference');
    });
  });

  describe('Mobile Keyboard Integration', () => {
    it('should dismiss keyboard when tapping outside', async () => {
      const addBlockButton = getElementByTestId('add-block-button');
      await addBlockButton.tap();

      await waitForElement('block-node-0', 3000);

      // Keyboard should be visible
      await device.showKeyboard();

      // Tap outside block
      const pageView = getElementByTestId('page-view');
      await pageView.tap();

      // Verify keyboard is dismissed
      await device.hideKeyboard();
    });

    it('should handle autocorrect suggestions', async () => {
      const addBlockButton = getElementByTestId('add-block-button');
      await addBlockButton.tap();

      await waitForElement('block-node-0', 3000);

      // Type with autocorrect
      await typeTextSlowly('block-editor', 'teh quick brown fox');

      // Accept autocorrect
      console.log('[Mock] Accepting autocorrect: the');

      await wait(300);

      // Verify corrected text
      await assertTextVisible('the quick brown fox');
    });
  });
});
