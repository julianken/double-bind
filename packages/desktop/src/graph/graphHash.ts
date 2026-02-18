/**
 * graphHash.ts — Community assignment via connected-component analysis.
 *
 * Assigns each node to a community (non-negative integer) using a union-find
 * algorithm on the undirected projection of the graph. This is a visualization
 * aid: nodes in the same weakly-connected component share a community id.
 *
 * For denser graphs where all nodes are in one large component, a secondary
 * heuristic applies: nodes are subdivided by degree quintile so the community
 * palette is actually exercised.
 *
 * All functions are pure and have no side-effects — safe for unit testing.
 */

// ---------------------------------------------------------------------------
// Types (intentionally minimal — mirrors GraphNode/GraphEdge from ui-primitives
// without creating a package dependency)
// ---------------------------------------------------------------------------

export interface GraphNode {
  id: string;
  title?: string;
}

export interface GraphEdge {
  source: string;
  target: string;
}

// ---------------------------------------------------------------------------
// Union-Find (path-compressed)
// ---------------------------------------------------------------------------

class UnionFind {
  private parent: Map<string, string> = new Map();
  private rank: Map<string, number> = new Map();

  add(id: string): void {
    if (!this.parent.has(id)) {
      this.parent.set(id, id);
      this.rank.set(id, 0);
    }
  }

  find(id: string): string {
    const p = this.parent.get(id);
    if (p === undefined) return id;
    if (p === id) return id;
    const root = this.find(p);
    this.parent.set(id, root); // path compression
    return root;
  }

  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return;

    const rankA = this.rank.get(ra) ?? 0;
    const rankB = this.rank.get(rb) ?? 0;

    if (rankA < rankB) {
      this.parent.set(ra, rb);
    } else if (rankA > rankB) {
      this.parent.set(rb, ra);
    } else {
      this.parent.set(rb, ra);
      this.rank.set(ra, rankA + 1);
    }
  }

  /** Returns a map from root → component index (0-based, sorted by size desc). */
  buildComponentMap(): Map<string, number> {
    // Group nodes by root
    const groups = new Map<string, string[]>();
    for (const id of this.parent.keys()) {
      const root = this.find(id);
      const group = groups.get(root) ?? [];
      group.push(id);
      groups.set(root, group);
    }

    // Sort groups by size descending so the largest cluster is community 0
    const sorted = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);

    const result = new Map<string, number>();
    sorted.forEach(([root, members], idx) => {
      for (const id of members) {
        result.set(id, idx);
      }
      void root; // suppress unused variable warning
    });
    return result;
  }
}

// ---------------------------------------------------------------------------
// Degree computation
// ---------------------------------------------------------------------------

function buildDegreeMap(nodes: GraphNode[], edges: GraphEdge[]): Map<string, number> {
  const degree = new Map<string, number>(nodes.map((n) => [n.id, 0]));
  for (const edge of edges) {
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
  }
  return degree;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Assign each node to a community index based on graph structure.
 *
 * Algorithm:
 * 1. Run union-find on undirected edges to find weakly connected components.
 * 2. If >80% of nodes are in a single component (dense graph), fall back to
 *    degree-quintile subdivision to ensure the color palette is used.
 *
 * @param nodes - Array of graph nodes
 * @param edges - Array of directed edges (treated as undirected here)
 * @returns Map from node id → community index (0-based)
 */
export function assignCommunities(
  nodes: GraphNode[],
  edges: GraphEdge[]
): Map<string, number> {
  if (nodes.length === 0) return new Map();

  const uf = new UnionFind();

  // Initialise all nodes
  for (const node of nodes) {
    uf.add(node.id);
  }

  // Union edges (undirected projection)
  for (const edge of edges) {
    uf.add(edge.source);
    uf.add(edge.target);
    uf.union(edge.source, edge.target);
  }

  const componentMap = uf.buildComponentMap();

  // Check if most nodes collapsed into a single component
  const componentCounts = new Map<number, number>();
  for (const community of componentMap.values()) {
    componentCounts.set(community, (componentCounts.get(community) ?? 0) + 1);
  }

  const largestComponentSize = Math.max(...componentCounts.values());
  const singleComponentRatio = largestComponentSize / nodes.length;

  // Dense graph: fall back to degree-quintile heuristic for visual variety
  if (singleComponentRatio > 0.8 && nodes.length > 4) {
    return assignByDegreeQuintile(nodes, edges);
  }

  return componentMap;
}

/**
 * Fallback: assign community by degree quintile (0-7).
 * Used for dense graphs where connected-component analysis is not useful.
 */
function assignByDegreeQuintile(
  nodes: GraphNode[],
  edges: GraphEdge[]
): Map<string, number> {
  const degree = buildDegreeMap(nodes, edges);
  const sorted = [...nodes].sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0));

  const result = new Map<string, number>();
  const numBuckets = 8;
  sorted.forEach((node, idx) => {
    const bucket = Math.min(Math.floor((idx / sorted.length) * numBuckets), numBuckets - 1);
    result.set(node.id, bucket);
  });

  return result;
}
