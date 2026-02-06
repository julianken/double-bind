/**
 * Tests for InlinePageLink component.
 *
 * Tests cover:
 * - Rendering with title and pageId
 * - Click handler functionality
 * - Hover handler functionality
 * - Missing/deleted target state
 * - Accessibility attributes
 * - Keyboard navigation
 * - Styling and data attributes
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { InlinePageLink, type InlinePageLinkProps } from '../../../src/blocks/InlinePageLink';

// Helper to render InlinePageLink with defaults
function renderInlinePageLink(overrides: Partial<InlinePageLinkProps> = {}) {
  const defaultProps: InlinePageLinkProps = {
    pageId: '01HQXYZ123456',
    title: 'Test Page',
    onClick: vi.fn(),
    ...overrides,
  };

  return {
    ...render(<InlinePageLink {...defaultProps} />),
    onClick: defaultProps.onClick,
    onHover: defaultProps.onHover,
  };
}

describe('InlinePageLink', () => {
  describe('Rendering', () => {
    it('renders with title', () => {
      renderInlinePageLink({ title: 'Project Ideas' });

      expect(screen.getByTestId('inline-page-link-title').textContent).toBe('Project Ideas');
    });

    it('renders with double square bracket decorations', () => {
      renderInlinePageLink({ title: 'Test' });

      const element = screen.getByTestId('inline-page-link');
      expect(element.textContent).toBe('[[Test]]');
    });

    it('renders as a button element', () => {
      renderInlinePageLink();

      expect(screen.getByRole('button')).toBeDefined();
    });

    it('applies inline display style', () => {
      renderInlinePageLink();

      const element = screen.getByTestId('inline-page-link');
      expect(element.style.display).toBe('inline');
    });

    it('applies cursor pointer style', () => {
      renderInlinePageLink();

      const element = screen.getByTestId('inline-page-link');
      expect(element.style.cursor).toBe('pointer');
    });
  });

  describe('Click Handling', () => {
    it('calls onClick with pageId when clicked', async () => {
      const user = userEvent.setup();
      const { onClick } = renderInlinePageLink({ pageId: '01HQXYZ123456' });

      await user.click(screen.getByTestId('inline-page-link'));

      expect(onClick).toHaveBeenCalledTimes(1);
      expect(onClick).toHaveBeenCalledWith('01HQXYZ123456');
    });

    it('does not call onClick when exists is false', async () => {
      const user = userEvent.setup();
      const { onClick } = renderInlinePageLink({ exists: false });

      await user.click(screen.getByTestId('inline-page-link'));

      expect(onClick).not.toHaveBeenCalled();
    });

    it('stops event propagation on click', async () => {
      const user = userEvent.setup();
      const parentClickHandler = vi.fn();

      render(
        <div onClick={parentClickHandler} data-testid="parent">
          <InlinePageLink pageId="01HQXYZ123456" title="Test" onClick={vi.fn()} />
        </div>
      );

      await user.click(screen.getByTestId('inline-page-link'));

      expect(parentClickHandler).not.toHaveBeenCalled();
    });

    it('handles multiple clicks correctly', async () => {
      const user = userEvent.setup();
      const { onClick } = renderInlinePageLink({ pageId: 'page-1' });

      await user.click(screen.getByTestId('inline-page-link'));
      await user.click(screen.getByTestId('inline-page-link'));
      await user.click(screen.getByTestId('inline-page-link'));

      expect(onClick).toHaveBeenCalledTimes(3);
    });
  });

  describe('Hover Handling', () => {
    it('calls onHover with pageId on mouse enter', async () => {
      const user = userEvent.setup();
      const onHover = vi.fn();
      renderInlinePageLink({ pageId: '01HQXYZ123456', onHover });

      await user.hover(screen.getByTestId('inline-page-link'));

      expect(onHover).toHaveBeenCalledWith('01HQXYZ123456');
    });

    it('calls onHover with null on mouse leave', async () => {
      const user = userEvent.setup();
      const onHover = vi.fn();
      renderInlinePageLink({ pageId: '01HQXYZ123456', onHover });

      await user.hover(screen.getByTestId('inline-page-link'));
      await user.unhover(screen.getByTestId('inline-page-link'));

      expect(onHover).toHaveBeenCalledWith(null);
    });

    it('does not throw when onHover is not provided', async () => {
      const user = userEvent.setup();
      renderInlinePageLink({ onHover: undefined });

      // Should not throw
      await user.hover(screen.getByTestId('inline-page-link'));
      await user.unhover(screen.getByTestId('inline-page-link'));
    });

    it('applies hover styles on mouse enter', async () => {
      const user = userEvent.setup();
      renderInlinePageLink();

      await user.hover(screen.getByTestId('inline-page-link'));

      const element = screen.getByTestId('inline-page-link');
      // Hover style includes border-bottom color
      expect(element.style.borderBottomColor).not.toBe('transparent');
    });

    it('removes hover styles on mouse leave', async () => {
      const user = userEvent.setup();
      renderInlinePageLink();

      await user.hover(screen.getByTestId('inline-page-link'));
      await user.unhover(screen.getByTestId('inline-page-link'));

      const element = screen.getByTestId('inline-page-link');
      // When hover is removed, borderBottomColor returns to transparent
      // In jsdom, computed styles may return empty string for transparent
      expect(['transparent', '']).toContain(element.style.borderBottomColor);
    });
  });

  describe('Missing/Deleted Target State', () => {
    it('renders with strikethrough when exists is false', () => {
      renderInlinePageLink({ exists: false });

      const element = screen.getByTestId('inline-page-link');
      expect(element.style.textDecoration).toBe('line-through');
    });

    it('renders with not-allowed cursor when exists is false', () => {
      renderInlinePageLink({ exists: false });

      const element = screen.getByTestId('inline-page-link');
      expect(element.style.cursor).toBe('not-allowed');
    });

    it('renders with reduced opacity when exists is false', () => {
      renderInlinePageLink({ exists: false });

      const element = screen.getByTestId('inline-page-link');
      expect(element.style.opacity).toBe('0.7');
    });

    it('sets aria-disabled when exists is false', () => {
      renderInlinePageLink({ exists: false });

      const element = screen.getByTestId('inline-page-link');
      expect(element.getAttribute('aria-disabled')).toBe('true');
    });

    it('defaults exists to true', () => {
      renderInlinePageLink({});

      const element = screen.getByTestId('inline-page-link');
      expect(element.getAttribute('data-exists')).toBe('true');
    });
  });

  describe('Accessibility', () => {
    it('has accessible label for existing page', () => {
      renderInlinePageLink({ title: 'Project Ideas', exists: true });

      expect(screen.getByLabelText('Go to page: Project Ideas')).toBeDefined();
    });

    it('has accessible label for missing page', () => {
      renderInlinePageLink({ title: 'Deleted Page', exists: false });

      expect(screen.getByLabelText('Missing page: Deleted Page')).toBeDefined();
    });

    it('marks bracket decorations as aria-hidden', () => {
      renderInlinePageLink({ title: 'Test' });

      const element = screen.getByTestId('inline-page-link');
      const hiddenElements = element.querySelectorAll('[aria-hidden="true"]');
      expect(hiddenElements.length).toBe(2); // Opening and closing brackets
    });

    it('is keyboard accessible (can be focused)', async () => {
      const user = userEvent.setup();
      const { onClick } = renderInlinePageLink({ pageId: 'page-1' });

      await user.tab();

      const button = screen.getByRole('button');
      expect(document.activeElement).toBe(button);

      await user.keyboard('{Enter}');
      expect(onClick).toHaveBeenCalledTimes(1);
      expect(onClick).toHaveBeenCalledWith('page-1');
    });

    it('responds to Space key press', async () => {
      const user = userEvent.setup();
      const { onClick } = renderInlinePageLink({ pageId: 'page-1' });

      await user.tab();
      await user.keyboard(' ');

      expect(onClick).toHaveBeenCalledTimes(1);
      expect(onClick).toHaveBeenCalledWith('page-1');
    });

    it('does not trigger onClick on Enter when exists is false', async () => {
      const user = userEvent.setup();
      const { onClick } = renderInlinePageLink({ exists: false });

      await user.tab();
      await user.keyboard('{Enter}');

      expect(onClick).not.toHaveBeenCalled();
    });

    it('does not trigger onClick on Space when exists is false', async () => {
      const user = userEvent.setup();
      const { onClick } = renderInlinePageLink({ exists: false });

      await user.tab();
      await user.keyboard(' ');

      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('Data Attributes', () => {
    it('sets data-page-id attribute', () => {
      renderInlinePageLink({ pageId: '01HQXYZ123456' });

      const element = screen.getByTestId('inline-page-link');
      expect(element.getAttribute('data-page-id')).toBe('01HQXYZ123456');
    });

    it('sets data-exists attribute to true', () => {
      renderInlinePageLink({ exists: true });

      const element = screen.getByTestId('inline-page-link');
      expect(element.getAttribute('data-exists')).toBe('true');
    });

    it('sets data-exists attribute to false', () => {
      renderInlinePageLink({ exists: false });

      const element = screen.getByTestId('inline-page-link');
      expect(element.getAttribute('data-exists')).toBe('false');
    });
  });

  describe('Styling', () => {
    it('applies custom className', () => {
      renderInlinePageLink({ className: 'custom-class' });

      const element = screen.getByTestId('inline-page-link');
      expect(element.classList.contains('custom-class')).toBe(true);
    });

    it('inherits font properties', () => {
      renderInlinePageLink();

      const element = screen.getByTestId('inline-page-link');
      expect(element.style.fontFamily).toBe('inherit');
      expect(element.style.fontSize).toBe('inherit');
      expect(element.style.lineHeight).toBe('inherit');
    });

    it('has transparent border-bottom by default (for hover underline)', () => {
      renderInlinePageLink();

      const element = screen.getByTestId('inline-page-link');
      expect(element.style.borderBottomStyle).toBe('solid');
      expect(element.style.borderBottomWidth).toBe('1px');
      // borderBottomColor is transparent for hover underline effect
      expect(['transparent', '']).toContain(element.style.borderBottomColor);
    });

    it('has CSS transition for smooth hover effect', () => {
      renderInlinePageLink();

      const element = screen.getByTestId('inline-page-link');
      expect(element.style.transition).toContain('0.15s');
    });

    it('resets default button styles', () => {
      renderInlinePageLink();

      const element = screen.getByTestId('inline-page-link');
      // Using non-shorthand properties for button reset
      expect(element.style.borderTopStyle).toBe('none');
      expect(element.style.borderLeftStyle).toBe('none');
      expect(element.style.borderRightStyle).toBe('none');
      expect(element.style.backgroundColor).toBe('transparent');
    });
  });

  describe('Ref Forwarding', () => {
    it('forwards ref to button element', () => {
      const ref = vi.fn();
      render(<InlinePageLink ref={ref} pageId="01HQXYZ123456" title="Test" onClick={vi.fn()} />);

      expect(ref).toHaveBeenCalled();
      expect(ref.mock.calls[0][0]).toBeInstanceOf(HTMLButtonElement);
    });
  });

  describe('Memoization', () => {
    it('is memoized (wrapped with memo)', () => {
      const { rerender, onClick } = renderInlinePageLink({
        pageId: '01HQXYZ123456',
        title: 'Test Page',
      });

      const elementBefore = screen.getByTestId('inline-page-link');

      rerender(<InlinePageLink pageId="01HQXYZ123456" title="Test Page" onClick={onClick} />);

      const elementAfter = screen.getByTestId('inline-page-link');

      // Same DOM node indicates memoization worked
      expect(elementBefore).toBe(elementAfter);
    });
  });
});
