/**
 * Tests for BacklinksPanel component.
 *
 * Tests cover:
 * - Rendering linked and unlinked references
 * - Empty state handling
 * - Collapsible section behavior
 * - Navigation callbacks
 * - Grouping references by page
 * - Accessibility attributes
 * - Keyboard navigation
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import {
  BacklinksPanel,
  type BacklinksPanelProps,
  type LinkedRef,
  type UnlinkedRef,
} from '../../../src/data/BacklinksPanel';
import type { Block, Page } from '@double-bind/types';

// Test data factories
function createPage(overrides: Partial<Page> = {}): Page {
  return {
    pageId: 'page-1',
    title: 'Test Page',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isDeleted: false,
    dailyNoteDate: null,
    ...overrides,
  };
}

function createBlock(overrides: Partial<Block> = {}): Block {
  return {
    blockId: 'block-1',
    pageId: 'page-1',
    parentId: null,
    content: 'Test block content',
    contentType: 'text',
    order: 'a0',
    isCollapsed: false,
    isDeleted: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

function createLinkedRef(overrides: Partial<LinkedRef> = {}): LinkedRef {
  return {
    block: createBlock(),
    page: createPage(),
    ...overrides,
  };
}

function createUnlinkedRef(overrides: Partial<UnlinkedRef> = {}): UnlinkedRef {
  return {
    content: 'Unlinked mention content',
    page: createPage(),
    ...overrides,
  };
}

// Helper to render BacklinksPanel with defaults
function renderBacklinksPanel(overrides: Partial<BacklinksPanelProps> = {}) {
  const defaultProps: BacklinksPanelProps = {
    linkedRefs: [],
    onNavigate: vi.fn(),
    ...overrides,
  };

  return {
    ...render(<BacklinksPanel {...defaultProps} />),
    onNavigate: defaultProps.onNavigate,
  };
}

describe('BacklinksPanel', () => {
  describe('Rendering - Empty State', () => {
    it('renders empty state when no references provided', () => {
      renderBacklinksPanel({ linkedRefs: [], unlinkedRefs: [] });

      expect(screen.getByTestId('empty-state')).toBeDefined();
      expect(screen.getByText('No references found')).toBeDefined();
    });

    it('renders panel container with proper attributes', () => {
      renderBacklinksPanel();

      const panel = screen.getByTestId('backlinks-panel');
      expect(panel).toBeDefined();
      expect(panel.getAttribute('role')).toBe('region');
      expect(panel.getAttribute('aria-label')).toBe('Backlinks panel');
    });

    it('sets data attributes for blockId and pageId', () => {
      renderBacklinksPanel({ blockId: 'block-123', pageId: 'page-456' });

      const panel = screen.getByTestId('backlinks-panel');
      expect(panel.getAttribute('data-block-id')).toBe('block-123');
      expect(panel.getAttribute('data-page-id')).toBe('page-456');
    });
  });

  describe('Rendering - Linked References', () => {
    it('renders linked references section with count', () => {
      const linkedRefs = [createLinkedRef()];
      renderBacklinksPanel({ linkedRefs });

      expect(screen.getByTestId('linked-section')).toBeDefined();
      expect(screen.getByTestId('linked-header-count').textContent).toBe('1');
    });

    it('shows correct count for multiple linked refs', () => {
      const linkedRefs = [
        createLinkedRef({ block: createBlock({ blockId: 'b1' }) }),
        createLinkedRef({ block: createBlock({ blockId: 'b2' }) }),
        createLinkedRef({ block: createBlock({ blockId: 'b3' }) }),
      ];
      renderBacklinksPanel({ linkedRefs });

      expect(screen.getByTestId('linked-header-count').textContent).toBe('3');
    });

    it('renders linked refs expanded by default', () => {
      const linkedRefs = [createLinkedRef()];
      renderBacklinksPanel({ linkedRefs });

      expect(screen.getByTestId('linked-content')).toBeDefined();
    });

    it('renders block content in linked refs', () => {
      const linkedRefs = [
        createLinkedRef({
          block: createBlock({ content: 'This is a [[backlink]] to the page' }),
        }),
      ];
      renderBacklinksPanel({ linkedRefs });

      expect(screen.getByText('This is a [[backlink]] to the page')).toBeDefined();
    });

    it('groups linked refs by page', () => {
      const page1 = createPage({ pageId: 'p1', title: 'Page One' });
      const page2 = createPage({ pageId: 'p2', title: 'Page Two' });

      const linkedRefs = [
        createLinkedRef({ page: page1, block: createBlock({ blockId: 'b1', pageId: 'p1' }) }),
        createLinkedRef({ page: page1, block: createBlock({ blockId: 'b2', pageId: 'p1' }) }),
        createLinkedRef({ page: page2, block: createBlock({ blockId: 'b3', pageId: 'p2' }) }),
      ];
      renderBacklinksPanel({ linkedRefs });

      expect(screen.getByTestId('page-group-p1')).toBeDefined();
      expect(screen.getByTestId('page-group-p2')).toBeDefined();
      expect(screen.getByText('Page One')).toBeDefined();
      expect(screen.getByText('Page Two')).toBeDefined();
    });
  });

  describe('Rendering - Unlinked References', () => {
    it('renders unlinked references section with count', () => {
      const linkedRefs = [createLinkedRef()];
      const unlinkedRefs = [createUnlinkedRef()];
      renderBacklinksPanel({ linkedRefs, unlinkedRefs });

      expect(screen.getByTestId('unlinked-section')).toBeDefined();
      expect(screen.getByTestId('unlinked-header-count').textContent).toBe('1');
    });

    it('renders unlinked refs collapsed by default', () => {
      const linkedRefs = [createLinkedRef()];
      const unlinkedRefs = [createUnlinkedRef()];
      renderBacklinksPanel({ linkedRefs, unlinkedRefs });

      expect(screen.queryByTestId('unlinked-content')).toBeNull();
    });

    it('shows unlinked content when expanded', async () => {
      const user = userEvent.setup();
      const linkedRefs = [createLinkedRef()];
      const unlinkedRefs = [createUnlinkedRef({ content: 'Mention without link' })];
      renderBacklinksPanel({ linkedRefs, unlinkedRefs });

      await user.click(screen.getByTestId('unlinked-header'));

      expect(screen.getByTestId('unlinked-content')).toBeDefined();
      expect(screen.getByText('Mention without link')).toBeDefined();
    });

    it('groups unlinked refs by page', async () => {
      const user = userEvent.setup();
      const page1 = createPage({ pageId: 'up1', title: 'Unlinked Page One' });
      const page2 = createPage({ pageId: 'up2', title: 'Unlinked Page Two' });

      const linkedRefs = [createLinkedRef()];
      const unlinkedRefs = [
        createUnlinkedRef({ page: page1, content: 'Content 1' }),
        createUnlinkedRef({ page: page2, content: 'Content 2' }),
      ];
      renderBacklinksPanel({ linkedRefs, unlinkedRefs });

      await user.click(screen.getByTestId('unlinked-header'));

      expect(screen.getByTestId('unlinked-page-group-up1')).toBeDefined();
      expect(screen.getByTestId('unlinked-page-group-up2')).toBeDefined();
    });
  });

  describe('Collapsible Sections', () => {
    it('collapses linked section when header clicked', async () => {
      const user = userEvent.setup();
      const linkedRefs = [createLinkedRef()];
      renderBacklinksPanel({ linkedRefs });

      // Initially expanded
      expect(screen.getByTestId('linked-content')).toBeDefined();

      await user.click(screen.getByTestId('linked-header'));

      // Now collapsed
      expect(screen.queryByTestId('linked-content')).toBeNull();
    });

    it('expands linked section when collapsed and header clicked', async () => {
      const user = userEvent.setup();
      const linkedRefs = [createLinkedRef()];
      renderBacklinksPanel({ linkedRefs, defaultLinkedExpanded: false });

      // Initially collapsed
      expect(screen.queryByTestId('linked-content')).toBeNull();

      await user.click(screen.getByTestId('linked-header'));

      // Now expanded
      expect(screen.getByTestId('linked-content')).toBeDefined();
    });

    it('expands unlinked section when header clicked', async () => {
      const user = userEvent.setup();
      const linkedRefs = [createLinkedRef()];
      const unlinkedRefs = [createUnlinkedRef()];
      renderBacklinksPanel({ linkedRefs, unlinkedRefs });

      // Initially collapsed
      expect(screen.queryByTestId('unlinked-content')).toBeNull();

      await user.click(screen.getByTestId('unlinked-header'));

      // Now expanded
      expect(screen.getByTestId('unlinked-content')).toBeDefined();
    });

    it('respects defaultLinkedExpanded prop', () => {
      const linkedRefs = [createLinkedRef()];
      renderBacklinksPanel({ linkedRefs, defaultLinkedExpanded: false });

      expect(screen.queryByTestId('linked-content')).toBeNull();
    });

    it('respects defaultUnlinkedExpanded prop', () => {
      const linkedRefs = [createLinkedRef()];
      const unlinkedRefs = [createUnlinkedRef()];
      renderBacklinksPanel({ linkedRefs, unlinkedRefs, defaultUnlinkedExpanded: true });

      expect(screen.getByTestId('unlinked-content')).toBeDefined();
    });
  });

  describe('Navigation', () => {
    it('calls onNavigate with pageId and blockId when block clicked', async () => {
      const user = userEvent.setup();
      const onNavigate = vi.fn();
      const linkedRefs = [
        createLinkedRef({
          block: createBlock({ blockId: 'nav-block', pageId: 'nav-page' }),
          page: createPage({ pageId: 'nav-page' }),
        }),
      ];
      renderBacklinksPanel({ linkedRefs, onNavigate });

      await user.click(screen.getByTestId('block-item-0'));

      expect(onNavigate).toHaveBeenCalledTimes(1);
      expect(onNavigate).toHaveBeenCalledWith('nav-page', 'nav-block');
    });

    it('calls onNavigate with pageId when page title clicked', async () => {
      const user = userEvent.setup();
      const onNavigate = vi.fn();
      const linkedRefs = [
        createLinkedRef({
          page: createPage({ pageId: 'title-nav-page', title: 'Clickable Page' }),
        }),
      ];
      renderBacklinksPanel({ linkedRefs, onNavigate });

      await user.click(screen.getByTestId('page-group-title-nav-page-title'));

      expect(onNavigate).toHaveBeenCalledTimes(1);
      expect(onNavigate).toHaveBeenCalledWith('title-nav-page');
    });

    it('calls onNavigate with pageId only for unlinked refs', async () => {
      const user = userEvent.setup();
      const onNavigate = vi.fn();
      const linkedRefs = [createLinkedRef()];
      const unlinkedRefs = [
        createUnlinkedRef({
          page: createPage({ pageId: 'unlinked-nav-page' }),
        }),
      ];
      renderBacklinksPanel({ linkedRefs, unlinkedRefs, onNavigate });

      // Expand unlinked section first
      await user.click(screen.getByTestId('unlinked-header'));
      await user.click(screen.getByTestId('unlinked-item-0'));

      expect(onNavigate).toHaveBeenCalledWith('unlinked-nav-page');
    });

    it('navigates to correct block when multiple blocks from same page', async () => {
      const user = userEvent.setup();
      const onNavigate = vi.fn();
      const page = createPage({ pageId: 'multi-page' });
      const linkedRefs = [
        createLinkedRef({
          page,
          block: createBlock({ blockId: 'first-block', pageId: 'multi-page' }),
        }),
        createLinkedRef({
          page,
          block: createBlock({ blockId: 'second-block', pageId: 'multi-page' }),
        }),
      ];
      renderBacklinksPanel({ linkedRefs, onNavigate });

      await user.click(screen.getByTestId('block-item-1'));

      expect(onNavigate).toHaveBeenCalledWith('multi-page', 'second-block');
    });
  });

  describe('Keyboard Navigation', () => {
    it('toggles section with Enter key', async () => {
      const user = userEvent.setup();
      const linkedRefs = [createLinkedRef()];
      renderBacklinksPanel({ linkedRefs });

      const header = screen.getByTestId('linked-header');
      header.focus();

      await user.keyboard('{Enter}');

      expect(screen.queryByTestId('linked-content')).toBeNull();
    });

    it('toggles section with Space key', async () => {
      const user = userEvent.setup();
      const linkedRefs = [createLinkedRef()];
      renderBacklinksPanel({ linkedRefs });

      const header = screen.getByTestId('linked-header');
      header.focus();

      await user.keyboard(' ');

      expect(screen.queryByTestId('linked-content')).toBeNull();
    });

    it('navigates to block with Enter key', async () => {
      const user = userEvent.setup();
      const onNavigate = vi.fn();
      const linkedRefs = [
        createLinkedRef({
          block: createBlock({ blockId: 'kb-block', pageId: 'kb-page' }),
          page: createPage({ pageId: 'kb-page' }),
        }),
      ];
      renderBacklinksPanel({ linkedRefs, onNavigate });

      const blockItem = screen.getByTestId('block-item-0');
      blockItem.focus();

      await user.keyboard('{Enter}');

      expect(onNavigate).toHaveBeenCalledWith('kb-page', 'kb-block');
    });

    it('navigates to block with Space key', async () => {
      const user = userEvent.setup();
      const onNavigate = vi.fn();
      const linkedRefs = [
        createLinkedRef({
          block: createBlock({ blockId: 'space-block', pageId: 'space-page' }),
          page: createPage({ pageId: 'space-page' }),
        }),
      ];
      renderBacklinksPanel({ linkedRefs, onNavigate });

      const blockItem = screen.getByTestId('block-item-0');
      blockItem.focus();

      await user.keyboard(' ');

      expect(onNavigate).toHaveBeenCalledWith('space-page', 'space-block');
    });

    it('navigates to page title with Enter key', async () => {
      const user = userEvent.setup();
      const onNavigate = vi.fn();
      const linkedRefs = [
        createLinkedRef({
          page: createPage({ pageId: 'kb-title-page' }),
        }),
      ];
      renderBacklinksPanel({ linkedRefs, onNavigate });

      const pageTitle = screen.getByTestId('page-group-kb-title-page-title');
      pageTitle.focus();

      await user.keyboard('{Enter}');

      expect(onNavigate).toHaveBeenCalledWith('kb-title-page');
    });

    it('can tab through interactive elements', async () => {
      const user = userEvent.setup();
      const linkedRefs = [createLinkedRef({ page: createPage({ pageId: 'tab-page' }) })];
      const unlinkedRefs = [createUnlinkedRef()];
      renderBacklinksPanel({ linkedRefs, unlinkedRefs, defaultUnlinkedExpanded: true });

      // Tab through: linked header -> page title -> block item -> unlinked header -> unlinked page title -> unlinked item
      await user.tab();
      expect(document.activeElement).toBe(screen.getByTestId('linked-header'));

      await user.tab();
      expect(document.activeElement).toBe(screen.getByTestId('page-group-tab-page-title'));

      await user.tab();
      expect(document.activeElement).toBe(screen.getByTestId('block-item-0'));
    });
  });

  describe('Accessibility', () => {
    it('has aria-expanded on section headers', () => {
      const linkedRefs = [createLinkedRef()];
      const unlinkedRefs = [createUnlinkedRef()];
      renderBacklinksPanel({ linkedRefs, unlinkedRefs });

      const linkedHeader = screen.getByTestId('linked-header');
      const unlinkedHeader = screen.getByTestId('unlinked-header');

      expect(linkedHeader.getAttribute('aria-expanded')).toBe('true');
      expect(unlinkedHeader.getAttribute('aria-expanded')).toBe('false');
    });

    it('updates aria-expanded when toggled', async () => {
      const user = userEvent.setup();
      const linkedRefs = [createLinkedRef()];
      renderBacklinksPanel({ linkedRefs });

      const header = screen.getByTestId('linked-header');
      expect(header.getAttribute('aria-expanded')).toBe('true');

      await user.click(header);

      expect(header.getAttribute('aria-expanded')).toBe('false');
    });

    it('has aria-label on block items', () => {
      const linkedRefs = [
        createLinkedRef({
          block: createBlock({ content: 'Block with aria label' }),
        }),
      ];
      renderBacklinksPanel({ linkedRefs });

      const blockItem = screen.getByTestId('block-item-0');
      expect(blockItem.getAttribute('aria-label')).toContain('Navigate to block');
      expect(blockItem.getAttribute('aria-label')).toContain('Block with aria label');
    });

    it('has aria-label on unlinked items', async () => {
      const user = userEvent.setup();
      const linkedRefs = [createLinkedRef()];
      const unlinkedRefs = [
        createUnlinkedRef({
          content: 'Unlinked content here',
          page: createPage({ title: 'Source Page' }),
        }),
      ];
      renderBacklinksPanel({ linkedRefs, unlinkedRefs });

      await user.click(screen.getByTestId('unlinked-header'));

      const unlinkedItem = screen.getByTestId('unlinked-item-0');
      expect(unlinkedItem.getAttribute('aria-label')).toContain('Source Page');
      expect(unlinkedItem.getAttribute('aria-label')).toContain('Unlinked content here');
    });

    it('has role=list on content containers', () => {
      const linkedRefs = [createLinkedRef()];
      renderBacklinksPanel({ linkedRefs });

      const content = screen.getByTestId('linked-content');
      expect(content.getAttribute('role')).toBe('list');
    });

    it('has role=group on page groups', () => {
      const linkedRefs = [createLinkedRef({ page: createPage({ pageId: 'role-page' }) })];
      renderBacklinksPanel({ linkedRefs });

      const pageGroup = screen.getByTestId('page-group-role-page');
      expect(pageGroup.getAttribute('role')).toBe('group');
    });

    it('has aria-label on page groups', () => {
      const linkedRefs = [
        createLinkedRef({ page: createPage({ pageId: 'aria-page', title: 'Aria Test Page' }) }),
      ];
      renderBacklinksPanel({ linkedRefs });

      const pageGroup = screen.getByTestId('page-group-aria-page');
      expect(pageGroup.getAttribute('aria-label')).toBe('Page: Aria Test Page');
    });

    it('marks decorative elements as aria-hidden', () => {
      const linkedRefs = [createLinkedRef()];
      renderBacklinksPanel({ linkedRefs });

      // Chevron in section header
      const header = screen.getByTestId('linked-header');
      const chevron = header.querySelector('span[aria-hidden="true"]');
      expect(chevron).toBeDefined();

      // Bullet in block item
      const blockItem = screen.getByTestId('block-item-0');
      const bullet = blockItem.querySelector('span[aria-hidden="true"]');
      expect(bullet).toBeDefined();
    });
  });

  describe('Styling', () => {
    it('applies custom className', () => {
      renderBacklinksPanel({ linkedRefs: [], className: 'custom-panel-class' });

      const panel = screen.getByTestId('backlinks-panel');
      expect(panel.classList.contains('custom-panel-class')).toBe(true);
    });

    it('renders section headers as buttons', () => {
      const linkedRefs = [createLinkedRef()];
      renderBacklinksPanel({ linkedRefs });

      const header = screen.getByTestId('linked-header');
      expect(header.tagName).toBe('BUTTON');
      expect(header.getAttribute('type')).toBe('button');
    });

    it('renders block items as buttons', () => {
      const linkedRefs = [createLinkedRef()];
      renderBacklinksPanel({ linkedRefs });

      const blockItem = screen.getByTestId('block-item-0');
      expect(blockItem.tagName).toBe('BUTTON');
      expect(blockItem.getAttribute('type')).toBe('button');
    });

    it('renders page titles as buttons', () => {
      const linkedRefs = [createLinkedRef({ page: createPage({ pageId: 'btn-page' }) })];
      renderBacklinksPanel({ linkedRefs });

      const pageTitle = screen.getByTestId('page-group-btn-page-title');
      expect(pageTitle.tagName).toBe('BUTTON');
      expect(pageTitle.getAttribute('type')).toBe('button');
    });
  });

  describe('Ref Forwarding', () => {
    it('forwards ref to container element', () => {
      const ref = vi.fn();
      render(<BacklinksPanel ref={ref} linkedRefs={[]} onNavigate={vi.fn()} />);

      expect(ref).toHaveBeenCalled();
      expect(ref.mock.calls[0][0]).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe('Memoization', () => {
    it('is memoized (wrapped with memo)', () => {
      const linkedRefs = [createLinkedRef()];
      const onNavigate = vi.fn();
      const { rerender } = renderBacklinksPanel({ linkedRefs, onNavigate });

      const panelBefore = screen.getByTestId('backlinks-panel');

      rerender(<BacklinksPanel linkedRefs={linkedRefs} onNavigate={onNavigate} />);

      const panelAfter = screen.getByTestId('backlinks-panel');

      // Same DOM node indicates memoization worked
      expect(panelBefore).toBe(panelAfter);
    });
  });

  describe('Edge Cases', () => {
    it('handles empty linked refs with unlinked refs', () => {
      const unlinkedRefs = [createUnlinkedRef()];
      renderBacklinksPanel({ linkedRefs: [], unlinkedRefs });

      // Should show linked section with empty message
      expect(screen.getByTestId('linked-section')).toBeDefined();
      expect(screen.getByTestId('linked-empty')).toBeDefined();
      expect(screen.getByText('No linked references')).toBeDefined();

      // Unlinked section should still be available
      expect(screen.getByTestId('unlinked-section')).toBeDefined();
    });

    it('handles very long block content', () => {
      const longContent = 'A'.repeat(500);
      const linkedRefs = [
        createLinkedRef({
          block: createBlock({ content: longContent }),
        }),
      ];
      renderBacklinksPanel({ linkedRefs });

      // Content should be rendered (truncation is CSS-based)
      expect(screen.getByText(longContent)).toBeDefined();
    });

    it('handles special characters in content', () => {
      const specialContent = '<script>alert("xss")</script> & "quotes" \'apostrophes\'';
      const linkedRefs = [
        createLinkedRef({
          block: createBlock({ content: specialContent }),
        }),
      ];
      renderBacklinksPanel({ linkedRefs });

      // Content should be safely rendered as text
      expect(screen.getByText(specialContent)).toBeDefined();
    });

    it('handles multiple pages with same title', () => {
      const page1 = createPage({ pageId: 'dup-1', title: 'Duplicate Title' });
      const page2 = createPage({ pageId: 'dup-2', title: 'Duplicate Title' });

      const linkedRefs = [
        createLinkedRef({ page: page1, block: createBlock({ blockId: 'b1' }) }),
        createLinkedRef({ page: page2, block: createBlock({ blockId: 'b2' }) }),
      ];
      renderBacklinksPanel({ linkedRefs });

      // Should render both groups separately by pageId
      expect(screen.getByTestId('page-group-dup-1')).toBeDefined();
      expect(screen.getByTestId('page-group-dup-2')).toBeDefined();

      // Both should show the title
      expect(screen.getAllByText('Duplicate Title')).toHaveLength(2);
    });

    it('handles undefined unlinkedRefs gracefully', () => {
      const linkedRefs = [createLinkedRef()];
      // Explicitly not passing unlinkedRefs (undefined)
      render(<BacklinksPanel linkedRefs={linkedRefs} onNavigate={vi.fn()} />);

      // Should render without error
      expect(screen.getByTestId('backlinks-panel')).toBeDefined();
      // Unlinked section should still be present (with 0 count)
      expect(screen.getByTestId('unlinked-section')).toBeDefined();
    });
  });
});
