/**
 * useForceLayout - Force-directed layout algorithm for graph visualization.
 *
 * Implements a simple force simulation to position nodes:
 * - Repulsion between all nodes (charge force)
 * - Attraction along edges (link force)
 * - Centering force to keep graph centered
 *
 * Optimized for mobile performance with limited iterations.
 */

import { useMemo } from 'react';
import type { MobileGraphNode, MobileGraphEdge, LayoutNode } from './types';

// Force simulation parameters
const SIMULATION_PARAMS = {
  /** Number of iterations for initial layout */
  ITERATIONS: 100,
  /** Strength of repulsion between nodes */
  CHARGE_STRENGTH: -300,
  /** Optimal distance for linked nodes */
  LINK_DISTANCE: 80,
  /** Strength of link attraction */
  LINK_STRENGTH: 0.3,
  /** Strength of centering force */
  CENTER_STRENGTH: 0.1,
  /** Velocity decay per iteration */
  VELOCITY_DECAY: 0.6,
  /** Minimum distance to prevent division by zero */
  MIN_DISTANCE: 1,
} as const;

/**
 * Initialize nodes with positions if not provided.
 * Places nodes in a circle initially for better convergence.
 */
function initializeNodes(
  nodes: MobileGraphNode[],
  width: number,
  height: number,
  centerNodeId: string
): LayoutNode[] {
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.3;

  return nodes.map((node, index) => {
    // If position is provided, use it
    if (node.x !== undefined && node.y !== undefined) {
      return {
        ...node,
        x: node.x,
        y: node.y,
        vx: 0,
        vy: 0,
      };
    }

    // Place center node at center
    if (node.id === centerNodeId) {
      return {
        ...node,
        x: centerX,
        y: centerY,
        vx: 0,
        vy: 0,
      };
    }

    // Place other nodes in a circle with some randomness
    const angle = (2 * Math.PI * index) / nodes.length;
    const jitter = (Math.random() - 0.5) * 20;
    return {
      ...node,
      x: centerX + Math.cos(angle) * radius + jitter,
      y: centerY + Math.sin(angle) * radius + jitter,
      vx: 0,
      vy: 0,
    };
  });
}

/**
 * Apply charge (repulsion) force between all node pairs.
 */
function applyChargeForce(nodes: LayoutNode[]): void {
  const n = nodes.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const nodeA = nodes[i];
      const nodeB = nodes[j];

      const dx = nodeB.x - nodeA.x;
      const dy = nodeB.y - nodeA.y;
      const distance = Math.max(Math.sqrt(dx * dx + dy * dy), SIMULATION_PARAMS.MIN_DISTANCE);

      // Repulsion force (inverse square law)
      const force = SIMULATION_PARAMS.CHARGE_STRENGTH / (distance * distance);
      const fx = (dx / distance) * force;
      const fy = (dy / distance) * force;

      nodeA.vx -= fx;
      nodeA.vy -= fy;
      nodeB.vx += fx;
      nodeB.vy += fy;
    }
  }
}

/**
 * Apply link force to attract connected nodes.
 */
function applyLinkForce(
  nodes: LayoutNode[],
  edges: MobileGraphEdge[],
  nodeMap: Map<string, LayoutNode>
): void {
  for (const edge of edges) {
    const source = nodeMap.get(edge.source);
    const target = nodeMap.get(edge.target);

    if (!source || !target) continue;

    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const distance = Math.max(Math.sqrt(dx * dx + dy * dy), SIMULATION_PARAMS.MIN_DISTANCE);

    // Spring force toward optimal distance
    const displacement = distance - SIMULATION_PARAMS.LINK_DISTANCE;
    const force = displacement * SIMULATION_PARAMS.LINK_STRENGTH;
    const fx = (dx / distance) * force;
    const fy = (dy / distance) * force;

    source.vx += fx;
    source.vy += fy;
    target.vx -= fx;
    target.vy -= fy;
  }
}

/**
 * Apply centering force to keep graph centered.
 */
function applyCenterForce(nodes: LayoutNode[], centerX: number, centerY: number): void {
  for (const node of nodes) {
    const dx = centerX - node.x;
    const dy = centerY - node.y;

    node.vx += dx * SIMULATION_PARAMS.CENTER_STRENGTH;
    node.vy += dy * SIMULATION_PARAMS.CENTER_STRENGTH;
  }
}

/**
 * Update node positions based on velocities.
 */
function updatePositions(nodes: LayoutNode[]): void {
  for (const node of nodes) {
    // Apply velocity with decay
    node.x += node.vx;
    node.y += node.vy;
    node.vx *= SIMULATION_PARAMS.VELOCITY_DECAY;
    node.vy *= SIMULATION_PARAMS.VELOCITY_DECAY;
  }
}

/**
 * Run the force simulation for a fixed number of iterations.
 */
function runSimulation(
  nodes: LayoutNode[],
  edges: MobileGraphEdge[],
  width: number,
  height: number
): void {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const centerX = width / 2;
  const centerY = height / 2;

  for (let i = 0; i < SIMULATION_PARAMS.ITERATIONS; i++) {
    applyChargeForce(nodes);
    applyLinkForce(nodes, edges, nodeMap);
    applyCenterForce(nodes, centerX, centerY);
    updatePositions(nodes);
  }
}

/**
 * Hook to compute force-directed layout for graph nodes.
 *
 * @param nodes - Array of graph nodes
 * @param edges - Array of graph edges
 * @param width - Container width
 * @param height - Container height
 * @param centerNodeId - ID of the center node
 * @returns Laid out nodes with computed positions
 */
export function useForceLayout(
  nodes: MobileGraphNode[],
  edges: MobileGraphEdge[],
  width: number,
  height: number,
  centerNodeId: string
): LayoutNode[] {
  return useMemo(() => {
    if (nodes.length === 0 || width === 0 || height === 0) {
      return [];
    }

    // Initialize and run simulation
    const layoutNodes = initializeNodes(nodes, width, height, centerNodeId);
    runSimulation(layoutNodes, edges, width, height);

    return layoutNodes;
  }, [nodes, edges, width, height, centerNodeId]);
}

/**
 * Hook to get a node lookup map for efficient edge rendering.
 */
export function useNodeMap(nodes: LayoutNode[]): Map<string, LayoutNode> {
  return useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
}
