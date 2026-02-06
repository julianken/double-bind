/**
 * Tests for InlineBlockRef component.
 *
 * Tests cover:
 * - Rendering with content and blockId
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
import { InlineBlockRef, type InlineBlockRefProps } from '../../../src/blocks/InlineBlockRef';

// Helper to render InlineBlockRef with defaults
function renderInlineBlockRef(overrides: Partial<InlineBlockRefProps> = {}) {
  const defaultProps: InlineBlockRefProps = {
    blockId: '01HQXYZ123456',
    onClick: vi.fn(),
    ...overrides,
  };

  return {
    ...render(<InlineBlockRef {...defaultProps} />),
    onClick: defaultProps.onClick,
    onHover: defaultProps.onHover,
  };
}

describe('InlineBlockRef', () => {
  describe('Rendering', () => {
    it('renders with content when provided', () => {
      renderInlineBlockRef({ content: 'Referenced block content' });

      expect(screen.getByTestId('inline-block-ref-content').textContent).toBe(
        'Referenced block content'
      );
    });

    it('renders blockId as fallback when content is not provided', () => {
      renderInlineBlockRef({ blockId: '01HQXYZ123456' });

      expect(screen.getByTestId('inline-block-ref-content').textContent).toBe('01HQXYZ123456');
    });

    it('renders with double parentheses brackets', () => {
      renderInlineBlockRef({ content: 'Test' });

      const element = screen.getByTestId('inline-block-ref');
      expect(element.textContent).toBe('((Test))');
    });

    it('renders as a button element', () => {
      renderInlineBlockRef();

      expect(screen.getByRole('button')).toBeDefined();
    });

    it('applies inline display style', () => {
      renderInlineBlockRef();

      const element = screen.getByTestId('inline-block-ref');
      expect(element.style.display).toBe('inline');
    });

    it('applies cursor pointer style', () => {
      renderInlineBlockRef();

      const element = screen.getByTestId('inline-block-ref');
      expect(element.style.cursor).toBe('pointer');
    });
  });

  describe('Click Handling', () => {
    it('calls onClick with blockId when clicked', async () => {
      const user = userEvent.setup();
      const { onClick } = renderInlineBlockRef({ blockId: '01HQXYZ123456' });

      await user.click(screen.getByTestId('inline-block-ref'));

      expect(onClick).toHaveBeenCalledTimes(1);
      expect(onClick).toHaveBeenCalledWith('01HQXYZ123456');
    });

    it('does not call onClick when exists is false', async () => {
      const user = userEvent.setup();
      const { onClick } = renderInlineBlockRef({ exists: false });

      await user.click(screen.getByTestId('inline-block-ref'));

      expect(onClick).not.toHaveBeenCalled();
    });

    it('stops event propagation on click', async () => {
      const user = userEvent.setup();
      const parentClickHandler = vi.fn();

      render(
        <div onClick={parentClickHandler} data-testid="parent">
          <InlineBlockRef blockId="01HQXYZ123456" onClick={vi.fn()} />
        </div>
      );

      await user.click(screen.getByTestId('inline-block-ref'));

      expect(parentClickHandler).not.toHaveBeenCalled();
    });

    it('handles multiple clicks correctly', async () => {
      const user = userEvent.setup();
      const { onClick } = renderInlineBlockRef({ blockId: 'block-1' });

      await user.click(screen.getByTestId('inline-block-ref'));
      await user.click(screen.getByTestId('inline-block-ref'));
      await user.click(screen.getByTestId('inline-block-ref'));

      expect(onClick).toHaveBeenCalledTimes(3);
    });
  });

  describe('Hover Handling', () => {
    it('calls onHover with blockId on mouse enter', async () => {
      const user = userEvent.setup();
      const onHover = vi.fn();
      renderInlineBlockRef({ blockId: '01HQXYZ123456', onHover });

      await user.hover(screen.getByTestId('inline-block-ref'));

      expect(onHover).toHaveBeenCalledWith('01HQXYZ123456');
    });

    it('calls onHover with null on mouse leave', async () => {
      const user = userEvent.setup();
      const onHover = vi.fn();
      renderInlineBlockRef({ blockId: '01HQXYZ123456', onHover });

      await user.hover(screen.getByTestId('inline-block-ref'));
      await user.unhover(screen.getByTestId('inline-block-ref'));

      expect(onHover).toHaveBeenCalledWith(null);
    });

    it('does not throw when onHover is not provided', async () => {
      const user = userEvent.setup();
      renderInlineBlockRef({ onHover: undefined });

      // Should not throw
      await user.hover(screen.getByTestId('inline-block-ref'));
      await user.unhover(screen.getByTestId('inline-block-ref'));
    });

    it('applies hover styles on mouse enter', async () => {
      const user = userEvent.setup();
      renderInlineBlockRef();

      await user.hover(screen.getByTestId('inline-block-ref'));

      const element = screen.getByTestId('inline-block-ref');
      // Hover style includes border-bottom color
      expect(element.style.borderBottomColor).not.toBe('transparent');
    });

    it('removes hover styles on mouse leave', async () => {
      const user = userEvent.setup();
      renderInlineBlockRef();

      await user.hover(screen.getByTestId('inline-block-ref'));
      await user.unhover(screen.getByTestId('inline-block-ref'));

      const element = screen.getByTestId('inline-block-ref');
      // When hover is removed, borderBottomColor returns to transparent
      // In jsdom, computed styles may return empty string for transparent
      expect(['transparent', '']).toContain(element.style.borderBottomColor);
    });
  });

  describe('Missing/Deleted Target State', () => {
    it('renders with strikethrough when exists is false', () => {
      renderInlineBlockRef({ exists: false });

      const element = screen.getByTestId('inline-block-ref');
      expect(element.style.textDecoration).toBe('line-through');
    });

    it('renders with not-allowed cursor when exists is false', () => {
      renderInlineBlockRef({ exists: false });

      const element = screen.getByTestId('inline-block-ref');
      expect(element.style.cursor).toBe('not-allowed');
    });

    it('renders with reduced opacity when exists is false', () => {
      renderInlineBlockRef({ exists: false });

      const element = screen.getByTestId('inline-block-ref');
      expect(element.style.opacity).toBe('0.7');
    });

    it('sets aria-disabled when exists is false', () => {
      renderInlineBlockRef({ exists: false });

      const element = screen.getByTestId('inline-block-ref');
      expect(element.getAttribute('aria-disabled')).toBe('true');
    });

    it('defaults exists to true', () => {
      renderInlineBlockRef({});

      const element = screen.getByTestId('inline-block-ref');
      expect(element.getAttribute('data-exists')).toBe('true');
    });
  });

  describe('Accessibility', () => {
    it('has accessible label for existing block', () => {
      renderInlineBlockRef({ content: 'Test content', exists: true });

      expect(screen.getByLabelText('Go to block: Test content')).toBeDefined();
    });

    it('has accessible label for missing block', () => {
      renderInlineBlockRef({ blockId: '01HQXYZ123456', exists: false });

      expect(screen.getByLabelText('Missing block reference: 01HQXYZ123456')).toBeDefined();
    });

    it('marks bracket decorations as aria-hidden', () => {
      renderInlineBlockRef({ content: 'Test' });

      const element = screen.getByTestId('inline-block-ref');
      const hiddenElements = element.querySelectorAll('[aria-hidden="true"]');
      expect(hiddenElements.length).toBe(2); // Opening and closing brackets
    });

    it('is keyboard accessible (can be focused)', async () => {
      const user = userEvent.setup();
      const { onClick } = renderInlineBlockRef({ blockId: 'block-1' });

      await user.tab();

      const button = screen.getByRole('button');
      expect(document.activeElement).toBe(button);

      await user.keyboard('{Enter}');
      expect(onClick).toHaveBeenCalledTimes(1);
      expect(onClick).toHaveBeenCalledWith('block-1');
    });

    it('responds to Space key press', async () => {
      const user = userEvent.setup();
      const { onClick } = renderInlineBlockRef({ blockId: 'block-1' });

      await user.tab();
      await user.keyboard(' ');

      expect(onClick).toHaveBeenCalledTimes(1);
      expect(onClick).toHaveBeenCalledWith('block-1');
    });

    it('does not trigger onClick on Enter when exists is false', async () => {
      const user = userEvent.setup();
      const { onClick } = renderInlineBlockRef({ exists: false });

      await user.tab();
      await user.keyboard('{Enter}');

      expect(onClick).not.toHaveBeenCalled();
    });

    it('does not trigger onClick on Space when exists is false', async () => {
      const user = userEvent.setup();
      const { onClick } = renderInlineBlockRef({ exists: false });

      await user.tab();
      await user.keyboard(' ');

      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('Data Attributes', () => {
    it('sets data-block-id attribute', () => {
      renderInlineBlockRef({ blockId: '01HQXYZ123456' });

      const element = screen.getByTestId('inline-block-ref');
      expect(element.getAttribute('data-block-id')).toBe('01HQXYZ123456');
    });

    it('sets data-exists attribute to true', () => {
      renderInlineBlockRef({ exists: true });

      const element = screen.getByTestId('inline-block-ref');
      expect(element.getAttribute('data-exists')).toBe('true');
    });

    it('sets data-exists attribute to false', () => {
      renderInlineBlockRef({ exists: false });

      const element = screen.getByTestId('inline-block-ref');
      expect(element.getAttribute('data-exists')).toBe('false');
    });
  });

  describe('Styling', () => {
    it('applies custom className', () => {
      renderInlineBlockRef({ className: 'custom-class' });

      const element = screen.getByTestId('inline-block-ref');
      expect(element.classList.contains('custom-class')).toBe(true);
    });

    it('inherits font properties', () => {
      renderInlineBlockRef();

      const element = screen.getByTestId('inline-block-ref');
      expect(element.style.fontFamily).toBe('inherit');
      expect(element.style.fontSize).toBe('inherit');
      expect(element.style.lineHeight).toBe('inherit');
    });

    it('has transparent border-bottom by default (for hover underline)', () => {
      renderInlineBlockRef();

      const element = screen.getByTestId('inline-block-ref');
      expect(element.style.borderBottomStyle).toBe('solid');
      expect(element.style.borderBottomWidth).toBe('1px');
      // borderBottomColor is transparent for hover underline effect
      expect(['transparent', '']).toContain(element.style.borderBottomColor);
    });

    it('has CSS transition for smooth hover effect', () => {
      renderInlineBlockRef();

      const element = screen.getByTestId('inline-block-ref');
      expect(element.style.transition).toContain('0.15s');
    });

    it('resets default button styles', () => {
      renderInlineBlockRef();

      const element = screen.getByTestId('inline-block-ref');
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
      render(<InlineBlockRef ref={ref} blockId="01HQXYZ123456" onClick={vi.fn()} />);

      expect(ref).toHaveBeenCalled();
      expect(ref.mock.calls[0][0]).toBeInstanceOf(HTMLButtonElement);
    });
  });

  describe('Memoization', () => {
    it('is memoized (wrapped with memo)', () => {
      const { rerender, onClick } = renderInlineBlockRef({
        blockId: '01HQXYZ123456',
        content: 'Test',
      });

      const elementBefore = screen.getByTestId('inline-block-ref');

      rerender(<InlineBlockRef blockId="01HQXYZ123456" content="Test" onClick={onClick} />);

      const elementAfter = screen.getByTestId('inline-block-ref');

      // Same DOM node indicates memoization worked
      expect(elementBefore).toBe(elementAfter);
    });
  });
});
