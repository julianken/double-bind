/**
 * Graph algorithms using graphology library.
 *
 * This module provides wrapper functions around graphology for graph analysis:
 * - buildGraph(): Constructs a graphology Graph from pages and links
 * - computePageRank(): Runs PageRank algorithm to compute page importance
 * - computeCommunities(): Runs Louvain algorithm to detect communities
 *
 * Used by GraphService after fetching graph data from SQLite.
 */

import Graph from 'graphology';
import pagerank from 'graphology-metrics/centrality/pagerank.js';
import louvain from 'graphology-communities-louvain';
import type { Page, Link, PageId } from '@double-bind/types';
import type { Attributes } from 'graphology-types';

/**
 * Build a graphology Graph instance from pages and links.
 *
 * @param nodes - Array of pages to add as nodes
 * @param edges - Array of links to add as edges
 * @returns Directed graph instance
 */
export function buildGraph(nodes: Page[], edges: Link[]): Graph {
  const graph = new Graph({ type: 'directed' });

  // Add nodes
  for (const page of nodes) {
    graph.addNode(page.pageId, { title: page.title });
  }

  // Add edges (directed)
  for (const link of edges) {
    // Skip if source or target doesn't exist in the graph
    if (!graph.hasNode(link.sourceId) || !graph.hasNode(link.targetId)) {
      continue;
    }

    // graphology allows multiple edges between the same nodes
    // Use addEdgeWithKey for multi-graphs, or just addEdge for simple graphs
    try {
      graph.addEdge(link.sourceId, link.targetId, {
        linkType: link.linkType,
        createdAt: link.createdAt,
      });
    } catch {
      // Edge already exists, skip
    }
  }

  return graph;
}

/**
 * Compute PageRank scores for all nodes in the graph.
 *
 * Uses graphology's PageRank implementation with default parameters:
 * - alpha: 0.85 (damping factor)
 * - maxIterations: 100
 * - tolerance: 1e-6
 *
 * @param graph - The graph to analyze
 * @returns Map of page IDs to their PageRank scores
 */
export function computePageRank(graph: Graph): Map<PageId, number> {
  // If graph is empty or has no edges, return empty map
  if (graph.order === 0 || graph.size === 0) {
    return new Map();
  }

  // Compute PageRank using graphology-metrics
  const scores = pagerank(graph);

  // Convert to Map<PageId, number>
  const result = new Map<PageId, number>();
  for (const [nodeId, score] of Object.entries(scores)) {
    result.set(nodeId as PageId, score);
  }

  return result;
}

/**
 * Detect communities using the Louvain algorithm.
 *
 * The Louvain algorithm partitions the graph into communities based on
 * modularity optimization. Nodes in the same community are more densely
 * connected to each other than to nodes in other communities.
 *
 * @param graph - The graph to analyze (should be undirected or treated as undirected)
 * @returns Map of page IDs to their community group IDs
 */
export function computeCommunities(graph: Graph): Map<PageId, number> {
  // If graph is empty or has no edges, return empty map
  if (graph.order === 0 || graph.size === 0) {
    return new Map();
  }

  // Louvain requires an undirected graph, so create a new undirected graph
  const undirectedGraph = new Graph({ type: 'undirected' });

  // Copy nodes
  graph.forEachNode((node: string, attributes: Attributes) => {
    undirectedGraph.addNode(node, attributes);
  });

  // Copy edges (undirected graph treats them bidirectionally)
  graph.forEachEdge((_edge: string, attributes: Attributes, source: string, target: string) => {
    if (!undirectedGraph.hasEdge(source, target)) {
      try {
        undirectedGraph.addEdge(source, target, attributes);
      } catch {
        // Edge already exists, skip
      }
    }
  });

  // Run Louvain community detection
  const communities = louvain(undirectedGraph);

  // Convert to Map<PageId, number>
  const result = new Map<PageId, number>();
  for (const [nodeId, community] of Object.entries(communities)) {
    result.set(nodeId as PageId, community);
  }

  return result;
}
