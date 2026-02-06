/**
 * Unit tests for BlockRefAutocomplete component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { BlockRefAutocomplete } from '../../../src/components/BlockRefAutocomplete.js';
import type { BlockRefResult } from '../../../src/editor/plugins/autocomplete.js';

describe('BlockRefAutocomplete', () => {
  beforeEach(() => {
    cleanup();
  });

  const mockResults: BlockRefResult[] = [
    { blockId: 'block1', preview: 'First block content', pageTitle: 'Page One', pageId: 'p1' },
    { blockId: 'block2', preview: 'Second block content', pageTitle: 'Page Two', pageId: 'p2' },
    { blockId: 'block3', preview: 'Third block content', pageTitle: 'Page Three', pageId: 'p3' },
  ];

  // ============================================================================
  // Visibility
  // ============================================================================

  describe('Visibility', () => {
    it('renders nothing when not active', () => {
      const { container } = render(
        <BlockRefAutocomplete
          active={false}
          results={mockResults}
          selectedIndex={0}
          isLoading={false}
          query=""
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it('renders dropdown when active', () => {
      render(
        <BlockRefAutocomplete
          active={true}
          results={mockResults}
          selectedIndex={0}
          isLoading={false}
          query="test"
        />
      );

      expect(screen.getByTestId('block-ref-autocomplete')).toBeDefined();
    });
  });

  // ============================================================================
  // Results Display
  // ============================================================================

  describe('Results Display', () => {
    it('displays all results', () => {
      render(
        <BlockRefAutocomplete
          active={true}
          results={mockResults}
          selectedIndex={0}
          isLoading={false}
          query="block"
        />
      );

      expect(screen.getByText('First block content')).toBeDefined();
      expect(screen.getByText('Second block content')).toBeDefined();
      expect(screen.getByText('Third block content')).toBeDefined();
    });

    it('displays page titles', () => {
      render(
        <BlockRefAutocomplete
          active={true}
          results={mockResults}
          selectedIndex={0}
          isLoading={false}
          query="block"
        />
      );

      expect(screen.getByText('Page One')).toBeDefined();
      expect(screen.getByText('Page Two')).toBeDefined();
      expect(screen.getByText('Page Three')).toBeDefined();
    });

    it('shows "Untitled" for empty page titles', () => {
      const resultsWithEmptyTitle: BlockRefResult[] = [
        { blockId: 'block1', preview: 'Content', pageTitle: '', pageId: 'p1' },
      ];

      render(
        <BlockRefAutocomplete
          active={true}
          results={resultsWithEmptyTitle}
          selectedIndex={0}
          isLoading={false}
          query="test"
        />
      );

      expect(screen.getByText('Untitled')).toBeDefined();
    });
  });

  // ============================================================================
  // Loading State
  // ============================================================================

  describe('Loading State', () => {
    it('shows loading message when isLoading is true', () => {
      render(
        <BlockRefAutocomplete
          active={true}
          results={[]}
          selectedIndex={0}
          isLoading={true}
          query="test"
        />
      );

      expect(screen.getByText('Searching blocks...')).toBeDefined();
    });

    it('does not show loading when isLoading is false', () => {
      render(
        <BlockRefAutocomplete
          active={true}
          results={mockResults}
          selectedIndex={0}
          isLoading={false}
          query="test"
        />
      );

      expect(screen.queryByText('Searching blocks...')).toBeNull();
    });
  });

  // ============================================================================
  // Empty State
  // ============================================================================

  describe('Empty State', () => {
    it('shows empty message when no results and query exists', () => {
      render(
        <BlockRefAutocomplete
          active={true}
          results={[]}
          selectedIndex={0}
          isLoading={false}
          query="nonexistent"
        />
      );

      expect(screen.getByText('No blocks found for "nonexistent"')).toBeDefined();
    });

    it('shows hint when no results and no query', () => {
      render(
        <BlockRefAutocomplete
          active={true}
          results={[]}
          selectedIndex={0}
          isLoading={false}
          query=""
        />
      );

      expect(screen.getByText('Type to search blocks...')).toBeDefined();
    });
  });

  // ============================================================================
  // Selection Highlighting
  // ============================================================================

  describe('Selection Highlighting', () => {
    it('highlights selected item with class', () => {
      render(
        <BlockRefAutocomplete
          active={true}
          results={mockResults}
          selectedIndex={1}
          isLoading={false}
          query="test"
        />
      );

      const items = screen.getAllByRole('option');
      expect(items[0]?.className).not.toContain('selected');
      expect(items[1]?.className).toContain('selected');
      expect(items[2]?.className).not.toContain('selected');
    });

    it('marks selected item with aria-selected', () => {
      render(
        <BlockRefAutocomplete
          active={true}
          results={mockResults}
          selectedIndex={2}
          isLoading={false}
          query="test"
        />
      );

      const items = screen.getAllByRole('option');
      expect(items[0]?.getAttribute('aria-selected')).toBe('false');
      expect(items[1]?.getAttribute('aria-selected')).toBe('false');
      expect(items[2]?.getAttribute('aria-selected')).toBe('true');
    });
  });

  // ============================================================================
  // Interactions
  // ============================================================================

  describe('Interactions', () => {
    it('calls onSelect when item is clicked', () => {
      const onSelect = vi.fn();

      render(
        <BlockRefAutocomplete
          active={true}
          results={mockResults}
          selectedIndex={0}
          isLoading={false}
          query="test"
          onSelect={onSelect}
        />
      );

      fireEvent.click(screen.getByText('Second block content'));

      expect(onSelect).toHaveBeenCalledWith(mockResults[1]);
    });

    it('calls onHover when mouse enters item', () => {
      const onHover = vi.fn();

      render(
        <BlockRefAutocomplete
          active={true}
          results={mockResults}
          selectedIndex={0}
          isLoading={false}
          query="test"
          onHover={onHover}
        />
      );

      fireEvent.mouseEnter(screen.getByTestId('block-ref-autocomplete-item-2'));

      expect(onHover).toHaveBeenCalledWith(2);
    });
  });

  // ============================================================================
  // Accessibility
  // ============================================================================

  describe('Accessibility', () => {
    it('has listbox role', () => {
      render(
        <BlockRefAutocomplete
          active={true}
          results={mockResults}
          selectedIndex={0}
          isLoading={false}
          query="test"
        />
      );

      expect(screen.getByRole('listbox')).toBeDefined();
    });

    it('has accessible label', () => {
      render(
        <BlockRefAutocomplete
          active={true}
          results={mockResults}
          selectedIndex={0}
          isLoading={false}
          query="test"
        />
      );

      expect(screen.getByLabelText('Block reference suggestions')).toBeDefined();
    });

    it('items have option role', () => {
      render(
        <BlockRefAutocomplete
          active={true}
          results={mockResults}
          selectedIndex={0}
          isLoading={false}
          query="test"
        />
      );

      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(3);
    });
  });

  // ============================================================================
  // Keyboard Hints
  // ============================================================================

  describe('Keyboard Hints', () => {
    it('shows keyboard navigation hints', () => {
      render(
        <BlockRefAutocomplete
          active={true}
          results={mockResults}
          selectedIndex={0}
          isLoading={false}
          query="test"
        />
      );

      expect(screen.getByText(/navigate/i)).toBeDefined();
      expect(screen.getByText(/select/i)).toBeDefined();
      expect(screen.getByText(/close/i)).toBeDefined();
    });
  });

  // ============================================================================
  // Custom Props
  // ============================================================================

  describe('Custom Props', () => {
    it('accepts custom className', () => {
      render(
        <BlockRefAutocomplete
          active={true}
          results={mockResults}
          selectedIndex={0}
          isLoading={false}
          query="test"
          className="custom-class"
        />
      );

      expect(screen.getByTestId('block-ref-autocomplete').className).toContain('custom-class');
    });

    it('accepts custom testId', () => {
      render(
        <BlockRefAutocomplete
          active={true}
          results={mockResults}
          selectedIndex={0}
          isLoading={false}
          query="test"
          testId="custom-test-id"
        />
      );

      expect(screen.getByTestId('custom-test-id')).toBeDefined();
    });
  });
});
