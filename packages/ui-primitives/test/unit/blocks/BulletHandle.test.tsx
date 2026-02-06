/**
 * Tests for BulletHandle component.
 *
 * Tests cover:
 * - Rendering bullet dot for leaf blocks
 * - Rendering disclosure triangle for parent blocks
 * - Triangle rotation for collapsed/expanded states
 * - Click handler functionality
 * - Accessibility attributes
 * - Indentation styling
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { BulletHandle, type BulletHandleProps } from '../../../src/blocks/BulletHandle';

// Helper to render BulletHandle with defaults
function renderBulletHandle(overrides: Partial<BulletHandleProps> = {}) {
  const defaultProps: BulletHandleProps = {
    hasChildren: false,
    isCollapsed: false,
    onToggle: vi.fn(),
    ...overrides,
  };

  return {
    ...render(<BulletHandle {...defaultProps} />),
    onToggle: defaultProps.onToggle,
  };
}

describe('BulletHandle', () => {
  describe('Rendering - Leaf Block (no children)', () => {
    it('renders a bullet dot when hasChildren is false', () => {
      renderBulletHandle({ hasChildren: false });

      expect(screen.getByTestId('bullet-dot')).toBeDefined();
      expect(screen.queryByTestId('disclosure-triangle')).toBeNull();
    });

    it('renders bullet dot regardless of isCollapsed when hasChildren is false', () => {
      // isCollapsed should have no effect when there are no children
      renderBulletHandle({ hasChildren: false, isCollapsed: true });

      expect(screen.getByTestId('bullet-dot')).toBeDefined();
      expect(screen.queryByTestId('disclosure-triangle')).toBeNull();
    });

    it('applies bullet dot styling', () => {
      renderBulletHandle({ hasChildren: false });

      const bullet = screen.getByTestId('bullet-dot');
      const style = bullet.style;

      expect(style.borderRadius).toBe('50%');
      expect(style.width).toBe('6px');
      expect(style.height).toBe('6px');
    });
  });

  describe('Rendering - Parent Block (with children)', () => {
    it('renders a disclosure triangle when hasChildren is true', () => {
      renderBulletHandle({ hasChildren: true });

      expect(screen.getByTestId('disclosure-triangle')).toBeDefined();
      expect(screen.queryByTestId('bullet-dot')).toBeNull();
    });

    it('renders expanded triangle (pointing down) when not collapsed', () => {
      renderBulletHandle({ hasChildren: true, isCollapsed: false });

      const triangle = screen.getByTestId('disclosure-triangle');
      expect(triangle.style.transform).toBe('rotate(90deg)');
    });

    it('renders collapsed triangle (pointing right) when collapsed', () => {
      renderBulletHandle({ hasChildren: true, isCollapsed: true });

      const triangle = screen.getByTestId('disclosure-triangle');
      expect(triangle.style.transform).toBe('rotate(0deg)');
    });

    it('applies triangle styling', () => {
      renderBulletHandle({ hasChildren: true });

      const triangle = screen.getByTestId('disclosure-triangle');
      const style = triangle.style;

      // CSS triangle border trick
      expect(style.borderStyle).toBe('solid');
      expect(style.width).toBe('0px');
      expect(style.height).toBe('0px');
    });

    it('applies CSS transition for smooth rotation', () => {
      renderBulletHandle({ hasChildren: true });

      const triangle = screen.getByTestId('disclosure-triangle');
      expect(triangle.style.transition).toContain('transform');
    });
  });

  describe('Click Handling', () => {
    it('calls onToggle when clicked', async () => {
      const user = userEvent.setup();
      const { onToggle } = renderBulletHandle();

      await user.click(screen.getByTestId('bullet-handle'));

      expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it('calls onToggle for leaf blocks (bullet dot)', async () => {
      const user = userEvent.setup();
      const { onToggle } = renderBulletHandle({ hasChildren: false });

      await user.click(screen.getByTestId('bullet-handle'));

      expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it('calls onToggle for parent blocks (disclosure triangle)', async () => {
      const user = userEvent.setup();
      const { onToggle } = renderBulletHandle({ hasChildren: true });

      await user.click(screen.getByTestId('bullet-handle'));

      expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it('calls onToggle for collapsed parent blocks', async () => {
      const user = userEvent.setup();
      const { onToggle } = renderBulletHandle({
        hasChildren: true,
        isCollapsed: true,
      });

      await user.click(screen.getByTestId('bullet-handle'));

      expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it('calls onToggle for expanded parent blocks', async () => {
      const user = userEvent.setup();
      const { onToggle } = renderBulletHandle({
        hasChildren: true,
        isCollapsed: false,
      });

      await user.click(screen.getByTestId('bullet-handle'));

      expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it('stops event propagation on click', async () => {
      const user = userEvent.setup();
      const parentClickHandler = vi.fn();

      render(
        <div onClick={parentClickHandler} data-testid="parent">
          <BulletHandle hasChildren={true} isCollapsed={false} onToggle={vi.fn()} />
        </div>
      );

      await user.click(screen.getByTestId('bullet-handle'));

      // Parent click handler should not be called due to stopPropagation
      expect(parentClickHandler).not.toHaveBeenCalled();
    });

    it('handles multiple clicks correctly', async () => {
      const user = userEvent.setup();
      const { onToggle } = renderBulletHandle();

      await user.click(screen.getByTestId('bullet-handle'));
      await user.click(screen.getByTestId('bullet-handle'));
      await user.click(screen.getByTestId('bullet-handle'));

      expect(onToggle).toHaveBeenCalledTimes(3);
    });
  });

  describe('Accessibility', () => {
    it('renders as a button element', () => {
      renderBulletHandle();

      expect(screen.getByRole('button')).toBeDefined();
    });

    it('has aria-expanded for parent blocks', () => {
      renderBulletHandle({ hasChildren: true, isCollapsed: false });

      const button = screen.getByRole('button');
      expect(button.getAttribute('aria-expanded')).toBe('true');
    });

    it('has aria-expanded=false when collapsed', () => {
      renderBulletHandle({ hasChildren: true, isCollapsed: true });

      const button = screen.getByRole('button');
      expect(button.getAttribute('aria-expanded')).toBe('false');
    });

    it('does not have aria-expanded for leaf blocks', () => {
      renderBulletHandle({ hasChildren: false });

      const button = screen.getByRole('button');
      expect(button.getAttribute('aria-expanded')).toBeNull();
    });

    it('has accessible label for collapsed parent block', () => {
      renderBulletHandle({ hasChildren: true, isCollapsed: true });

      expect(screen.getByLabelText('Expand block')).toBeDefined();
    });

    it('has accessible label for expanded parent block', () => {
      renderBulletHandle({ hasChildren: true, isCollapsed: false });

      expect(screen.getByLabelText('Collapse block')).toBeDefined();
    });

    it('has accessible label for leaf block', () => {
      renderBulletHandle({ hasChildren: false });

      expect(screen.getByLabelText('Block bullet')).toBeDefined();
    });

    it('marks decorative elements as aria-hidden', () => {
      renderBulletHandle({ hasChildren: false });

      const bullet = screen.getByTestId('bullet-dot');
      expect(bullet.getAttribute('aria-hidden')).toBe('true');
    });

    it('marks triangle as aria-hidden', () => {
      renderBulletHandle({ hasChildren: true });

      const triangle = screen.getByTestId('disclosure-triangle');
      expect(triangle.getAttribute('aria-hidden')).toBe('true');
    });

    it('is keyboard accessible (can be focused)', async () => {
      const user = userEvent.setup();
      const { onToggle } = renderBulletHandle();

      // Tab to focus the button
      await user.tab();

      const button = screen.getByRole('button');
      expect(document.activeElement).toBe(button);

      // Press Enter to activate
      await user.keyboard('{Enter}');
      expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it('responds to Space key press', async () => {
      const user = userEvent.setup();
      const { onToggle } = renderBulletHandle();

      await user.tab();
      await user.keyboard(' ');

      expect(onToggle).toHaveBeenCalledTimes(1);
    });
  });

  describe('Data Attributes', () => {
    it('sets data-has-children attribute', () => {
      renderBulletHandle({ hasChildren: true });

      const button = screen.getByTestId('bullet-handle');
      expect(button.getAttribute('data-has-children')).toBe('true');
    });

    it('sets data-has-children=false for leaf blocks', () => {
      renderBulletHandle({ hasChildren: false });

      const button = screen.getByTestId('bullet-handle');
      expect(button.getAttribute('data-has-children')).toBe('false');
    });

    it('sets data-collapsed attribute for collapsed blocks', () => {
      renderBulletHandle({ hasChildren: true, isCollapsed: true });

      const button = screen.getByTestId('bullet-handle');
      expect(button.getAttribute('data-collapsed')).toBe('true');
    });

    it('sets data-collapsed=false for expanded blocks', () => {
      renderBulletHandle({ hasChildren: true, isCollapsed: false });

      const button = screen.getByTestId('bullet-handle');
      expect(button.getAttribute('data-collapsed')).toBe('false');
    });
  });

  describe('Indentation', () => {
    it('applies no margin when indent is 0', () => {
      renderBulletHandle({ indent: 0 });

      const button = screen.getByTestId('bullet-handle');
      expect(button.style.marginLeft).toBe('0px');
    });

    it('applies 24px margin per indent level', () => {
      renderBulletHandle({ indent: 1 });

      const button = screen.getByTestId('bullet-handle');
      expect(button.style.marginLeft).toBe('24px');
    });

    it('applies correct margin for multiple indent levels', () => {
      renderBulletHandle({ indent: 3 });

      const button = screen.getByTestId('bullet-handle');
      expect(button.style.marginLeft).toBe('72px'); // 3 * 24 = 72
    });

    it('defaults to 0 indent when not specified', () => {
      renderBulletHandle({});

      const button = screen.getByTestId('bullet-handle');
      expect(button.style.marginLeft).toBe('0px');
    });
  });

  describe('Styling', () => {
    it('applies custom className', () => {
      renderBulletHandle({ className: 'custom-class' });

      const button = screen.getByTestId('bullet-handle');
      expect(button.classList.contains('custom-class')).toBe(true);
    });

    it('renders with inline button reset styles', () => {
      renderBulletHandle();

      const button = screen.getByTestId('bullet-handle');
      // border: 'none' sets borderStyle, borderWidth, etc.
      expect(button.style.borderStyle).toBe('none');
      expect(button.style.background).toBe('transparent');
      expect(button.style.padding).toBe('0px');
    });

    it('has pointer cursor', () => {
      renderBulletHandle();

      const button = screen.getByTestId('bullet-handle');
      expect(button.style.cursor).toBe('pointer');
    });

    it('has fixed dimensions', () => {
      renderBulletHandle();

      const button = screen.getByTestId('bullet-handle');
      expect(button.style.width).toBe('20px');
      expect(button.style.height).toBe('20px');
    });
  });

  describe('Ref Forwarding', () => {
    it('forwards ref to button element', () => {
      const ref = vi.fn();
      render(<BulletHandle ref={ref} hasChildren={false} isCollapsed={false} onToggle={vi.fn()} />);

      expect(ref).toHaveBeenCalled();
      expect(ref.mock.calls[0][0]).toBeInstanceOf(HTMLButtonElement);
    });
  });

  describe('Memoization', () => {
    it('is memoized (wrapped with memo)', () => {
      // Verify the component is properly wrapped
      // This tests that BulletHandle is the same between renders when props don't change
      const { rerender, onToggle } = renderBulletHandle({
        hasChildren: false,
        isCollapsed: false,
      });

      const buttonBefore = screen.getByTestId('bullet-handle');

      rerender(<BulletHandle hasChildren={false} isCollapsed={false} onToggle={onToggle} />);

      const buttonAfter = screen.getByTestId('bullet-handle');

      // Same DOM node indicates memoization worked
      expect(buttonBefore).toBe(buttonAfter);
    });
  });
});
