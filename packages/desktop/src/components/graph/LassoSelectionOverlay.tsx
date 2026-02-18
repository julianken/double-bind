/**
 * LassoSelectionOverlay — SVG overlay for freeform lasso selection on the graph canvas.
 *
 * Renders an invisible SVG that sits on top of the canvas. The user can click-and-drag
 * to draw a freeform polygon. On mouseup, the component calls onSelectionComplete with
 * the polygon points so the parent can determine which nodes fall inside.
 *
 * Visual feedback: semi-transparent fill with a 1px dashed border while drawing.
 */

import { useCallback, useRef, useState } from 'react';
import styles from './LassoSelectionOverlay.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Point {
  x: number;
  y: number;
}

export interface LassoSelectionOverlayProps {
  /** Width of the overlay (should match canvas width) */
  width: number;
  /** Height of the overlay (should match canvas height) */
  height: number;
  /**
   * Called when the user releases the mouse after drawing a lasso.
   * Receives the polygon points in canvas-relative coordinates.
   * If the polygon is too small (accidental click), this is not called.
   */
  onSelectionComplete: (polygon: Point[]) => void;
  /** Whether lasso selection is enabled. When false, mouse events pass through. */
  enabled?: boolean;
}

// ---------------------------------------------------------------------------
// Geometry helper
// ---------------------------------------------------------------------------

/** Minimum lasso area in px² before the selection is considered intentional. */
const MIN_LASSO_AREA = 100;

/** Compute approximate polygon area using the shoelace formula. */
function polygonArea(points: Point[]): number {
  if (points.length < 3) return 0;
  let area = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const { x: x1, y: y1 } = points[i]!;
    const { x: x2, y: y2 } = points[(i + 1) % n]!;
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area) / 2;
}

/**
 * Test whether a point is inside a polygon using ray-casting algorithm.
 */
export function pointInPolygon(point: Point, polygon: Point[]): boolean {
  const { x, y } = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i]!.x;
    const yi = polygon[i]!.y;
    const xj = polygon[j]!.x;
    const yj = polygon[j]!.y;

    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * SVG lasso selection overlay.
 *
 * @example
 * ```tsx
 * <div style={{ position: 'relative' }}>
 *   <canvas ref={canvasRef} width={800} height={600} />
 *   <LassoSelectionOverlay
 *     width={800}
 *     height={600}
 *     enabled={lassoEnabled}
 *     onSelectionComplete={(polygon) => selectNodesInPolygon(polygon)}
 *   />
 * </div>
 * ```
 */
export function LassoSelectionOverlay({
  width,
  height,
  onSelectionComplete,
  enabled = true,
}: LassoSelectionOverlayProps) {
  const [points, setPoints] = useState<Point[]>([]);
  const isDrawingRef = useRef(false);

  const getRelativePoint = useCallback(
    (event: React.MouseEvent<SVGSVGElement>): Point => {
      const rect = event.currentTarget.getBoundingClientRect();
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
    },
    []
  );

  const handleMouseDown = useCallback(
    (event: React.MouseEvent<SVGSVGElement>) => {
      if (!enabled) return;
      // Only activate on left button drag
      if (event.button !== 0) return;
      event.stopPropagation();

      isDrawingRef.current = true;
      const point = getRelativePoint(event);
      setPoints([point]);
    },
    [enabled, getRelativePoint]
  );

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<SVGSVGElement>) => {
      if (!isDrawingRef.current || !enabled) return;
      event.stopPropagation();

      const point = getRelativePoint(event);
      setPoints((prev) => [...prev, point]);
    },
    [enabled, getRelativePoint]
  );

  const handleMouseUp = useCallback(
    (event: React.MouseEvent<SVGSVGElement>) => {
      if (!isDrawingRef.current || !enabled) return;
      event.stopPropagation();

      isDrawingRef.current = false;
      const finalPoints = [...points];
      setPoints([]);

      // Close the polygon and check if it's large enough to be intentional
      if (finalPoints.length >= 3 && polygonArea(finalPoints) >= MIN_LASSO_AREA) {
        onSelectionComplete(finalPoints);
      }
    },
    [enabled, points, onSelectionComplete]
  );

  const handleMouseLeave = useCallback(() => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    setPoints([]);
  }, []);

  // Build SVG polygon points string
  const polygonPointsStr = points.map((p) => `${p.x},${p.y}`).join(' ');
  const isActive = points.length > 1;

  return (
    <svg
      className={`${styles.overlay} ${enabled ? styles.overlayEnabled : ''}`}
      width={width}
      height={height}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      data-testid="lasso-overlay"
      aria-hidden="true"
    >
      {isActive && (
        <polygon
          className={styles.lasso}
          points={polygonPointsStr}
          data-testid="lasso-polygon"
        />
      )}
    </svg>
  );
}
