/**
 * Tests for GraphDetailPanel component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { GraphDetailPanel } from '../../../../src/components/graph/GraphDetailPanel';
import type { MobileGraphEdge } from '../../../../src/components/graph/types';

describe('GraphDetailPanel', () => {
  const mockOnOpenPage = vi.fn();
  const mockOnDismiss = vi.fn();

  const defaultProps = {
    pageId: 'page-1',
    pageTitle: 'Test Page',
    edges: [] as MobileGraphEdge[],
    visible: true,
    onOpenPage: mockOnOpenPage,
    onDismiss: mockOnDismiss,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render when visible', () => {
      render(<GraphDetailPanel {...defaultProps} />);

      expect(screen.getByText('Test Page')).toBeTruthy();
      expect(screen.getByText('Open Page')).toBeTruthy();
    });

    it('should not render when not visible', () => {
      render(<GraphDetailPanel {...defaultProps} visible={false} />);

      expect(screen.queryByText('Test Page')).toBeNull();
    });

    it('should display page title', () => {
      render(<GraphDetailPanel {...defaultProps} pageTitle="My Amazing Page" />);

      expect(screen.getByText('My Amazing Page')).toBeTruthy();
    });

    it('should truncate long titles', () => {
      const longTitle = 'A'.repeat(100);
      render(<GraphDetailPanel {...defaultProps} pageTitle={longTitle} />);

      const titleElement = screen.getByText(longTitle);
      expect(titleElement.props.numberOfLines).toBe(2);
    });
  });

  describe('connection counts', () => {
    it('should show zero connections when no edges', () => {
      render(<GraphDetailPanel {...defaultProps} edges={[]} />);

      expect(screen.getByText('0')).toBeTruthy(); // Multiple zeros for in/out/total
      expect(screen.getByText('Incoming')).toBeTruthy();
      expect(screen.getByText('Outgoing')).toBeTruthy();
      expect(screen.getByText('Total Links')).toBeTruthy();
    });

    it('should count incoming links correctly', () => {
      const edges: MobileGraphEdge[] = [
        { source: 'page-2', target: 'page-1' },
        { source: 'page-3', target: 'page-1' },
      ];

      render(<GraphDetailPanel {...defaultProps} pageId="page-1" edges={edges} />);

      const statValues = screen.getAllByText(/^[0-9]+$/);
      // First number should be incoming count (2)
      expect(statValues[0].props.children).toBe(2);
    });

    it('should count outgoing links correctly', () => {
      const edges: MobileGraphEdge[] = [
        { source: 'page-1', target: 'page-2' },
        { source: 'page-1', target: 'page-3' },
        { source: 'page-1', target: 'page-4' },
      ];

      render(<GraphDetailPanel {...defaultProps} pageId="page-1" edges={edges} />);

      const statValues = screen.getAllByText(/^[0-9]+$/);
      // Second number should be outgoing count (3)
      expect(statValues[1].props.children).toBe(3);
    });

    it('should count bidirectional links correctly', () => {
      const edges: MobileGraphEdge[] = [
        { source: 'page-1', target: 'page-2' }, // Outgoing
        { source: 'page-3', target: 'page-1' }, // Incoming
        { source: 'page-1', target: 'page-4', isBidirectional: true }, // Bidirectional
      ];

      render(<GraphDetailPanel {...defaultProps} pageId="page-1" edges={edges} />);

      const statValues = screen.getAllByText(/^[0-9]+$/);
      // Incoming: 1, Outgoing: 2, Total: 3
      expect(statValues[0].props.children).toBe(1); // Incoming
      expect(statValues[1].props.children).toBe(2); // Outgoing
      expect(statValues[2].props.children).toBe(3); // Total
    });

    it('should calculate total links correctly', () => {
      const edges: MobileGraphEdge[] = [
        { source: 'page-1', target: 'page-2' },
        { source: 'page-2', target: 'page-1' },
        { source: 'page-3', target: 'page-1' },
      ];

      render(<GraphDetailPanel {...defaultProps} pageId="page-1" edges={edges} />);

      const statValues = screen.getAllByText(/^[0-9]+$/);
      // Total should be 3 (1 outgoing + 2 incoming)
      expect(statValues[2].props.children).toBe(3);
    });
  });

  describe('interactions', () => {
    it('should call onOpenPage when Open Page button is pressed', () => {
      render(<GraphDetailPanel {...defaultProps} />);

      const openButton = screen.getByText('Open Page');
      fireEvent.press(openButton);

      expect(mockOnOpenPage).toHaveBeenCalledWith('page-1');
      expect(mockOnOpenPage).toHaveBeenCalledTimes(1);
    });

    it('should call onDismiss when backdrop is pressed', () => {
      render(<GraphDetailPanel {...defaultProps} testID="detail-panel" />);

      const backdrop = screen.getByTestId('detail-panel-backdrop');
      fireEvent.press(backdrop);

      expect(mockOnDismiss).toHaveBeenCalledTimes(1);
    });

    it('should have correct accessibility labels', () => {
      render(<GraphDetailPanel {...defaultProps} pageTitle="My Page" />);

      const panel = screen.getByLabelText('Details for My Page');
      expect(panel).toBeTruthy();

      const openButton = screen.getByLabelText('Open My Page');
      expect(openButton).toBeTruthy();
    });

    it('should have proper accessibility roles', () => {
      render(<GraphDetailPanel {...defaultProps} />);

      const panel = screen.getByLabelText(/Details for/);
      expect(panel.props.accessibilityRole).toBe('button');

      const openButton = screen.getByText('Open Page').parent;
      expect(openButton?.props.accessibilityRole).toBe('button');
    });
  });

  describe('testID prop', () => {
    it('should apply testID to panel', () => {
      render(<GraphDetailPanel {...defaultProps} testID="test-panel" />);

      expect(screen.getByTestId('test-panel')).toBeTruthy();
    });

    it('should apply testID to backdrop', () => {
      render(<GraphDetailPanel {...defaultProps} testID="test-panel" />);

      expect(screen.getByTestId('test-panel-backdrop')).toBeTruthy();
    });

    it('should apply testID to open button', () => {
      render(<GraphDetailPanel {...defaultProps} testID="test-panel" />);

      expect(screen.getByTestId('test-panel-open-button')).toBeTruthy();
    });
  });

  describe('edge cases', () => {
    it('should handle page with only self-references', () => {
      const edges: MobileGraphEdge[] = [
        { source: 'page-1', target: 'page-1' }, // Self-reference
      ];

      render(<GraphDetailPanel {...defaultProps} pageId="page-1" edges={edges} />);

      const statValues = screen.getAllByText(/^[0-9]+$/);
      // Self-reference counts as both incoming and outgoing
      expect(statValues[0].props.children).toBe(1); // Incoming
      expect(statValues[1].props.children).toBe(1); // Outgoing
      expect(statValues[2].props.children).toBe(2); // Total
    });

    it('should handle empty page title', () => {
      render(<GraphDetailPanel {...defaultProps} pageTitle="" />);

      // Should still render the component even with empty title
      expect(screen.getByText('Open Page')).toBeTruthy();
    });

    it('should handle very large connection counts', () => {
      const edges: MobileGraphEdge[] = [];
      // Create 1000 incoming links
      for (let i = 0; i < 1000; i++) {
        edges.push({ source: `page-${i}`, target: 'page-1' });
      }

      render(<GraphDetailPanel {...defaultProps} pageId="page-1" edges={edges} />);

      const statValues = screen.getAllByText(/^[0-9]+$/);
      expect(statValues[0].props.children).toBe(1000);
    });
  });
});
