/**
 * Tests for HoverPreviewCard component
 *
 * Validates:
 * - Loading skeleton when data is not yet available
 * - Rendered title, excerpt, block count, and relative timestamp
 * - Empty state when page data is null
 * - Fixed positioning at provided x/y coordinates
 * - ARIA role="tooltip"
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { HoverPreviewCard } from '../../../src/components/HoverPreviewCard.js';
import { ServiceProvider, type Services } from '../../../src/providers/ServiceProvider.js';
import type { BlockService, PageService } from '@double-bind/core';
import type { PageId } from '@double-bind/types';

// ============================================================================
// Mocks
// ============================================================================

const MOCK_PAGE_ID = 'page-01HTEST' as PageId;

const MOCK_PREVIEW_DATA = {
  title: 'Test Page',
  excerpt: 'This is the first block of content in the test page.',
  blockCount: 5,
  updatedAt: Date.now() - 60_000, // 1 minute ago
};

// Mock usePagePreview to control data
vi.mock('../../../src/hooks/usePagePreview.js', () => ({
  usePagePreview: vi.fn(),
}));

import { usePagePreview } from '../../../src/hooks/usePagePreview.js';

const mockUsePagePreview = vi.mocked(usePagePreview);

// ============================================================================
// Test wrapper (ServiceProvider optional — usePagePreview is mocked)
// ============================================================================

function wrapper({ children }: { children: ReactNode }) {
  const services: Services = {
    pageService: {} as PageService,
    blockService: {} as BlockService,
  };
  return createElement(ServiceProvider, { services }, children);
}

// ============================================================================
// Tests
// ============================================================================

describe('HoverPreviewCard', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Loading state
  // ==========================================================================

  describe('loading state', () => {
    it('shows skeleton when isLoading=true and data=null', () => {
      mockUsePagePreview.mockReturnValue({ data: null, isLoading: true, error: null });

      render(<HoverPreviewCard pageId={MOCK_PAGE_ID} x={100} y={200} />);

      expect(screen.getByTestId('hover-preview-card-loading')).toBeDefined();
      expect(screen.queryByTestId('hover-preview-card-title')).toBeNull();
    });

    it('does not show skeleton when data is available even if still loading', () => {
      // Stale-while-revalidate: show data immediately
      mockUsePagePreview.mockReturnValue({
        data: MOCK_PREVIEW_DATA,
        isLoading: true,
        error: null,
      });

      render(<HoverPreviewCard pageId={MOCK_PAGE_ID} x={100} y={200} />);

      expect(screen.queryByTestId('hover-preview-card-loading')).toBeNull();
      expect(screen.getByTestId('hover-preview-card-title')).toBeDefined();
    });
  });

  // ==========================================================================
  // Populated state
  // ==========================================================================

  describe('with data', () => {
    beforeEach(() => {
      mockUsePagePreview.mockReturnValue({
        data: MOCK_PREVIEW_DATA,
        isLoading: false,
        error: null,
      });
    });

    it('renders the page title', () => {
      render(<HoverPreviewCard pageId={MOCK_PAGE_ID} x={100} y={200} />);

      expect(screen.getByTestId('hover-preview-card-title').textContent).toBe('Test Page');
    });

    it('renders the excerpt', () => {
      render(<HoverPreviewCard pageId={MOCK_PAGE_ID} x={100} y={200} />);

      const excerpt = screen.getByTestId('hover-preview-card-excerpt');
      expect(excerpt.textContent).toBe(MOCK_PREVIEW_DATA.excerpt);
    });

    it('renders block count with correct label (plural)', () => {
      render(<HoverPreviewCard pageId={MOCK_PAGE_ID} x={100} y={200} />);

      const meta = screen.getByTestId('hover-preview-card-meta');
      expect(meta.textContent).toContain('5 blocks');
    });

    it('renders block count with correct label (singular)', () => {
      mockUsePagePreview.mockReturnValue({
        data: { ...MOCK_PREVIEW_DATA, blockCount: 1 },
        isLoading: false,
        error: null,
      });

      render(<HoverPreviewCard pageId={MOCK_PAGE_ID} x={100} y={200} />);

      const meta = screen.getByTestId('hover-preview-card-meta');
      expect(meta.textContent).toContain('1 block');
      expect(meta.textContent).not.toContain('1 blocks');
    });

    it('renders relative timestamp "just now" for very recent updates', () => {
      mockUsePagePreview.mockReturnValue({
        data: { ...MOCK_PREVIEW_DATA, updatedAt: Date.now() - 5_000 },
        isLoading: false,
        error: null,
      });

      render(<HoverPreviewCard pageId={MOCK_PAGE_ID} x={100} y={200} />);

      const meta = screen.getByTestId('hover-preview-card-meta');
      expect(meta.textContent).toContain('just now');
    });

    it('renders relative timestamp in minutes', () => {
      mockUsePagePreview.mockReturnValue({
        data: { ...MOCK_PREVIEW_DATA, updatedAt: Date.now() - 5 * 60_000 },
        isLoading: false,
        error: null,
      });

      render(<HoverPreviewCard pageId={MOCK_PAGE_ID} x={100} y={200} />);

      const meta = screen.getByTestId('hover-preview-card-meta');
      expect(meta.textContent).toContain('5m ago');
    });

    it('renders a tooltip role for accessibility', () => {
      render(<HoverPreviewCard pageId={MOCK_PAGE_ID} x={100} y={200} />);

      const card = screen.getByTestId('hover-preview-card');
      expect(card.getAttribute('role')).toBe('tooltip');
    });

    it('positions the card at the provided x/y coordinates', () => {
      render(<HoverPreviewCard pageId={MOCK_PAGE_ID} x={150} y={300} />);

      const card = screen.getByTestId('hover-preview-card');
      // Inline styles set via React
      expect(card.style.top).toBe('300px');
      expect(card.style.left).toBe('150px');
    });

    it('shows "Untitled" when title is empty', () => {
      mockUsePagePreview.mockReturnValue({
        data: { ...MOCK_PREVIEW_DATA, title: '' },
        isLoading: false,
        error: null,
      });

      render(<HoverPreviewCard pageId={MOCK_PAGE_ID} x={100} y={200} />);

      const title = screen.getByTestId('hover-preview-card-title');
      expect(title.textContent).toBe('Untitled');
    });

    it('does not render excerpt section when excerpt is empty', () => {
      mockUsePagePreview.mockReturnValue({
        data: { ...MOCK_PREVIEW_DATA, excerpt: '' },
        isLoading: false,
        error: null,
      });

      render(<HoverPreviewCard pageId={MOCK_PAGE_ID} x={100} y={200} />);

      expect(screen.queryByTestId('hover-preview-card-excerpt')).toBeNull();
    });
  });

  // ==========================================================================
  // Empty / null data state
  // ==========================================================================

  describe('empty state', () => {
    it('shows "Page not found" when data is null and not loading', () => {
      mockUsePagePreview.mockReturnValue({ data: null, isLoading: false, error: null });

      render(<HoverPreviewCard pageId={MOCK_PAGE_ID} x={100} y={200} />);

      expect(screen.getByTestId('hover-preview-card-empty')).toBeDefined();
      expect(screen.getByTestId('hover-preview-card-empty').textContent).toContain(
        'Page not found'
      );
    });
  });
});
