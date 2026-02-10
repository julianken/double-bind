/**
 * useAnimatedLayout - Smoothly animate node positions when layout changes.
 *
 * When the center node changes and the force layout recalculates,
 * this hook interpolates all nodes from their previous positions
 * to their new positions using requestAnimationFrame.
 *
 * Animation sequence: fade out labels → move nodes → fade in labels
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type { LayoutNode } from './types';

/** Animation configuration */
const LAYOUT_ANIMATION = {
  /** Duration of label fade out in ms */
  FADE_OUT_DURATION: 150,
  /** Duration of node movement in ms */
  MOVE_DURATION: 350,
  /** Duration of label fade in in ms */
  FADE_IN_DURATION: 200,
} as const;

/** Animation phase for coordinating label visibility */
export type AnimationPhase = 'idle' | 'fading-out' | 'moving' | 'fading-in';

/** Position data for a single node */
interface NodePosition {
  x: number;
  y: number;
}

/** Return type for useAnimatedLayout */
export interface AnimatedLayoutResult {
  /** Nodes with interpolated positions during animation */
  nodes: LayoutNode[];
  /** Current animation phase for label coordination */
  phase: AnimationPhase;
}

/** Easing function - ease out cubic for natural deceleration */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Hook to animate layout transitions when nodes move.
 *
 * Returns interpolated node positions that smoothly transition
 * from previous to new positions when centerNodeId changes.
 * Also returns animation phase for coordinating label fade.
 */
export function useAnimatedLayout(
  layoutNodes: LayoutNode[],
  centerNodeId: string
): AnimatedLayoutResult {
  // Current animated positions (what we render)
  const [animatedNodes, setAnimatedNodes] = useState<LayoutNode[]>(layoutNodes);
  const [phase, setPhase] = useState<AnimationPhase>('idle');

  // Refs for animation state (avoid recreating callbacks)
  const layoutNodesRef = useRef<LayoutNode[]>(layoutNodes);
  const previousPositions = useRef<Map<string, NodePosition>>(new Map());
  const targetPositions = useRef<Map<string, NodePosition>>(new Map());
  const animationRef = useRef<number | null>(null);
  const phaseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeRef = useRef<number>(0);
  const previousCenterId = useRef<string>(centerNodeId);
  const isAnimatingRef = useRef<boolean>(false);

  // Keep layoutNodes ref updated
  layoutNodesRef.current = layoutNodes;

  // Animation loop for node movement - reads from refs
  const runMoveAnimation = useCallback(() => {
    const elapsed = Date.now() - startTimeRef.current;
    const progress = Math.min(elapsed / LAYOUT_ANIMATION.MOVE_DURATION, 1);
    const easedProgress = easeOutCubic(progress);

    // Interpolate all node positions using current layoutNodes from ref
    const nodes = layoutNodesRef.current;
    const interpolatedNodes: LayoutNode[] = [];

    for (const node of nodes) {
      const prev = previousPositions.current.get(node.id);
      const target = targetPositions.current.get(node.id);

      if (prev && target) {
        interpolatedNodes.push({
          ...node,
          x: prev.x + (target.x - prev.x) * easedProgress,
          y: prev.y + (target.y - prev.y) * easedProgress,
        });
      } else {
        // New node - use target position directly
        interpolatedNodes.push(node);
      }
    }

    setAnimatedNodes(interpolatedNodes);

    if (progress < 1) {
      animationRef.current = requestAnimationFrame(runMoveAnimation);
    } else {
      // Movement complete - start fade in
      previousPositions.current = new Map(targetPositions.current);
      animationRef.current = null;
      setPhase('fading-in');

      // After fade in, return to idle
      phaseTimeoutRef.current = setTimeout(() => {
        setPhase('idle');
        isAnimatingRef.current = false;
        phaseTimeoutRef.current = null;
      }, LAYOUT_ANIMATION.FADE_IN_DURATION);
    }
  }, []);

  // Start the movement phase
  const startMovement = useCallback(() => {
    setPhase('moving');
    startTimeRef.current = Date.now();
    animationRef.current = requestAnimationFrame(runMoveAnimation);
  }, [runMoveAnimation]);

  // Handle center node changes - this starts the animation sequence
  useEffect(() => {
    const centerChanged = previousCenterId.current !== centerNodeId;
    previousCenterId.current = centerNodeId;

    if (!centerChanged) return;

    // Cancel any running animation or timeout
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (phaseTimeoutRef.current !== null) {
      clearTimeout(phaseTimeoutRef.current);
      phaseTimeoutRef.current = null;
    }

    // Mark that we're animating (prevents snap effect from firing)
    isAnimatingRef.current = true;

    // Capture current positions as starting point
    const currentPositions = new Map<string, NodePosition>();
    for (const node of animatedNodes) {
      currentPositions.set(node.id, { x: node.x, y: node.y });
    }
    previousPositions.current = currentPositions;

    // Build target positions from new layout
    const newTargets = new Map<string, NodePosition>();
    for (const node of layoutNodes) {
      newTargets.set(node.id, { x: node.x, y: node.y });
    }
    targetPositions.current = newTargets;

    // Start sequence: fade out labels first (nodes stay in place)
    setPhase('fading-out');

    // After fade out completes, start node movement
    phaseTimeoutRef.current = setTimeout(() => {
      startMovement();
    }, LAYOUT_ANIMATION.FADE_OUT_DURATION);

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
      if (phaseTimeoutRef.current !== null) {
        clearTimeout(phaseTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerNodeId]); // Only trigger on center change

  // Handle layout changes that aren't center changes (e.g., nodes added/removed)
  // This should NOT fire during animation sequence
  useEffect(() => {
    // Don't snap if we're in the middle of an animation sequence
    if (isAnimatingRef.current) return;

    // If no animation running and layout changed, snap to new positions
    if (animationRef.current === null && phase === 'idle') {
      const newTargets = new Map<string, NodePosition>();
      for (const node of layoutNodes) {
        newTargets.set(node.id, { x: node.x, y: node.y });
      }
      targetPositions.current = newTargets;
      previousPositions.current = newTargets;
      setAnimatedNodes(layoutNodes);
    }
  }, [layoutNodes, phase]);

  return { nodes: animatedNodes, phase };
}
