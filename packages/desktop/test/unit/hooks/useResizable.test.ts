/**
 * Tests for useResizable hook
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useResizable } from '../../../src/hooks/useResizable.js';

describe('useResizable', () => {
  // ============================================================================
  // Setup
  // ============================================================================

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ============================================================================
  // Initial State
  // ============================================================================

  describe('Initial State', () => {
    it('initializes with provided width', () => {
      const { result } = renderHook(() =>
        useResizable({
          initialWidth: 250,
        })
      );

      expect(result.current.width).toBe(250);
      expect(result.current.isDragging).toBe(false);
    });

    it('initializes with different width values', () => {
      const { result: result1 } = renderHook(() => useResizable({ initialWidth: 100 }));
      expect(result1.current.width).toBe(100);

      const { result: result2 } = renderHook(() => useResizable({ initialWidth: 500 }));
      expect(result2.current.width).toBe(500);
    });
  });

  // ============================================================================
  // Width Constraints
  // ============================================================================

  describe('Width Constraints', () => {
    it('clamps width to minWidth', () => {
      const { result } = renderHook(() =>
        useResizable({
          initialWidth: 250,
          minWidth: 150,
        })
      );

      act(() => {
        result.current.setWidth(100);
      });

      expect(result.current.width).toBe(150);
    });

    it('clamps width to maxWidth', () => {
      const { result } = renderHook(() =>
        useResizable({
          initialWidth: 250,
          maxWidth: 400,
        })
      );

      act(() => {
        result.current.setWidth(500);
      });

      expect(result.current.width).toBe(400);
    });

    it('allows width within constraints', () => {
      const { result } = renderHook(() =>
        useResizable({
          initialWidth: 250,
          minWidth: 150,
          maxWidth: 400,
        })
      );

      act(() => {
        result.current.setWidth(300);
      });

      expect(result.current.width).toBe(300);
    });

    it('handles min and max at same value', () => {
      const { result } = renderHook(() =>
        useResizable({
          initialWidth: 250,
          minWidth: 200,
          maxWidth: 200,
        })
      );

      act(() => {
        result.current.setWidth(150);
      });
      expect(result.current.width).toBe(200);

      act(() => {
        result.current.setWidth(300);
      });
      expect(result.current.width).toBe(200);
    });
  });

  // ============================================================================
  // setWidth
  // ============================================================================

  describe('setWidth', () => {
    it('updates width via setWidth', () => {
      const { result } = renderHook(() =>
        useResizable({
          initialWidth: 250,
        })
      );

      act(() => {
        result.current.setWidth(300);
      });

      expect(result.current.width).toBe(300);
    });

    it('applies constraints when setting width', () => {
      const { result } = renderHook(() =>
        useResizable({
          initialWidth: 250,
          minWidth: 100,
          maxWidth: 400,
        })
      );

      act(() => {
        result.current.setWidth(50);
      });
      expect(result.current.width).toBe(100);

      act(() => {
        result.current.setWidth(500);
      });
      expect(result.current.width).toBe(400);
    });
  });

  // ============================================================================
  // Mouse Event Handlers
  // ============================================================================

  describe('Mouse Event Handlers', () => {
    it('provides handleMouseDown function', () => {
      const { result } = renderHook(() =>
        useResizable({
          initialWidth: 250,
        })
      );

      expect(typeof result.current.handleMouseDown).toBe('function');
    });

    it('sets isDragging to true on mousedown', () => {
      const { result } = renderHook(() =>
        useResizable({
          initialWidth: 250,
        })
      );

      const mockEvent = {
        preventDefault: vi.fn(),
        clientX: 100,
      } as unknown as React.MouseEvent;

      act(() => {
        result.current.handleMouseDown(mockEvent);
      });

      expect(result.current.isDragging).toBe(true);
      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    it('updates width during mousemove', () => {
      const onWidthChange = vi.fn();
      const { result } = renderHook(() =>
        useResizable({
          initialWidth: 250,
          onWidthChange,
        })
      );

      // Start drag
      const mouseDownEvent = {
        preventDefault: vi.fn(),
        clientX: 100,
      } as unknown as React.MouseEvent;

      act(() => {
        result.current.handleMouseDown(mouseDownEvent);
      });

      // Simulate mousemove
      const mouseMoveEvent = new MouseEvent('mousemove', { clientX: 150 });
      act(() => {
        document.dispatchEvent(mouseMoveEvent);
      });

      expect(result.current.width).toBe(300); // 250 + (150 - 100)
      expect(onWidthChange).toHaveBeenCalledWith(300);
    });

    it('stops dragging on mouseup', () => {
      const { result } = renderHook(() =>
        useResizable({
          initialWidth: 250,
        })
      );

      // Start drag
      const mouseDownEvent = {
        preventDefault: vi.fn(),
        clientX: 100,
      } as unknown as React.MouseEvent;

      act(() => {
        result.current.handleMouseDown(mouseDownEvent);
      });

      expect(result.current.isDragging).toBe(true);

      // End drag
      act(() => {
        document.dispatchEvent(new MouseEvent('mouseup'));
      });

      expect(result.current.isDragging).toBe(false);
    });

    it('respects minWidth during drag', () => {
      const { result } = renderHook(() =>
        useResizable({
          initialWidth: 250,
          minWidth: 150,
        })
      );

      // Start drag at x=250
      const mouseDownEvent = {
        preventDefault: vi.fn(),
        clientX: 250,
      } as unknown as React.MouseEvent;

      act(() => {
        result.current.handleMouseDown(mouseDownEvent);
      });

      // Drag left by 200px (would make width 50)
      const mouseMoveEvent = new MouseEvent('mousemove', { clientX: 50 });
      act(() => {
        document.dispatchEvent(mouseMoveEvent);
      });

      expect(result.current.width).toBe(150); // Clamped to minWidth
    });

    it('respects maxWidth during drag', () => {
      const { result } = renderHook(() =>
        useResizable({
          initialWidth: 250,
          maxWidth: 400,
        })
      );

      // Start drag at x=100
      const mouseDownEvent = {
        preventDefault: vi.fn(),
        clientX: 100,
      } as unknown as React.MouseEvent;

      act(() => {
        result.current.handleMouseDown(mouseDownEvent);
      });

      // Drag right by 300px (would make width 550)
      const mouseMoveEvent = new MouseEvent('mousemove', { clientX: 400 });
      act(() => {
        document.dispatchEvent(mouseMoveEvent);
      });

      expect(result.current.width).toBe(400); // Clamped to maxWidth
    });
  });

  // ============================================================================
  // Callbacks
  // ============================================================================

  describe('Callbacks', () => {
    it('calls onWidthChange during drag', () => {
      const onWidthChange = vi.fn();
      const { result } = renderHook(() =>
        useResizable({
          initialWidth: 250,
          onWidthChange,
        })
      );

      // Start drag
      const mouseDownEvent = {
        preventDefault: vi.fn(),
        clientX: 100,
      } as unknown as React.MouseEvent;

      act(() => {
        result.current.handleMouseDown(mouseDownEvent);
      });

      // Move mouse
      act(() => {
        document.dispatchEvent(new MouseEvent('mousemove', { clientX: 120 }));
      });

      expect(onWidthChange).toHaveBeenCalledWith(270);
    });

    it('calls onDragEnd when drag ends', () => {
      const onDragEnd = vi.fn();
      const { result } = renderHook(() =>
        useResizable({
          initialWidth: 250,
          onDragEnd,
        })
      );

      // Start drag
      const mouseDownEvent = {
        preventDefault: vi.fn(),
        clientX: 100,
      } as unknown as React.MouseEvent;

      act(() => {
        result.current.handleMouseDown(mouseDownEvent);
      });

      // End drag
      act(() => {
        document.dispatchEvent(new MouseEvent('mouseup'));
      });

      expect(onDragEnd).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Event Listener Cleanup
  // ============================================================================

  describe('Event Listener Cleanup', () => {
    it('removes event listeners when dragging ends', () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

      const { result } = renderHook(() =>
        useResizable({
          initialWidth: 250,
        })
      );

      // Start drag
      const mouseDownEvent = {
        preventDefault: vi.fn(),
        clientX: 100,
      } as unknown as React.MouseEvent;

      act(() => {
        result.current.handleMouseDown(mouseDownEvent);
      });

      // Should add listeners
      expect(addEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('mouseup', expect.any(Function));

      // End drag
      act(() => {
        document.dispatchEvent(new MouseEvent('mouseup'));
      });

      // Should remove listeners
      expect(removeEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('mouseup', expect.any(Function));

      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    });

    it('cleans up listeners on unmount during drag', () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

      const { result, unmount } = renderHook(() =>
        useResizable({
          initialWidth: 250,
        })
      );

      // Start drag
      const mouseDownEvent = {
        preventDefault: vi.fn(),
        clientX: 100,
      } as unknown as React.MouseEvent;

      act(() => {
        result.current.handleMouseDown(mouseDownEvent);
      });

      // Unmount while dragging
      unmount();

      // Should remove listeners
      expect(removeEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('mouseup', expect.any(Function));

      removeEventListenerSpy.mockRestore();
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('handles zero initialWidth', () => {
      const { result } = renderHook(() =>
        useResizable({
          initialWidth: 0,
          minWidth: 0,
        })
      );

      expect(result.current.width).toBe(0);
    });

    it('handles negative delta during drag', () => {
      const { result } = renderHook(() =>
        useResizable({
          initialWidth: 250,
          minWidth: 100,
        })
      );

      // Start drag at x=200
      const mouseDownEvent = {
        preventDefault: vi.fn(),
        clientX: 200,
      } as unknown as React.MouseEvent;

      act(() => {
        result.current.handleMouseDown(mouseDownEvent);
      });

      // Move left (negative delta)
      act(() => {
        document.dispatchEvent(new MouseEvent('mousemove', { clientX: 100 }));
      });

      expect(result.current.width).toBe(150); // 250 + (100 - 200) = 150
    });

    it('handles rapid successive drags', () => {
      const onWidthChange = vi.fn();
      const { result } = renderHook(() =>
        useResizable({
          initialWidth: 250,
          onWidthChange,
        })
      );

      // First drag
      act(() => {
        result.current.handleMouseDown({
          preventDefault: vi.fn(),
          clientX: 100,
        } as unknown as React.MouseEvent);
      });

      act(() => {
        document.dispatchEvent(new MouseEvent('mousemove', { clientX: 150 }));
      });

      act(() => {
        document.dispatchEvent(new MouseEvent('mouseup'));
      });

      expect(result.current.width).toBe(300);

      // Second drag
      act(() => {
        result.current.handleMouseDown({
          preventDefault: vi.fn(),
          clientX: 150,
        } as unknown as React.MouseEvent);
      });

      act(() => {
        document.dispatchEvent(new MouseEvent('mousemove', { clientX: 100 }));
      });

      act(() => {
        document.dispatchEvent(new MouseEvent('mouseup'));
      });

      expect(result.current.width).toBe(250); // 300 + (100 - 150) = 250
    });

    it('handles no optional parameters', () => {
      const { result } = renderHook(() =>
        useResizable({
          initialWidth: 250,
        })
      );

      expect(result.current.width).toBe(250);
      expect(result.current.isDragging).toBe(false);

      // Should work without onWidthChange
      const mouseDownEvent = {
        preventDefault: vi.fn(),
        clientX: 100,
      } as unknown as React.MouseEvent;

      act(() => {
        result.current.handleMouseDown(mouseDownEvent);
      });

      act(() => {
        document.dispatchEvent(new MouseEvent('mousemove', { clientX: 150 }));
      });

      expect(result.current.width).toBe(300);
    });
  });
});
