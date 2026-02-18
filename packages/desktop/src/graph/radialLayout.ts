/**
 * radialLayout.ts — Radial/circular layout for MiniGraph.
 *
 * Places the center node at (0, 0) and distributes connected nodes in
 * concentric rings based on BFS distance from the center.
 *
 * - Ring 0 (radius = 0): center node only
 * - Ring 1 (radius = radius * 0.45): direct neighbors
 * - Ring 2 (radius = radius * 0.80): 2-hop neighbors
 * - Ring N: subsequent rings spaced evenly up to the provided radius
 *
 * Nodes unreachable from center are placed in an outer ring.
 *
 * All functions are pure — safe for unit testing without mocks.
 */

export interface GraphNode {
  id: string;
  title?: string;
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface Position {
  x: number;
  y: number;
}

// ---------------------------------------------------------------------------
// Adjacency list (undirected)
// ---------------------------------------------------------------------------

function buildAdjacency(edges: GraphEdge[]): Map<string, string[]> {
  const adj = new Map<string, string[]>();

  const add = (from: string, to: string): void => {
    const list = adj.get(from) ?? [];
    list.push(to);
    adj.set(from, list);
  };

  for (const edge of edges) {
    add(edge.source, edge.target);
    add(edge.target, edge.source);
  }

  return adj;
}

// ---------------------------------------------------------------------------
// BFS ring assignment
// ---------------------------------------------------------------------------

/**
 * Return a map from nodeId → BFS distance from centerNodeId.
 * Unreachable nodes get distance = Infinity.
 */
function bfsDistances(
  centerNodeId: string,
  nodes: GraphNode[],
  edges: GraphEdge[]
): Map<string, number> {
  const adj = buildAdjacency(edges);
  const distances = new Map<string, number>();

  distances.set(centerNodeId, 0);
  // Use a head pointer instead of Array.shift() to keep BFS O(V+E).
  let head = 0;
  const queue: string[] = [centerNodeId];

  while (head < queue.length) {
    const current = queue[head++]!;
    const currentDist = distances.get(current) ?? 0;

    for (const neighbor of adj.get(current) ?? []) {
      if (!distances.has(neighbor)) {
        distances.set(neighbor, currentDist + 1);
        queue.push(neighbor);
      }
    }
  }

  // Mark unreachable nodes
  for (const node of nodes) {
    if (!distances.has(node.id)) {
      distances.set(node.id, Infinity);
    }
  }

  return distances;
}

// ---------------------------------------------------------------------------
// Ring radii
// ---------------------------------------------------------------------------

const RING_SCALE = [0, 0.45, 0.80, 1.0];

function getRingRadius(ringIndex: number, maxRadius: number): number {
  if (ringIndex === 0) return 0;
  if (ringIndex < RING_SCALE.length) {
    return maxRadius * (RING_SCALE[ringIndex] ?? 1.0);
  }
  // For deeper rings, extrapolate beyond the defined scale
  return maxRadius * Math.min(1.0, 0.80 + (ringIndex - 2) * 0.15);
}

// ---------------------------------------------------------------------------
// Position computation
// ---------------------------------------------------------------------------

/**
 * Compute a radial layout for a MiniGraph.
 *
 * The center node is placed at (0, 0). Other nodes are arranged in
 * concentric rings according to BFS distance from the center.
 *
 * @param centerNodeId - The node to place at the center
 * @param nodes - All graph nodes
 * @param edges - All graph edges (treated as undirected)
 * @param radius - Outer radius in pixels; ring radii are fractions of this
 * @returns Map from nodeId → {x, y} position
 */
export function computeRadialLayout(
  centerNodeId: string,
  nodes: GraphNode[],
  edges: GraphEdge[],
  radius: number
): Map<string, Position> {
  const positions = new Map<string, Position>();

  if (nodes.length === 0) return positions;

  // Place center node
  positions.set(centerNodeId, { x: 0, y: 0 });

  if (nodes.length === 1) return positions;

  // Compute BFS distances
  const distances = bfsDistances(centerNodeId, nodes, edges);

  // Group nodes by ring (BFS distance)
  const rings = new Map<number, string[]>();
  for (const node of nodes) {
    if (node.id === centerNodeId) continue;

    const dist = distances.get(node.id) ?? Infinity;
    const ringIdx = isFinite(dist) ? dist : Math.max(...(Array.from(rings.keys()))) + 1;

    const ring = rings.get(ringIdx) ?? [];
    ring.push(node.id);
    rings.set(ringIdx, ring);
  }

  // Place nodes in rings
  for (const [ringIdx, ringNodes] of rings.entries()) {
    const ringRadius = getRingRadius(ringIdx, radius);

    if (ringNodes.length === 1) {
      // Single node — place at top of ring
      positions.set(ringNodes[0]!, { x: 0, y: -ringRadius });
      continue;
    }

    // Distribute evenly around the ring
    // Offset by -π/2 so first node starts at top
    const angleStep = (2 * Math.PI) / ringNodes.length;
    const angleOffset = -Math.PI / 2;

    ringNodes.forEach((nodeId, i) => {
      const angle = angleOffset + i * angleStep;
      positions.set(nodeId, {
        x: Math.cos(angle) * ringRadius,
        y: Math.sin(angle) * ringRadius,
      });
    });
  }

  return positions;
}
