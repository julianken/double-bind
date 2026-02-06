/**
 * Tests for SplitPane component
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { SplitPane } from '../../../src/components/SplitPane.js';
import { useAppStore } from '../../../src/stores/ui-store.js';

// ============================================================================
// Test Components
// ============================================================================

function LeftPane() {
  return <div data-testid="left-pane">Left Content</div>;
}

function RightPane() {
  return <div data-testid="right-pane">Right Content</div>;
}

// ============================================================================
// Tests
// ============================================================================

describe('SplitPane', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useAppStore.setState({
      sidebarWidth: 240,
      sidebarOpen: true,
    });
  });

  afterEach(() => {
    // Clean up any styles applied during tests
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  });

  // ============================================================================
  // Basic Rendering
  // ============================================================================

  describe('Basic Rendering', () => {
    it('renders left and right panes', () => {
      render(<SplitPane left={<LeftPane />} right={<RightPane />} />);

      expect(screen.getByTestId('left-pane')).toBeDefined();
      expect(screen.getByTestId('right-pane')).toBeDefined();
    });

    it('renders the draggable divider', () => {
      render(<SplitPane left={<LeftPane />} right={<RightPane />} />);

      expect(screen.getByTestId('split-pane-divider')).toBeDefined();
    });

    it('renders with correct structure', () => {
      render(<SplitPane left={<LeftPane />} right={<RightPane />} />);

      const container = screen.getByTestId('split-pane');
      const leftPane = screen.getByTestId('split-pane-left');
      const divider = screen.getByTestId('split-pane-divider');
      const rightPane = screen.getByTestId('split-pane-right');

      expect(container).toBeDefined();
      expect(leftPane).toBeDefined();
      expect(divider).toBeDefined();
      expect(rightPane).toBeDefined();
    });

    it('applies custom className', () => {
      render(<SplitPane left={<LeftPane />} right={<RightPane />} className="custom-class" />);

      const container = screen.getByTestId('split-pane');
      expect(container.className).toBe('custom-class');
    });
  });

  // ============================================================================
  // Width Props
  // ============================================================================

  describe('Width Props', () => {
    it('uses defaultLeftWidth when provided', () => {
      // Set store to a different value to verify default is used
      useAppStore.setState({ sidebarWidth: 0 });

      render(<SplitPane left={<LeftPane />} right={<RightPane />} defaultLeftWidth={300} />);

      const leftPane = screen.getByTestId('split-pane-left');
      expect(leftPane.style.width).toBe('300px');
    });

    it('uses store width when available', () => {
      useAppStore.setState({ sidebarWidth: 350 });

      render(<SplitPane left={<LeftPane />} right={<RightPane />} defaultLeftWidth={250} />);

      const leftPane = screen.getByTestId('split-pane-left');
      expect(leftPane.style.width).toBe('350px');
    });

    it('falls back to 250px default when no props provided', () => {
      useAppStore.setState({ sidebarWidth: 0 });

      render(<SplitPane left={<LeftPane />} right={<RightPane />} />);

      const leftPane = screen.getByTestId('split-pane-left');
      expect(leftPane.style.width).toBe('250px');
    });
  });

  // ============================================================================
  // Drag Behavior
  // ============================================================================

  describe('Drag Behavior', () => {
    it('starts drag on mousedown on divider', () => {
      render(<SplitPane left={<LeftPane />} right={<RightPane />} />);

      const divider = screen.getByTestId('split-pane-divider');

      act(() => {
        fireEvent.mouseDown(divider, { clientX: 250 });
      });

      // Check that body style is updated (indicator of drag state)
      expect(document.body.style.userSelect).toBe('none');
      expect(document.body.style.cursor).toBe('col-resize');
    });

    it('updates width during drag', () => {
      useAppStore.setState({ sidebarWidth: 250 });

      render(<SplitPane left={<LeftPane />} right={<RightPane />} />);

      const divider = screen.getByTestId('split-pane-divider');

      // Start drag
      act(() => {
        fireEvent.mouseDown(divider, { clientX: 250 });
      });

      // Move mouse
      act(() => {
        fireEvent.mouseMove(document, { clientX: 300 });
      });

      const leftPane = screen.getByTestId('split-pane-left');
      expect(leftPane.style.width).toBe('300px');
    });

    it('ends drag on mouseup', () => {
      render(<SplitPane left={<LeftPane />} right={<RightPane />} />);

      const divider = screen.getByTestId('split-pane-divider');

      // Start drag
      act(() => {
        fireEvent.mouseDown(divider, { clientX: 250 });
      });

      expect(document.body.style.cursor).toBe('col-resize');

      // End drag
      act(() => {
        fireEvent.mouseUp(document);
      });

      expect(document.body.style.cursor).toBe('');
    });

    it('persists width to store during drag', () => {
      useAppStore.setState({ sidebarWidth: 250 });

      render(<SplitPane left={<LeftPane />} right={<RightPane />} />);

      const divider = screen.getByTestId('split-pane-divider');

      // Start drag
      act(() => {
        fireEvent.mouseDown(divider, { clientX: 250 });
      });

      // Move mouse
      act(() => {
        fireEvent.mouseMove(document, { clientX: 300 });
      });

      // Check store was updated
      expect(useAppStore.getState().sidebarWidth).toBe(300);
    });
  });

  // ============================================================================
  // Width Constraints
  // ============================================================================

  describe('Width Constraints', () => {
    it('respects minLeftWidth during drag', () => {
      useAppStore.setState({ sidebarWidth: 250 });

      render(<SplitPane left={<LeftPane />} right={<RightPane />} minLeftWidth={150} />);

      const divider = screen.getByTestId('split-pane-divider');

      // Start drag
      act(() => {
        fireEvent.mouseDown(divider, { clientX: 250 });
      });

      // Try to drag below minimum
      act(() => {
        fireEvent.mouseMove(document, { clientX: 50 });
      });

      const leftPane = screen.getByTestId('split-pane-left');
      expect(leftPane.style.width).toBe('150px');
    });

    it('respects maxLeftWidth during drag', () => {
      useAppStore.setState({ sidebarWidth: 250 });

      render(<SplitPane left={<LeftPane />} right={<RightPane />} maxLeftWidth={400} />);

      const divider = screen.getByTestId('split-pane-divider');

      // Start drag
      act(() => {
        fireEvent.mouseDown(divider, { clientX: 250 });
      });

      // Try to drag above maximum
      act(() => {
        fireEvent.mouseMove(document, { clientX: 500 });
      });

      const leftPane = screen.getByTestId('split-pane-left');
      expect(leftPane.style.width).toBe('400px');
    });

    it('uses default constraints when not provided', () => {
      useAppStore.setState({ sidebarWidth: 250 });

      render(<SplitPane left={<LeftPane />} right={<RightPane />} />);

      const divider = screen.getByTestId('split-pane-divider');

      // Start drag
      act(() => {
        fireEvent.mouseDown(divider, { clientX: 250 });
      });

      // Try to drag below default minimum (150px)
      act(() => {
        fireEvent.mouseMove(document, { clientX: 50 });
      });

      const leftPane = screen.getByTestId('split-pane-left');
      expect(leftPane.style.width).toBe('150px');

      // End drag
      act(() => {
        fireEvent.mouseUp(document);
      });
    });

    it('enforces default max width constraint', () => {
      useAppStore.setState({ sidebarWidth: 450 });

      render(<SplitPane left={<LeftPane />} right={<RightPane />} />);

      const divider = screen.getByTestId('split-pane-divider');

      // Start drag
      act(() => {
        fireEvent.mouseDown(divider, { clientX: 450 });
      });

      // Try to drag above default maximum (500px)
      act(() => {
        fireEvent.mouseMove(document, { clientX: 600 });
      });

      const leftPane = screen.getByTestId('split-pane-left');
      expect(leftPane.style.width).toBe('500px');
    });
  });

  // ============================================================================
  // Accessibility
  // ============================================================================

  describe('Accessibility', () => {
    it('has correct ARIA roles', () => {
      render(<SplitPane left={<LeftPane />} right={<RightPane />} />);

      expect(screen.getByRole('region')).toBeDefined();
      expect(screen.getByRole('separator')).toBeDefined();
      expect(screen.getByRole('complementary')).toBeDefined();
      expect(screen.getByRole('main')).toBeDefined();
    });

    it('divider has correct ARIA attributes', () => {
      useAppStore.setState({ sidebarWidth: 250 });

      render(
        <SplitPane
          left={<LeftPane />}
          right={<RightPane />}
          minLeftWidth={100}
          maxLeftWidth={400}
        />
      );

      const divider = screen.getByRole('separator');
      expect(divider.getAttribute('aria-orientation')).toBe('vertical');
      expect(divider.getAttribute('aria-valuenow')).toBe('250');
      expect(divider.getAttribute('aria-valuemin')).toBe('100');
      expect(divider.getAttribute('aria-valuemax')).toBe('400');
      expect(divider.getAttribute('aria-label')).toBe('Resize sidebar');
      expect(divider.getAttribute('tabindex')).toBe('0');
    });

    it('container has descriptive label', () => {
      render(<SplitPane left={<LeftPane />} right={<RightPane />} />);

      const container = screen.getByRole('region');
      expect(container.getAttribute('aria-label')).toBe('Resizable split pane');
    });
  });

  // ============================================================================
  // Store Integration
  // ============================================================================

  describe('Store Integration', () => {
    it('reads initial width from store', () => {
      useAppStore.setState({ sidebarWidth: 320 });

      render(<SplitPane left={<LeftPane />} right={<RightPane />} />);

      const leftPane = screen.getByTestId('split-pane-left');
      expect(leftPane.style.width).toBe('320px');
    });

    it('updates store when dragging', () => {
      useAppStore.setState({ sidebarWidth: 250 });

      render(<SplitPane left={<LeftPane />} right={<RightPane />} />);

      const divider = screen.getByTestId('split-pane-divider');

      // Drag to new position
      act(() => {
        fireEvent.mouseDown(divider, { clientX: 250 });
      });

      act(() => {
        fireEvent.mouseMove(document, { clientX: 280 });
      });

      expect(useAppStore.getState().sidebarWidth).toBe(280);
    });

    it('respects store updates from external sources', () => {
      useAppStore.setState({ sidebarWidth: 250 });

      const { rerender } = render(<SplitPane left={<LeftPane />} right={<RightPane />} />);

      let leftPane = screen.getByTestId('split-pane-left');
      expect(leftPane.style.width).toBe('250px');

      // External update to store
      act(() => {
        useAppStore.setState({ sidebarWidth: 350 });
      });

      rerender(<SplitPane left={<LeftPane />} right={<RightPane />} />);

      leftPane = screen.getByTestId('split-pane-left');
      expect(leftPane.style.width).toBe('350px');
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('handles rapid drag movements', () => {
      useAppStore.setState({ sidebarWidth: 250 });

      render(<SplitPane left={<LeftPane />} right={<RightPane />} />);

      const divider = screen.getByTestId('split-pane-divider');

      // Start drag
      act(() => {
        fireEvent.mouseDown(divider, { clientX: 250 });
      });

      // Rapid movements
      act(() => {
        fireEvent.mouseMove(document, { clientX: 260 });
        fireEvent.mouseMove(document, { clientX: 270 });
        fireEvent.mouseMove(document, { clientX: 280 });
        fireEvent.mouseMove(document, { clientX: 290 });
        fireEvent.mouseMove(document, { clientX: 300 });
      });

      const leftPane = screen.getByTestId('split-pane-left');
      expect(leftPane.style.width).toBe('300px');
    });

    it('handles drag ending outside window', () => {
      render(<SplitPane left={<LeftPane />} right={<RightPane />} />);

      const divider = screen.getByTestId('split-pane-divider');

      // Start drag
      act(() => {
        fireEvent.mouseDown(divider, { clientX: 250 });
      });

      expect(document.body.style.cursor).toBe('col-resize');

      // Simulate mouseup (as if user released mouse outside window)
      act(() => {
        fireEvent.mouseUp(document);
      });

      expect(document.body.style.cursor).toBe('');
    });

    it('handles multiple consecutive drags', () => {
      useAppStore.setState({ sidebarWidth: 250 });

      render(<SplitPane left={<LeftPane />} right={<RightPane />} />);

      const divider = screen.getByTestId('split-pane-divider');

      // First drag
      act(() => {
        fireEvent.mouseDown(divider, { clientX: 250 });
      });

      act(() => {
        fireEvent.mouseMove(document, { clientX: 300 });
      });

      act(() => {
        fireEvent.mouseUp(document);
      });

      expect(useAppStore.getState().sidebarWidth).toBe(300);

      // Second drag - starting from the new position
      act(() => {
        fireEvent.mouseDown(divider, { clientX: 300 });
      });

      act(() => {
        fireEvent.mouseMove(document, { clientX: 350 });
      });

      act(() => {
        fireEvent.mouseUp(document);
      });

      expect(useAppStore.getState().sidebarWidth).toBe(350);
    });

    it('renders with empty children', () => {
      render(<SplitPane left={null} right={null} />);

      expect(screen.getByTestId('split-pane')).toBeDefined();
      expect(screen.getByTestId('split-pane-left')).toBeDefined();
      expect(screen.getByTestId('split-pane-right')).toBeDefined();
    });

    it('renders with complex children', () => {
      render(
        <SplitPane
          left={
            <div>
              <header>Header</header>
              <nav>Navigation</nav>
              <footer>Footer</footer>
            </div>
          }
          right={
            <div>
              <article>
                <h1>Title</h1>
                <p>Content</p>
              </article>
            </div>
          }
        />
      );

      expect(screen.getByText('Header')).toBeDefined();
      expect(screen.getByText('Navigation')).toBeDefined();
      expect(screen.getByText('Footer')).toBeDefined();
      expect(screen.getByText('Title')).toBeDefined();
      expect(screen.getByText('Content')).toBeDefined();
    });
  });

  // ============================================================================
  // Visual Feedback
  // ============================================================================

  describe('Visual Feedback', () => {
    it('changes cursor during drag', () => {
      render(<SplitPane left={<LeftPane />} right={<RightPane />} />);

      const divider = screen.getByTestId('split-pane-divider');

      expect(document.body.style.cursor).toBe('');

      act(() => {
        fireEvent.mouseDown(divider, { clientX: 250 });
      });

      expect(document.body.style.cursor).toBe('col-resize');

      act(() => {
        fireEvent.mouseUp(document);
      });

      expect(document.body.style.cursor).toBe('');
    });

    it('prevents text selection during drag', () => {
      render(<SplitPane left={<LeftPane />} right={<RightPane />} />);

      const divider = screen.getByTestId('split-pane-divider');

      expect(document.body.style.userSelect).toBe('');

      act(() => {
        fireEvent.mouseDown(divider, { clientX: 250 });
      });

      expect(document.body.style.userSelect).toBe('none');

      act(() => {
        fireEvent.mouseUp(document);
      });

      expect(document.body.style.userSelect).toBe('');
    });

    it('divider has col-resize cursor', () => {
      render(<SplitPane left={<LeftPane />} right={<RightPane />} />);

      const divider = screen.getByTestId('split-pane-divider');
      expect(divider.style.cursor).toBe('col-resize');
    });
  });
});
