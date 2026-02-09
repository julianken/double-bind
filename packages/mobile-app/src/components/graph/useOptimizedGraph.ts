/**
 * useOptimizedGraph - Performance hook for graph rendering optimization.
 *
 * Implements:
 * - Level-of-detail (LOD) rendering based on zoom level
 * - Viewport culling to only render visible nodes
 * - Performance monitoring and frame rate tracking
 * - Throttled force simulation updates
 * - Node clustering for large graphs (>100 nodes)
 *
 * Target: 60fps on mobile devices during pan/zoom operations
 */

import { useMemo, useRef, useEffect, useState } from 'react';
import type { MobileGraphEdge, LayoutNode } from './types';

// ============================================================================
// Constants
// ============================================================================

/** Performance thresholds */
export const PERF_CONSTANTS = {
  /** Target frame rate (fps) */
  TARGET_FPS: 60,
  /** Frame time budget in ms (1000/60 ≈ 16.67ms) */
  FRAME_BUDGET_MS: 16.67,
  /** High node count threshold for clustering */
  CLUSTER_THRESHOLD: 100,
  /** Nodes per cluster when clustering is active */
  NODES_PER_CLUSTER: 5,
  /** Viewport padding for culling (as fraction of viewport size) */
  VIEWPORT_PADDING: 0.2,
  /** Throttle delay for force updates during interaction (ms) */
  FORCE_UPDATE_THROTTLE_MS: 50,
  /** Number of samples for FPS calculation */
  FPS_SAMPLE_SIZE: 10,
} as const;

/** LOD levels based on scale */
export const LOD_LEVELS = {
  /** Scale < 0.5: Ultra minimal (no labels, simplified nodes) */
  ULTRA_MINIMAL: 0.5,
  /** Scale 0.5-1.0: Minimal (center labels only) */
  MINIMAL: 1.0,
  /** Scale 1.0-1.5: Normal (all labels, normal edges) */
  NORMAL: 1.5,
  /** Scale > 1.5: Detailed (all features) */
  DETAILED: 1.5,
} as const;

// ============================================================================
// Types
// ============================================================================

/** LOD rendering mode */
export type LODMode = 'ultra-minimal' | 'minimal' | 'normal' | 'detailed';

/** Viewport bounds for culling */
export interface ViewportBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** Node cluster for large graphs */
export interface NodeCluster {
  id: string;
  nodeIds: Set<string>;
  centerX: number;
  centerY: number;
  size: number;
}

/** Performance metrics */
export interface PerformanceMetrics {
  /** Current frames per second */
  fps: number;
  /** Average frame time in ms */
  avgFrameTime: number;
  /** Number of visible nodes after culling */
  visibleNodeCount: number;
  /** Number of visible edges after culling */
  visibleEdgeCount: number;
  /** Whether clustering is active */
  isClustered: boolean;
  /** Current LOD mode */
  lodMode: LODMode;
}

/** Optimized graph data */
export interface OptimizedGraphData {
  /** Nodes to render (after culling and clustering) */
  visibleNodes: LayoutNode[];
  /** Edges to render (after culling) */
  visibleEdges: MobileGraphEdge[];
  /** Current LOD mode */
  lodMode: LODMode;
  /** Performance metrics */
  metrics: PerformanceMetrics;
  /** Whether to show labels based on LOD */
  showLabels: boolean;
  /** Whether to show all labels or just center */
  showAllLabels: boolean;
  /** Whether to show edge arrows */
  showEdgeArrows: boolean;
  /** Whether force simulation should be throttled */
  shouldThrottleForce: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Determine LOD mode based on scale.
 */
function getLODMode(scale: number): LODMode {
  if (scale < LOD_LEVELS.ULTRA_MINIMAL) return 'ultra-minimal';
  if (scale < LOD_LEVELS.MINIMAL) return 'minimal';
  if (scale < LOD_LEVELS.DETAILED) return 'normal';
  return 'detailed';
}

/**
 * Calculate viewport bounds with padding for culling.
 */
function calculateViewportBounds(
  width: number,
  height: number,
  translateX: number,
  translateY: number,
  scale: number
): ViewportBounds {
  const padding = PERF_CONSTANTS.VIEWPORT_PADDING;
  const paddedWidth = width * (1 + padding);
  const paddedHeight = height * (1 + padding);

  // Transform viewport bounds to graph coordinates
  const minX = (-translateX - paddedWidth / 2) / scale;
  const maxX = (-translateX + paddedWidth / 2) / scale;
  const minY = (-translateY - paddedHeight / 2) / scale;
  const maxY = (-translateY + paddedHeight / 2) / scale;

  return { minX, maxX, minY, maxY };
}

/**
 * Check if a node is within viewport bounds.
 */
function isNodeInViewport(node: LayoutNode, bounds: ViewportBounds): boolean {
  return (
    node.x >= bounds.minX && node.x <= bounds.maxX && node.y >= bounds.minY && node.y <= bounds.maxY
  );
}

/**
 * Cluster nodes using simple spatial bucketing.
 * Groups nearby nodes into clusters for rendering when graph is too large.
 */
function clusterNodes(nodes: LayoutNode[], centerNodeId: string): NodeCluster[] {
  if (nodes.length <= PERF_CONSTANTS.CLUSTER_THRESHOLD) {
    return [];
  }

  // Always keep center node visible (don't cluster it)
  const nodesToCluster = nodes.filter((n) => n.id !== centerNodeId);

  // Simple grid-based clustering
  const bucketSize = 100; // Grid cell size in pixels
  const buckets = new Map<string, LayoutNode[]>();

  for (const node of nodesToCluster) {
    const bucketX = Math.floor(node.x / bucketSize);
    const bucketY = Math.floor(node.y / bucketSize);
    const key = `${bucketX},${bucketY}`;

    if (!buckets.has(key)) {
      buckets.set(key, []);
    }
    buckets.get(key)!.push(node);
  }

  // Create clusters from buckets
  const clusters: NodeCluster[] = [];
  let clusterId = 0;

  for (const [, bucketNodes] of buckets) {
    if (bucketNodes.length === 0) continue;

    // Calculate cluster center
    const centerX = bucketNodes.reduce((sum, n) => sum + n.x, 0) / bucketNodes.length;
    const centerY = bucketNodes.reduce((sum, n) => sum + n.y, 0) / bucketNodes.length;

    clusters.push({
      id: `cluster-${clusterId++}`,
      nodeIds: new Set(bucketNodes.map((n) => n.id)),
      centerX,
      centerY,
      size: bucketNodes.length,
    });
  }

  return clusters;
}

/**
 * Simple performance timer that works in React Native.
 * Falls back to Date.now() if performance API is not available.
 */
const now = (): number => {
  if (
    typeof globalThis !== 'undefined' &&
    'performance' in globalThis &&
    globalThis.performance &&
    'now' in globalThis.performance
  ) {
    return (globalThis.performance as Performance).now();
  }
  return Date.now();
};

/**
 * FPS tracker using requestAnimationFrame.
 */
class FPSTracker {
  private frameTimes: number[] = [];
  private lastFrameTime: number = 0;
  private rafId: number | null = null;

  start(): void {
    this.frameTimes = [];
    this.lastFrameTime = now();
    this.tick();
  }

  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private tick = (): void => {
    const currentTime = now();
    const frameTime = currentTime - this.lastFrameTime;
    this.lastFrameTime = currentTime;

    this.frameTimes.push(frameTime);
    if (this.frameTimes.length > PERF_CONSTANTS.FPS_SAMPLE_SIZE) {
      this.frameTimes.shift();
    }

    this.rafId = requestAnimationFrame(this.tick);
  };

  getMetrics(): { fps: number; avgFrameTime: number } {
    if (this.frameTimes.length === 0) {
      return { fps: 60, avgFrameTime: 16.67 };
    }

    const avgFrameTime = this.frameTimes.reduce((sum, t) => sum + t, 0) / this.frameTimes.length;
    const fps = Math.round(1000 / avgFrameTime);

    return { fps, avgFrameTime };
  }
}

// ============================================================================
// Hook
// ============================================================================

export interface UseOptimizedGraphOptions {
  /** All graph nodes */
  nodes: LayoutNode[];
  /** All graph edges */
  edges: MobileGraphEdge[];
  /** Center node ID (always visible) */
  centerNodeId: string;
  /** Container dimensions */
  width: number;
  height: number;
  /** Current scale (zoom level) */
  scale: number;
  /** Current translation X */
  translateX: number;
  /** Current translation Y */
  translateY: number;
  /** Whether user is actively interacting (pan/zoom) */
  isInteracting?: boolean;
  /** Whether to enable performance monitoring */
  enableMetrics?: boolean;
}

/**
 * Hook for optimized graph rendering with LOD, culling, and clustering.
 *
 * @example
 * ```tsx
 * const optimized = useOptimizedGraph({
 *   nodes: layoutNodes,
 *   edges: visibleEdges,
 *   centerNodeId,
 *   width,
 *   height,
 *   scale: scale.value,
 *   translateX: translateX.value,
 *   translateY: translateY.value,
 *   isInteracting,
 *   enableMetrics: true,
 * });
 *
 * // Use optimized.visibleNodes instead of all nodes
 * // Check optimized.lodMode for rendering decisions
 * ```
 */
export function useOptimizedGraph(options: UseOptimizedGraphOptions): OptimizedGraphData {
  const {
    nodes,
    edges,
    centerNodeId,
    width,
    height,
    scale,
    translateX,
    translateY,
    isInteracting = false,
    enableMetrics = false,
  } = options;

  // FPS tracking
  const fpsTracker = useRef<FPSTracker | null>(null);
  const [metrics, setMetrics] = useState<Pick<PerformanceMetrics, 'fps' | 'avgFrameTime'>>({
    fps: 60,
    avgFrameTime: 16.67,
  });

  // Initialize FPS tracker
  useEffect(() => {
    if (enableMetrics && !fpsTracker.current) {
      fpsTracker.current = new FPSTracker();
      fpsTracker.current.start();

      // Update metrics periodically
      const interval = setInterval(() => {
        if (fpsTracker.current) {
          setMetrics(fpsTracker.current.getMetrics());
        }
      }, 1000);

      return () => {
        clearInterval(interval);
        if (fpsTracker.current) {
          fpsTracker.current.stop();
          fpsTracker.current = null;
        }
      };
    }
  }, [enableMetrics]);

  // Determine LOD mode
  const lodMode = useMemo(() => getLODMode(scale), [scale]);

  // Calculate viewport bounds for culling
  const viewportBounds = useMemo(
    () => calculateViewportBounds(width, height, translateX, translateY, scale),
    [width, height, translateX, translateY, scale]
  );

  // Apply viewport culling
  const visibleNodes = useMemo(() => {
    // Always include center node
    const culledNodes = nodes.filter((n) => {
      if (n.id === centerNodeId) return true;
      return isNodeInViewport(n, viewportBounds);
    });

    return culledNodes;
  }, [nodes, centerNodeId, viewportBounds]);

  // Filter edges to only visible nodes
  const visibleEdges = useMemo(() => {
    const _visibleNodeIds = new Set(visibleNodes.map((n) => n.id));
    return edges.filter((e) => _visibleNodeIds.has(e.source) && _visibleNodeIds.has(e.target));
  }, [edges, visibleNodes]);

  // Cluster nodes if graph is too large
  const clusters = useMemo(() => clusterNodes(nodes, centerNodeId), [nodes, centerNodeId]);

  // Determine rendering features based on LOD
  const showLabels = lodMode !== 'ultra-minimal';
  const showAllLabels = lodMode === 'normal' || lodMode === 'detailed';
  const showEdgeArrows = lodMode !== 'ultra-minimal';
  const shouldThrottleForce = isInteracting || visibleNodes.length > 50;

  // Build complete metrics
  const fullMetrics: PerformanceMetrics = useMemo(
    () => ({
      fps: metrics.fps,
      avgFrameTime: metrics.avgFrameTime,
      visibleNodeCount: visibleNodes.length,
      visibleEdgeCount: visibleEdges.length,
      isClustered: clusters.length > 0,
      lodMode,
    }),
    [metrics, visibleNodes.length, visibleEdges.length, clusters.length, lodMode]
  );

  return {
    visibleNodes,
    visibleEdges,
    lodMode,
    metrics: fullMetrics,
    showLabels,
    showAllLabels,
    showEdgeArrows,
    shouldThrottleForce,
  };
}

/**
 * Hook for throttled force simulation updates.
 * Returns true when simulation should update (throttled during interaction).
 */
export function useThrottledForceUpdate(isInteracting: boolean): boolean {
  const [shouldUpdate, setShouldUpdate] = useState(true);
  const lastUpdate = useRef(0);

  useEffect(() => {
    if (!isInteracting) {
      setShouldUpdate(true);
      return;
    }

    const currentTime = now();
    if (currentTime - lastUpdate.current >= PERF_CONSTANTS.FORCE_UPDATE_THROTTLE_MS) {
      setShouldUpdate(true);
      lastUpdate.current = currentTime;
    } else {
      setShouldUpdate(false);
    }
  }, [isInteracting]);

  return shouldUpdate;
}
