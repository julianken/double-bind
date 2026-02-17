/**
 * MCP Tool registrations for double-bind.
 *
 * Exposes core services as MCP tools that the LLM can call.
 * Each tool that has a UI component links to the shared graph resource.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  registerAppResource,
  RESOURCE_MIME_TYPE,
} from '@modelcontextprotocol/ext-apps/server';
import { z } from 'zod';
import type { Services } from '@double-bind/core';
import type { Database } from '@double-bind/types';
import fs from 'node:fs/promises';
import path from 'node:path';

const GRAPH_RESOURCE_URI = 'ui://double-bind/graph.html';
const UI_META = {
  ui: { resourceUri: GRAPH_RESOURCE_URI },
  'ui/resourceUri': GRAPH_RESOURCE_URI,
};

export function registerTools(server: McpServer, services: Services, db: Database): void {
  const { pageService, blockService, graphService, searchService } = services;

  // ─── explore-graph ───────────────────────────────────────────────────────
  server.registerTool(
    'explore-graph',
    {
      title: 'Explore Knowledge Graph',
      description:
        'Explore the Double-Bind knowledge graph. Returns an interactive force-directed graph visualization. ' +
        'Optionally focus on a specific page and its neighborhood.',
      inputSchema: {
        pageId: z.string().optional().describe('Optional page ID to center the graph on. Omit for full graph.'),
        hops: z.number().optional().describe('Number of hops from center page (default 2). Only used with pageId.'),
      },
      _meta: UI_META,
    },
    async ({ pageId, hops }) => {
      const graph = pageId
        ? await graphService.getNeighborhood(pageId, hops ?? 2)
        : await graphService.getFullGraph();

      const [ranks, communities] = await Promise.all([
        graphService.getPageRank().catch(() => new Map<string, number>()),
        graphService.getCommunities().catch(() => new Map<string, number>()),
      ]);

      const enrichedNodes = graph.nodes.map((node) => ({
        id: node.pageId,
        title: node.title,
        pageRank: ranks.get(node.pageId) ?? 0,
        community: communities.get(node.pageId) ?? 0,
      }));

      const edges = graph.edges.map((edge) => ({
        source: edge.sourceId,
        target: edge.targetId,
      }));

      const summary = pageId
        ? `Showing neighborhood of "${graph.nodes.find((n) => n.pageId === pageId)?.title ?? pageId}" (${enrichedNodes.length} pages, ${edges.length} links)`
        : `Full graph: ${enrichedNodes.length} pages, ${edges.length} links`;

      return {
        content: [
          { type: 'text' as const, text: summary },
          {
            type: 'text' as const,
            text: JSON.stringify({ nodes: enrichedNodes, edges, focusedPageId: pageId ?? null }),
          },
        ],
      };
    },
  );

  // ─── search-notes ────────────────────────────────────────────────────────
  server.registerTool(
    'search-notes',
    {
      title: 'Search Notes',
      description: 'Full-text search across all pages and blocks in the knowledge base.',
      inputSchema: {
        query: z.string().describe('Search query'),
        limit: z.number().optional().describe('Max results (default 20)'),
      },
      _meta: UI_META,
    },
    async ({ query, limit }) => {
      const results = await searchService.search(query, { limit: limit ?? 20 });

      const formatted = results.map((r) => ({
        type: r.type,
        id: r.id,
        title: r.title,
        content: r.content,
        pageId: r.pageId,
        score: r.score,
      }));

      return {
        content: [
          {
            type: 'text' as const,
            text: `Found ${results.length} results for "${query}":\n\n` +
              formatted
                .map((r) =>
                  r.type === 'page'
                    ? `- **${r.title}** (page, score: ${r.score.toFixed(2)})`
                    : `- "${r.content}" in **${r.title}** (block, score: ${r.score.toFixed(2)})`,
                )
                .join('\n'),
          },
          { type: 'text' as const, text: JSON.stringify({ searchResults: formatted }) },
        ],
      };
    },
  );

  // ─── get-page ────────────────────────────────────────────────────────────
  server.registerTool(
    'get-page',
    {
      title: 'Get Page',
      description: 'Get a page with all its blocks/content. Returns the full note.',
      inputSchema: {
        pageId: z.string().describe('The page ID to retrieve'),
      },
      _meta: UI_META,
    },
    async ({ pageId }) => {
      try {
        const result = await pageService.getPageWithBlocks(pageId);

        const blockText = result.blocks
          .map((b) => `  ${b.content}`)
          .join('\n');

        return {
          content: [
            {
              type: 'text' as const,
              text: `# ${result.page.title}\n\n${blockText}`,
            },
            {
              type: 'text' as const,
              text: JSON.stringify({
                page: { id: result.page.pageId, title: result.page.title },
                blocks: result.blocks.map((b) => ({
                  id: b.blockId,
                  content: b.content,
                })),
              }),
            },
          ],
        };
      } catch {
        return { content: [{ type: 'text' as const, text: `Page not found: ${pageId}` }] };
      }
    },
  );

  // ─── create-page ─────────────────────────────────────────────────────────
  server.registerTool(
    'create-page',
    {
      title: 'Create Page',
      description: 'Create a new page in the knowledge base with optional initial content blocks.',
      inputSchema: {
        title: z.string().describe('Page title'),
        blocks: z.array(z.string()).optional().describe('Optional array of content strings for initial blocks'),
      },
      _meta: UI_META,
    },
    async ({ title, blocks }) => {
      const page = await pageService.createPage(title);

      if (blocks?.length) {
        for (const content of blocks) {
          await blockService.createBlock(page.pageId, null, content);
        }
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: `Created page "${title}" (${page.pageId})${blocks?.length ? ` with ${blocks.length} blocks` : ''}`,
          },
          {
            type: 'text' as const,
            text: JSON.stringify({ created: { id: page.pageId, title } }),
          },
        ],
      };
    },
  );

  // ─── list-pages ──────────────────────────────────────────────────────────
  server.registerTool(
    'list-pages',
    {
      title: 'List Pages',
      description: 'List all pages in the knowledge base.',
      _meta: UI_META,
    },
    async () => {
      const result = await db.query<[string, string, number, number, boolean, string | null]>(
        `?[page_id, title, created_at, updated_at, is_deleted, daily_note_date] :=
           *pages{ page_id, title, created_at, updated_at, is_deleted, daily_note_date },
           is_deleted = false
         :order updated_at
         :limit 100`,
      );

      const pages = result.rows.map(([id, title]) => ({ id, title }));

      return {
        content: [
          {
            type: 'text' as const,
            text: `${pages.length} pages:\n` + pages.map((p) => `- **${p.title}** (${p.id})`).join('\n'),
          },
          { type: 'text' as const, text: JSON.stringify({ pages }) },
        ],
      };
    },
  );

  // ─── UI Resource ─────────────────────────────────────────────────────────
  registerAppResource(
    server,
    GRAPH_RESOURCE_URI,
    GRAPH_RESOURCE_URI,
    { mimeType: RESOURCE_MIME_TYPE },
    async () => {
      const html = await fs.readFile(
        path.join(import.meta.dirname, '..', '..', 'dist', 'src', 'ui', 'index.html'),
        'utf-8',
      );
      return {
        contents: [{ uri: GRAPH_RESOURCE_URI, mimeType: RESOURCE_MIME_TYPE, text: html }],
      };
    },
  );
}
