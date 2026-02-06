# @double-bind/graph-algorithms

## Purpose

Implements network science algorithms for knowledge graph analysis (CS Contribution #2). Provides algorithms that CozoDB doesn't have built-in, plus TypeScript wrappers around CozoDB's built-in algorithms for a unified API.

## Public API

### Graph Data Structure

```typescript
interface Graph {
  nodes: string[];          // Node IDs (page IDs)
  edges: [string, string][]; // [source, target] pairs
  weights?: Map<string, number>; // Optional edge weights
}

// Build from CozoDB query results
function buildGraph(links: Link[]): Graph;
```

### CozoDB Built-In Wrappers

These generate CozoScript that invokes CozoDB's native algorithms:

```typescript
// Returns CozoScript for PageRank computation
function pageRankQuery(options?: { damping?: number; iterations?: number }): string;

// Returns CozoScript for community detection
function communityDetectionQuery(algorithm?: 'louvain' | 'label_propagation'): string;

// Returns CozoScript for betweenness centrality
function betweennessCentralityQuery(): string;

// Returns CozoScript for shortest path
function shortestPathQuery(from: string, to: string): { script: string; params: Record<string, unknown> };

// Returns CozoScript for connected components
function connectedComponentsQuery(): string;
```

### TypeScript Algorithms

Algorithms implemented in TypeScript (not available in CozoDB):

```typescript
// Link prediction: suggest missing edges
function predictLinks(graph: Graph, topK?: number): Array<{
  source: string;
  target: string;
  score: number;
  method: 'common_neighbors' | 'adamic_adar' | 'jaccard';
}>;

// Common neighbors score
function commonNeighbors(graph: Graph, a: string, b: string): number;

// Adamic-Adar index
function adamicAdar(graph: Graph, a: string, b: string): number;

// Jaccard similarity
function jaccardSimilarity(graph: Graph, a: string, b: string): number;

// Knowledge gap detection
function findKnowledgeGaps(graph: Graph): Array<{
  nodeId: string;
  neighborDensity: number;
  ownDensity: number;
  gapScore: number;
}>;

// Topic drift detection
function detectTopicDrift(graph: Graph, communities: Map<string, number>): Array<{
  nodeId: string;
  originalCommunity: number;
  currentLinkCommunity: number;
  driftScore: number;
}>;

// Graph statistics
function graphStats(graph: Graph): {
  nodeCount: number;
  edgeCount: number;
  density: number;
  averageDegree: number;
  maxDegree: number;
  connectedComponents: number;
  isolatedNodes: number;
};
```

## Internal Structure

```
packages/graph-algorithms/src/
├── index.ts              # Barrel export
├── types.ts              # Graph, algorithm result types
├── graph.ts              # Graph construction and utilities
├── cozo-queries/
│   ├── pagerank.ts       # CozoScript generation for PageRank
│   ├── community.ts      # CozoScript for community detection
│   ├── centrality.ts     # CozoScript for centrality measures
│   ├── paths.ts          # CozoScript for shortest paths
│   └── components.ts     # CozoScript for connected components
├── link-prediction/
│   ├── common-neighbors.ts
│   ├── adamic-adar.ts
│   └── jaccard.ts
├── analysis/
│   ├── knowledge-gaps.ts
│   ├── topic-drift.ts
│   └── stats.ts
└── utils/
    └── adjacency.ts      # Adjacency list builder for efficient traversal
```

## Dependencies

- `@double-bind/types` (for Link type, PageId)

No external algorithm libraries. All algorithms are implemented from scratch for:
- Zero additional dependencies
- Educational transparency (code is the documentation)
- Customization for PKM-specific needs

## Testing

- Verify each algorithm against known results on standard test graphs (Zachary's karate club, small-world networks)
- Verify CozoScript generation produces valid syntax
- Benchmark at various scales (100, 1000, 10000 nodes)
- Property-based tests (PageRank scores sum to 1, community labels are consistent, etc.)

<!-- TODO: Define which CozoDB graph algorithms are available in target version -->
<!-- TODO: Define edge weight strategy (link recency, frequency, type) -->
<!-- TODO: Define algorithm result caching strategy -->
<!-- TODO: Benchmark TypeScript algorithms vs CozoDB built-in for comparable operations -->
<!-- TODO: Evaluate incremental computation (update scores without full recomputation) -->
