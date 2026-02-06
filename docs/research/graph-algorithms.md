# Contribution 2: Graph Algorithms for Personal Knowledge Management

## Thesis

Network science algorithms — originally developed for social networks, citation graphs, and biological networks — can provide actionable insights when applied to personal knowledge graphs, revealing structure that manual review cannot.

## Prior Art

### Graph Features in Existing PKM Tools

| Tool | Graph Features | Algorithm Support |
|------|---------------|-------------------|
| Roam Research | Graph visualization | None |
| Obsidian | Graph visualization, local graph | None (community plugin for basic stats) |
| Logseq | Graph visualization | None |
| Notion | No graph | No graph |
| TheBrain | Graph navigation | Proprietary relevance scoring |

All existing tools treat the graph as a visualization feature — pretty to look at but not analytically useful. No tool applies network science algorithms to derive insights from the knowledge graph.

### Network Science Background

These algorithms are well-established in other domains:

| Algorithm | Original Domain | Application to PKM |
|-----------|----------------|---------------------|
| PageRank | Web link analysis | Identify most important pages |
| Betweenness Centrality | Social networks | Find "bridge" pages connecting clusters |
| Community Detection | Social networks | Discover topic clusters |
| Link Prediction | Recommendation systems | Suggest missing connections |
| k-Core Decomposition | Network analysis | Find densely connected knowledge cores |

## Technical Approach

### CozoDB Built-In Algorithms

CozoDB provides these algorithms natively, executable within Datalog queries:

```datalog
# PageRank
rank[page_id, score] <~ PageRank(*links[source_id, target_id])
?[page_id, title, score] := rank[page_id, score], *pages{ page_id, title }

# Community Detection (Louvain)
community[page_id, group] <~ CommunityDetectionLouvain(*links[source_id, target_id])
?[page_id, title, group] := community[page_id, group], *pages{ page_id, title }

# Betweenness Centrality
centrality[page_id, score] <~ BetweennessCentrality(*links[source_id, target_id])

# Shortest Path
path[node, edge] <~ ShortestPathBFS(*links[source_id, target_id], start: $from, goal: $to)

# Connected Components
comp[page_id, component] <~ ConnectedComponents(*links[source_id, target_id])
```

### The `graph-algorithms` Package

Beyond CozoDB's built-in algorithms, the `graph-algorithms` package implements algorithms that CozoDB doesn't provide, or that need customization for PKM:

#### Link Prediction

Suggest connections the user hasn't made yet:

```typescript
// Common neighbors: pages linked by many shared connections
function commonNeighbors(graph: Graph, a: string, b: string): number {
  const neighborsA = graph.neighbors(a);
  const neighborsB = graph.neighbors(b);
  return intersection(neighborsA, neighborsB).size;
}

// Adamic-Adar: weighted common neighbors (rare shared connections count more)
function adamicAdar(graph: Graph, a: string, b: string): number {
  const common = intersection(graph.neighbors(a), graph.neighbors(b));
  return [...common].reduce((sum, c) => sum + 1 / Math.log(graph.degree(c)), 0);
}
```

#### Topic Drift Detection

Identify when a page's content has drifted from its original cluster:

```typescript
// A page that was in cluster A but now links primarily to cluster B
function detectDrift(page: string, currentCluster: number, linkTargetClusters: number[]): boolean {
  const mode = mostFrequent(linkTargetClusters);
  return mode !== currentCluster;
}
```

#### Knowledge Gap Detection

Find areas where the graph is sparse relative to local density:

```typescript
// Pages with high in-degree neighbors but low in-degree themselves
// These are "gaps" — topics surrounded by well-developed neighbors
function findGaps(graph: Graph): string[] {
  return graph.nodes().filter(node => {
    const neighborAvgDegree = average(graph.neighbors(node).map(n => graph.degree(n)));
    return graph.degree(node) < neighborAvgDegree * 0.3;
  });
}
```

### User-Facing Features

| Feature | Algorithm | Presentation |
|---------|-----------|-------------|
| "Important Pages" | PageRank | Ranked list in sidebar |
| "Bridge Pages" | Betweenness Centrality | Highlighted nodes in graph view |
| "Topic Clusters" | Community Detection | Colored groups in graph view |
| "Suggested Links" | Link Prediction | "You might want to link to..." panel |
| "Orphan Pages" | Degree = 0 | Simple query result |
| "Knowledge Gaps" | Gap Detection | "These areas could use more development" |
| "Cluster Map" | Community Detection + PageRank | High-level map of knowledge areas |

### Computation Strategy

| Approach | When | Why |
|----------|------|-----|
| On-demand | User opens graph view / runs query | Avoids unnecessary computation |
| Cached | Results stored in useCozoQuery cache (Zustand) | Fast subsequent access |
| Background | PageRank on large graphs (>5000 pages) | Avoid blocking UI |
| Incremental | After adding/removing links | Update scores without full recomputation |

For most personal knowledge bases (<5000 pages), all algorithms complete in <1 second. Background computation is only needed for very large bases.

## Evaluation Criteria

1. **Correctness**: Do algorithms produce expected results on known test graphs?
   - Validate against NetworkX reference implementations
   - Test on published benchmark graphs (Zachary's karate club, etc.)

2. **Performance**: Are algorithms fast enough for interactive use?
   - Target: <500ms for PageRank on 10,000 nodes
   - Target: <2s for community detection on 10,000 nodes

3. **Utility**: Do the results actually help users?
   - Do suggested links get accepted? (precision/recall if measurable)
   - Do users discover connections they didn't know about?
   - Do cluster labels match users' mental model of their knowledge?

4. **Scalability**: How do algorithms behave as the graph grows?
   - Benchmark at 100, 1000, 10000, 100000 pages

## Open Questions

<!-- TODO: Which CozoDB graph algorithms are available and at what version? -->
<!-- TODO: Define the link graph (page-level only, or include block-level refs?) -->
<!-- TODO: Define whether to use weighted edges (link frequency, recency) -->
<!-- TODO: Design incremental algorithm updates (avoid full recomputation on every link change) -->
<!-- TODO: Evaluate whether heterogeneous graphs (pages + tags + properties as nodes) improve results -->
<!-- TODO: Study how network science maps to PKM — which metrics correlate with "usefulness"? -->
<!-- TODO: Define baseline comparison (manual organization vs algorithm-assisted) -->
