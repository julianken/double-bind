/**
 * shortestPath.ts — BFS shortest path between two graph nodes.
 *
 * Pure function, no side effects. Treats edges as undirected for path finding
 * (a path from A to B is valid even if only B→A edge exists, since we want
 * to highlight reachability, not directed traversal).
 *
 * All functions are pure — safe for unit testing without mocks.
 */

export interface GraphEdge {
  source: string;
  target: string;
}

// ---------------------------------------------------------------------------
// Adjacency list builder
// ---------------------------------------------------------------------------

/**
 * Build an undirected adjacency list from directed edges.
 */
function buildAdjacencyList(edges: GraphEdge[]): Map<string, string[]> {
  const adj = new Map<string, string[]>();

  const addEdge = (from: string, to: string): void => {
    const neighbors = adj.get(from) ?? [];
    neighbors.push(to);
    adj.set(from, neighbors);
  };

  for (const edge of edges) {
    addEdge(edge.source, edge.target);
    addEdge(edge.target, edge.source);
  }

  return adj;
}

// ---------------------------------------------------------------------------
// BFS
// ---------------------------------------------------------------------------

/**
 * Find the shortest path between source and target using BFS.
 *
 * Treats the graph as undirected (both edge directions are traversable).
 * Returns the node IDs forming the path including source and target,
 * or an empty array if no path exists.
 *
 * @param source - Starting node ID
 * @param target - Destination node ID
 * @param edges - All graph edges (direction is ignored)
 * @returns Array of node IDs from source to target (inclusive), or [] if unreachable
 *
 * @example
 * findShortestPath('a', 'c', [{ source: 'a', target: 'b' }, { source: 'b', target: 'c' }])
 * // => ['a', 'b', 'c']
 */
export function findShortestPath(
  source: string,
  target: string,
  edges: GraphEdge[]
): string[] {
  // Trivial case: source equals target
  if (source === target) return [source];

  const adj = buildAdjacencyList(edges);

  // BFS queue: each entry is the current node id
  const queue: string[] = [source];
  // Track visited nodes and their predecessors for path reconstruction
  const prev = new Map<string, string | null>();
  prev.set(source, null);

  while (queue.length > 0) {
    const current = queue.shift()!;

    const neighbors = adj.get(current) ?? [];
    for (const neighbor of neighbors) {
      if (prev.has(neighbor)) continue; // already visited

      prev.set(neighbor, current);

      if (neighbor === target) {
        // Reconstruct path
        return reconstructPath(prev, source, target);
      }

      queue.push(neighbor);
    }
  }

  // No path found
  return [];
}

/**
 * Reconstruct the path from source to target using the predecessor map.
 */
function reconstructPath(
  prev: Map<string, string | null>,
  source: string,
  target: string
): string[] {
  const path: string[] = [];
  let current: string | null = target;

  while (current !== null) {
    path.unshift(current);
    if (current === source) break;
    current = prev.get(current) ?? null;
  }

  // Sanity check: path must start at source
  if (path[0] !== source) return [];

  return path;
}

// ---------------------------------------------------------------------------
// Edge set helpers for rendering
// ---------------------------------------------------------------------------

/**
 * Given a path (array of node IDs), return a Set of edge keys for fast
 * lookup during canvas rendering.
 *
 * Edge keys are bidirectional: both "a->b" and "b->a" are added.
 *
 * @param path - Array of node IDs forming a path
 * @returns Set of "source->target" strings
 */
export function pathToEdgeSet(path: string[]): Set<string> {
  const edgeSet = new Set<string>();
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]!;
    const b = path[i + 1]!;
    edgeSet.add(`${a}->${b}`);
    edgeSet.add(`${b}->${a}`);
  }
  return edgeSet;
}
