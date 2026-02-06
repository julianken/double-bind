/**
 * useResizable - Hook for drag-to-resize functionality
 *
 * Provides mouse event handling for resizable UI elements.
 * Tracks drag state and calculates new widths based on mouse movement.
 *
 * TECH DEBT: This hook should be moved to @double-bind/ui-primitives package
 * once that package exists. Currently placed here following the pattern from
 * DBB-157. See docs/packages/ui-primitives.md for planned package structure.
 */

import { useCallback, useRef, useState, useEffect } from 'react';

export interface UseResizableOptions {
  /** Initial width in pixels */
  initialWidth: number;
  /** Minimum width constraint in pixels */
  minWidth?: number;
  /** Maximum width constraint in pixels */
  maxWidth?: number;
  /** Callback when width changes during drag */
  onWidthChange?: (width: number) => void;
  /** Callback when drag ends */
  onDragEnd?: (width: number) => void;
}

export interface UseResizableResult {
  /** Current width value */
  width: number;
  /** Whether currently dragging */
  isDragging: boolean;
  /** Mouse down handler for the drag handle */
  handleMouseDown: (e: React.MouseEvent) => void;
  /** Set width programmatically */
  setWidth: (width: number) => void;
}

/**
 * Hook for implementing drag-to-resize functionality.
 *
 * @example
 * ```tsx
 * const { width, isDragging, handleMouseDown } = useResizable({
 *   initialWidth: 250,
 *   minWidth: 150,
 *   maxWidth: 500,
 *   onWidthChange: (w) => store.setSidebarWidth(w),
 * });
 * ```
 */
export function useResizable(options: UseResizableOptions): UseResizableResult {
  const { initialWidth, minWidth = 0, maxWidth = Infinity, onWidthChange, onDragEnd } = options;

  const [width, setWidthState] = useState(initialWidth);
  const [isDragging, setIsDragging] = useState(false);

  // Use refs to track drag state without causing re-renders
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  const prevInitialWidthRef = useRef(initialWidth);

  // Clamp width to constraints
  const clampWidth = useCallback(
    (w: number): number => {
      return Math.min(Math.max(w, minWidth), maxWidth);
    },
    [minWidth, maxWidth]
  );

  // Set width with clamping
  const setWidth = useCallback(
    (newWidth: number) => {
      const clamped = clampWidth(newWidth);
      setWidthState(clamped);
    },
    [clampWidth]
  );

  // Handle mouse move during drag
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      const delta = e.clientX - startXRef.current;
      const newWidth = clampWidth(startWidthRef.current + delta);

      setWidthState(newWidth);
      onWidthChange?.(newWidth);
    },
    [clampWidth, onWidthChange]
  );

  // Handle mouse up to end drag
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);

    // Get current width for callback
    const finalWidth = clampWidth(startWidthRef.current + 0);
    onDragEnd?.(finalWidth);
  }, [clampWidth, onDragEnd]);

  // Handle mouse down on drag handle
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      startXRef.current = e.clientX;
      startWidthRef.current = width;
      setIsDragging(true);
    },
    [width]
  );

  // Attach/detach global mouse event listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Sync with external width changes (e.g., from store)
  // Only sync when initialWidth prop actually changes, not when internal width changes
  useEffect(() => {
    if (!isDragging && initialWidth !== prevInitialWidthRef.current) {
      setWidthState(initialWidth);
      prevInitialWidthRef.current = initialWidth;
    }
  }, [initialWidth, isDragging]);

  return {
    width,
    isDragging,
    handleMouseDown,
    setWidth,
  };
}
