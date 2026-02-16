/**
 * Import an Obsidian vault into Double-Bind via the HTTP bridge server.
 *
 * Usage: npx tsx scripts/import-obsidian.ts <vault-path> [bridge-url]
 *
 * Parses markdown files into pages + blocks, extracts [[wiki links]],
 * and bulk-inserts via the bridge's /invoke endpoint.
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { randomUUID } from 'node:crypto';

const VAULT_PATH = process.argv[2];
const BRIDGE_URL = process.argv[3] || 'http://localhost:3008';

if (!VAULT_PATH) {
  console.error('Usage: npx tsx scripts/import-obsidian.ts <vault-path> [bridge-url]');
  process.exit(1);
}

// ─── Types ─────────────────────────────────────────────────────────

interface ParsedBlock {
  id: string;
  content: string;
  indent: number;
  children: ParsedBlock[];
}

interface BlockLink {
  blockId: string;
  targetTitle: string;
}

interface ParsedPage {
  title: string;
  pageId: string;
  blocks: ParsedBlock[];
  /** Wiki links tracked per-block for context_block_id */
  blockLinks: BlockLink[];
}

// ─── Bridge client ────────────────────────────────────────────────

async function bridgeInvoke(cmd: string, args: Record<string, unknown>) {
  const res = await fetch(`${BRIDGE_URL}/invoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cmd, args }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Bridge ${cmd} failed: ${err}`);
  }
  return res.json();
}

async function mutate(script: string, params: Record<string, unknown> = {}) {
  return bridgeInvoke('mutate', { script, params });
}

// ─── Markdown parsing ─────────────────────────────────────────────

const WIKI_LINK_RE = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;

function extractWikiLinks(content: string): string[] {
  const links: string[] = [];
  let match;
  while ((match = WIKI_LINK_RE.exec(content)) !== null) {
    links.push(match[1].trim());
  }
  return links;
}

/**
 * Parse markdown content into a flat list of blocks with indent levels.
 * Each non-empty line becomes a block. Bullet indentation determines hierarchy.
 */
function parseMarkdownToBlocks(content: string): ParsedBlock[] {
  const lines = content.split('\n');
  const flat: { id: string; content: string; indent: number }[] = [];

  for (const line of lines) {
    if (line.trim() === '') continue;

    // Normalize tabs to spaces for consistent indent calculation
    const tabNormalized = line.replace(/\t/g, '    ');
    const normalizedSpaces = tabNormalized.match(/^(\s*)/)?.[1].length ?? 0;
    const indent = Math.floor(normalizedSpaces / 2);

    // Strip leading bullet marker but keep content
    let text = line.trim();
    text = text.replace(/^[-*+]\s+/, '');
    text = text.replace(/^\d+\.\s+/, '');

    if (text === '') continue;

    flat.push({ id: randomUUID(), content: text, indent });
  }

  return buildTree(flat);
}

function buildTree(
  flat: { id: string; content: string; indent: number }[]
): ParsedBlock[] {
  const roots: ParsedBlock[] = [];
  const stack: ParsedBlock[] = [];

  for (const item of flat) {
    const block: ParsedBlock = {
      id: item.id,
      content: item.content,
      indent: item.indent,
      children: [],
    };

    while (stack.length > 0 && stack[stack.length - 1].indent >= item.indent) {
      stack.pop();
    }

    if (stack.length === 0) {
      roots.push(block);
    } else {
      stack[stack.length - 1].children.push(block);
    }

    stack.push(block);
  }

  return roots;
}

// ─── File discovery ───────────────────────────────────────────────

async function findMarkdownFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.name.startsWith('.')) continue;
    if (entry.isDirectory()) {
      files.push(...(await findMarkdownFiles(fullPath)));
    } else if (entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }

  return files;
}

// ─── Block ordering ───────────────────────────────────────────────

function orderKey(index: number): string {
  const padded = String(index).padStart(6, '0');
  return `a${padded}`;
}

// ─── Import logic ─────────────────────────────────────────────────

async function importPage(page: ParsedPage) {
  const now = Date.now() / 1000;

  await mutate(
    `?[page_id, title, created_at, updated_at, is_deleted, daily_note_date] <- [[$page_id, $title, $now, $now, false, null]]
     :put pages { page_id, title, created_at, updated_at, is_deleted, daily_note_date }`,
    { page_id: page.pageId, title: page.title, now }
  );

  const flatBlocks: {
    id: string;
    parentId: string | null;
    content: string;
    order: string;
  }[] = [];

  function flattenBlocks(blocks: ParsedBlock[], parentId: string | null) {
    blocks.forEach((block, i) => {
      flatBlocks.push({
        id: block.id,
        parentId,
        content: block.content,
        order: orderKey(i),
      });
      flattenBlocks(block.children, block.id);
    });
  }

  flattenBlocks(page.blocks, null);

  for (const block of flatBlocks) {
    await mutate(
      `?[block_id, page_id, parent_id, content, content_type, order, is_collapsed, is_deleted, created_at, updated_at] <-
       [[$block_id, $page_id, $parent_id, $content, "text", $order, false, false, $now, $now]]
       :put blocks { block_id, page_id, parent_id, content, content_type, order, is_collapsed, is_deleted, created_at, updated_at }`,
      {
        block_id: block.id,
        page_id: page.pageId,
        parent_id: block.parentId,
        content: block.content,
        order: block.order,
        now,
      }
    );

    await mutate(
      `?[page_id, block_id] <- [[$page_id, $block_id]]
       :put blocks_by_page { page_id, block_id }`,
      { page_id: page.pageId, block_id: block.id }
    );

    if (block.parentId) {
      await mutate(
        `?[parent_id, block_id] <- [[$parent_id, $block_id]]
         :put blocks_by_parent { parent_id, block_id }`,
        { parent_id: block.parentId, block_id: block.id }
      );
    }
  }

  return flatBlocks.length;
}

async function createLinks(
  pages: ParsedPage[],
  titleToPageId: Map<string, string>
) {
  const now = Date.now() / 1000;
  let linkCount = 0;

  for (const page of pages) {
    for (const blockLink of page.blockLinks) {
      const targetId = titleToPageId.get(blockLink.targetTitle);
      if (!targetId) continue;

      // source_id = source page, context_block_id = the block containing [[link]]
      await mutate(
        `?[source_id, target_id, link_type, created_at, context_block_id] <-
         [[$source_id, $target_id, "reference", $now, $context_block_id]]
         :put links { source_id, target_id, link_type, created_at, context_block_id }`,
        {
          source_id: page.pageId,
          target_id: targetId,
          context_block_id: blockLink.blockId,
          now,
        }
      );
      linkCount++;
    }
  }

  return linkCount;
}

// ─── Main ─────────────────────────────────────────────────────────

async function main() {
  try {
    const res = await fetch(`${BRIDGE_URL}/health`);
    if (!res.ok) throw new Error('not ok');
  } catch {
    console.error(`Bridge server not reachable at ${BRIDGE_URL}`);
    console.error('Start it with: pnpm --filter=@double-bind/desktop run dev:bridge');
    process.exit(1);
  }

  console.log(`Importing Obsidian vault: ${VAULT_PATH}`);
  console.log(`Bridge URL: ${BRIDGE_URL}\n`);

  const files = await findMarkdownFiles(VAULT_PATH);
  console.log(`Found ${files.length} markdown files\n`);

  const pages: ParsedPage[] = [];
  const titleToPageId = new Map<string, string>();

  for (const filePath of files) {
    const content = await readFile(filePath, 'utf-8');
    const title = basename(filePath, '.md');
    const pageId = randomUUID();

    const blocks = parseMarkdownToBlocks(content);

    // Extract wiki links per-block for proper context_block_id
    const blockLinks: BlockLink[] = [];
    function collectBlockLinks(blockList: ParsedBlock[]) {
      for (const block of blockList) {
        const links = extractWikiLinks(block.content);
        for (const targetTitle of links) {
          blockLinks.push({ blockId: block.id, targetTitle });
        }
        collectBlockLinks(block.children);
      }
    }
    collectBlockLinks(blocks);

    pages.push({ title, pageId, blocks, blockLinks });
    titleToPageId.set(title, pageId);
  }

  let totalBlocks = 0;
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const blockCount = await importPage(page);
    totalBlocks += blockCount;
    process.stdout.write(`\r  [${i + 1}/${pages.length}] ${page.title} (${blockCount} blocks)`);
  }
  console.log(`\n\nImported ${pages.length} pages with ${totalBlocks} blocks`);

  const linkCount = await createLinks(pages, titleToPageId);
  console.log(`Created ${linkCount} wiki links`);

  console.log('\nDone!');
}

main().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
