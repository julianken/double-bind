/**
 * Seed data for demo purposes.
 *
 * Creates a small knowledge graph that demonstrates the app's capabilities:
 * interconnected notes with wiki-links, tags, and varied content.
 */

import type { Services } from '@double-bind/core';

export async function seedDemoData(services: Services): Promise<void> {
  const { pageService, blockService } = services;

  // Create pages
  const pages = await Promise.all([
    pageService.createPage('Model Context Protocol'),
    pageService.createPage('MCP Apps'),
    pageService.createPage('Knowledge Graphs'),
    pageService.createPage('CozoDB'),
    pageService.createPage('Datalog'),
    pageService.createPage('Graph Visualization'),
    pageService.createPage('Force-Directed Layout'),
    pageService.createPage('React'),
    pageService.createPage('ProseMirror'),
    pageService.createPage('Local-First Software'),
    pageService.createPage('Personal Knowledge Management'),
    pageService.createPage('Zettelkasten Method'),
    pageService.createPage('Double-Bind'),
    pageService.createPage('PageRank Algorithm'),
    pageService.createPage('Community Detection'),
  ]);

  const [
    mcp, mcpApps, knowledgeGraphs, cozodb, datalog,
    graphViz, forceLayout, react, prosemirror, localFirst,
    pkm, zettelkasten, doubleBind, pageRank, communityDetection,
  ] = pages;

  // Add blocks with wiki-links to create edges
  const blockContents: [typeof mcp, string[]][] = [
    [mcp, [
      'The Model Context Protocol (MCP) is an open standard for connecting AI assistants to external tools and data.',
      'Created by [[Anthropic]], adopted by OpenAI, and supported across [[Claude]], ChatGPT, and VS Code.',
      '[[MCP Apps]] extend the protocol with interactive HTML UIs rendered inside the chat.',
    ]],
    [mcpApps, [
      'MCP Apps = MCP tool + interactive HTML UI rendered in an iframe inside the chat window.',
      'Built on [[Model Context Protocol]] with the ext-apps SDK.',
      'The UI communicates with the host (Claude/ChatGPT) via postMessage JSON-RPC.',
      'Key advantage: distribution to 800M+ users for free — no app store, no hosting.',
    ]],
    [knowledgeGraphs, [
      'A knowledge graph represents information as a network of interconnected entities.',
      'Combines structured data with semantic relationships for powerful querying.',
      '[[CozoDB]] uses [[Datalog]] for querying knowledge graphs with recursive rules.',
      '[[Graph Visualization]] makes these structures explorable and intuitive.',
      'Used in [[Personal Knowledge Management]] tools like [[Double-Bind]].',
    ]],
    [cozodb, [
      'CozoDB is a hybrid relational-graph-vector database with a [[Datalog]] query language.',
      'Supports multiple storage backends: RocksDB, SQLite, and in-memory.',
      'Built-in algorithms: [[PageRank Algorithm]], [[Community Detection]], shortest path.',
      'HNSW vector indices enable semantic search alongside graph queries.',
    ]],
    [datalog, [
      'Datalog is a declarative logic programming language for querying relational data.',
      'Key strength: recursive queries for graph traversal (transitive closure, path finding).',
      'Used by [[CozoDB]] as its primary query language.',
      'More expressive than SQL for graph patterns, more principled than Cypher.',
    ]],
    [graphViz, [
      '[[Force-Directed Layout]] is the most common approach for knowledge graph visualization.',
      'Canvas rendering (via [[React]] + react-force-graph-2d) handles thousands of nodes.',
      '[[Double-Bind]] uses interactive graph views with zoom, pan, click-to-navigate.',
    ]],
    [forceLayout, [
      'Force-directed graph drawing uses physical simulation: nodes repel, edges attract.',
      'd3-force provides the physics engine, [[React]] renders the result.',
      'Naturally clusters related nodes together, revealing [[Community Detection]] patterns.',
    ]],
    [react, [
      'React 19 powers the UI layer of [[Double-Bind]].',
      'Component-based architecture with hooks for state management (Zustand).',
      'Used with [[ProseMirror]] for the block editor and react-force-graph-2d for [[Graph Visualization]].',
    ]],
    [prosemirror, [
      'ProseMirror is a toolkit for building rich-text editors.',
      'Powers the block editor in [[Double-Bind]] with wiki-link syntax support.',
      'Schema-driven: content rules are declared, not imperative.',
      'Collaborative editing support via operational transforms.',
    ]],
    [localFirst, [
      'Local-first software keeps data on the user\'s device, syncs peer-to-peer.',
      '[[Double-Bind]] is built on this principle: your notes never leave your machine unless you choose.',
      '[[CozoDB]] with RocksDB provides fast local storage.',
      'CRDTs and version vectors enable eventual consistency for sync.',
    ]],
    [pkm, [
      '[[Personal Knowledge Management]] is the practice of organizing and connecting ideas.',
      'Tools like Roam Research, Obsidian, and [[Double-Bind]] use bidirectional linking.',
      'The [[Zettelkasten Method]] emphasizes atomic notes connected by links.',
      '[[Knowledge Graphs]] make these connections visible and queryable.',
    ]],
    [zettelkasten, [
      'The Zettelkasten (slip-box) method was developed by Niklas Luhmann.',
      'Core principle: each note is atomic, connected to others by explicit links.',
      'Links create emergent structure — [[Knowledge Graphs]] that grow organically.',
      '[[Double-Bind]] implements this with wiki-links and [[Graph Visualization]].',
    ]],
    [doubleBind, [
      'Double-Bind is a [[Local-First Software]] note-taking app with a graph-native architecture.',
      'Built with [[React]], [[ProseMirror]], [[CozoDB]], and Tauri.',
      'Features: wiki-linking, [[Graph Visualization]], [[Datalog]] queries, full-text search.',
      'Now available as an [[MCP Apps]] — explore your knowledge graph inside Claude or ChatGPT.',
    ]],
    [pageRank, [
      'PageRank measures the importance of nodes based on link structure.',
      'Originally developed for web search ranking by Larry Page.',
      '[[CozoDB]] has a built-in PageRank algorithm for [[Knowledge Graphs]].',
      'In [[Double-Bind]], PageRank sizes nodes in the [[Graph Visualization]] by importance.',
    ]],
    [communityDetection, [
      'Community detection identifies clusters of densely connected nodes.',
      'The Louvain algorithm optimizes modularity to find communities.',
      '[[CozoDB]] includes built-in [[Community Detection]] via CommunityDetectionLouvain.',
      'In [[Graph Visualization]], communities are shown with distinct colors.',
    ]],
  ];

  for (const [page, contents] of blockContents) {
    for (const content of contents) {
      await blockService.createBlock(page.pageId, null, content);
    }
  }
}
