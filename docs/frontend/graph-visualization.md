# Graph Visualization

## Purpose

Visualize the knowledge graph — pages as nodes, links as edges. Let users explore their note network, discover clusters, and find unexpected connections.

## Library

`react-force-graph-2d` — a React wrapper around `force-graph`, which uses `d3-force` for layout and HTML Canvas for rendering.

### Why This Library

| Factor | react-force-graph-2d | d3 direct | vis.js | Cytoscape.js |
|--------|:---:|:---:|:---:|:---:|
| React integration | Native | Manual | Wrapper | Wrapper |
| Canvas rendering | Yes | SVG (slower at scale) | Canvas | Canvas |
| Force-directed layout | d3-force | d3-force | Built-in | Built-in |
| Performance at 1000 nodes | Good | Poor (SVG) | Good | Good |
| Bundle size | ~50KB | ~30KB | ~200KB | ~300KB |
| Interactivity | Click, hover, drag | DIY | Good | Excellent |

`react-force-graph-2d` hits the sweet spot: good React integration, Canvas performance, small bundle, and the layout quality of d3-force.

## Views

### 1. Full Graph View

Shows the entire knowledge graph. Available from the main navigation.

```
┌────────────────────────────────┐
│  [Search] [Filter ▼] [Layout ▼]│
│                                │
│     ●───●        ●             │
│    / \ / \      / \            │
│   ●   ●   ●───●   ●           │
│    \     /     |               │
│     ●───●      ●──●           │
│                    |           │
│              ●─────●           │
│                                │
│  [Zoom +/-] [Center] [Legend]  │
└────────────────────────────────┘
```

Features:
- Color nodes by cluster (community detection)
- Size nodes by PageRank score
- Click node → navigate to page
- Hover node → show title + connection count
- Right-click → open in side panel
- Search highlights matching nodes

### 2. Page Neighborhood View

Shows a specific page and its N-hop neighbors. Displayed in the right panel or inline.

```
Graph of "Project Alpha" (2 hops):

            Meeting Notes
                │
  Design Doc ── Project Alpha ── Research Paper
                │           \
            Task List     Related Ideas
                            │
                        Prior Art
```

Parameters:
- Center node: current page
- Hop distance: 1-3 (default 2)
- Include/exclude link types

### 3. Block Reference Graph (Future)

Shows block-level references rather than page-level links. Much denser graph.

## Data Pipeline

```
CozoDB (links relation)
       │
       ▼
GraphService.getFullGraph()
       │  Returns: { nodes: Page[], edges: Link[] }
       ▼
useCozoQuery cache (Zustand)
       │  queryKey: ['graph', 'full'] or ['graph', 'neighborhood', pageId, hops]
       ▼
Transform to ForceGraph format
       │  { nodes: [{ id, label, val, color }], links: [{ source, target }] }
       ▼
<ForceGraph2D data={graphData} />
```

### Graph Data Queries

Full graph:
```datalog
nodes[page_id, title] := *pages{ page_id, title, is_deleted: false }
edges[src, tgt] := *links{ source_id: src, target_id: tgt }
?[page_id, title, src, tgt] := nodes[page_id, title], edges[src, tgt]
```

Neighborhood (2-hop):
```datalog
hop1[neighbor] := *links{ source_id: $center, target_id: neighbor }
hop1[neighbor] := *links{ source_id: neighbor, target_id: $center }
hop2[neighbor] := hop1[mid], *links{ source_id: mid, target_id: neighbor }
hop2[neighbor] := hop1[mid], *links{ source_id: neighbor, target_id: mid }
all_nodes[n] := hop1[n]
all_nodes[n] := hop2[n]
all_nodes[$center] := true  # Include center
?[src, tgt] := all_nodes[src], all_nodes[tgt], *links{ source_id: src, target_id: tgt }
```

## Enrichment with Graph Algorithms

Graph visualization is more useful when combined with algorithm results:

| Algorithm | Visual Mapping |
|-----------|---------------|
| PageRank | Node size (higher rank = larger) |
| Community detection | Node color (same community = same color) |
| Betweenness centrality | Node border thickness (bridge nodes) |
| Link prediction | Dashed edges for suggested links |

These are computed lazily (on graph view open) and cached in useCozoQuery.

## Performance Considerations

| Scale | Strategy |
|-------|----------|
| <100 nodes | Render all, full interactivity |
| 100-1000 nodes | Render all, reduce label rendering |
| 1000-5000 nodes | Cluster small groups, show labels on hover only |
| >5000 nodes | Show only neighborhood, offer drill-down |

### Canvas vs WebGL

`react-force-graph-2d` uses Canvas. If performance at scale is insufficient, `react-force-graph-3d` uses WebGL (Three.js) with better performance but more complex interaction. Start with 2D.

## Interaction Design

| Action | Behavior |
|--------|----------|
| Click node | Navigate to page |
| Hover node | Show tooltip (title, link count, PageRank) |
| Drag node | Pin node position |
| Scroll | Zoom in/out |
| Right-click node | Context menu (open in panel, expand, hide) |
| Click edge | Show link context (which block contains the link) |
| Double-click background | Reset zoom to fit all |

## Filtering

Users can filter the graph by:
- Tags (show only pages with specific tags)
- Date range (created or modified within range)
- Link type (reference, tag-based, property-based)
- Minimum connection count (hide isolated nodes)

<!-- TODO: Define exact react-force-graph-2d configuration -->
<!-- TODO: Define color palette for community clusters -->
<!-- TODO: Define graph layout algorithm parameters (charge, distance, etc.) -->
<!-- TODO: Define graph data caching and incremental update strategy -->
<!-- TODO: Define export graph as image/SVG -->
<!-- TODO: Evaluate WebGL (3D) as progressive enhancement -->
