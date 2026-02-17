/**
 * Import an Obsidian vault into Double-Bind via the HTTP bridge server (SQLite).
 *
 * Uses the bridge's service-layer API so that [[wiki links]], #tags, and
 * properties are resolved automatically by BlockService — no manual link
 * creation needed.
 *
 * Usage: npx tsx scripts/import-obsidian-sqlite.ts <vault-path> [bridge-url]
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, basename } from 'node:path';

const VAULT_PATH = process.argv[2];
const BRIDGE_URL = process.argv[3] || 'http://localhost:3008';

if (!VAULT_PATH) {
  console.error('Usage: npx tsx scripts/import-obsidian-sqlite.ts <vault-path> [bridge-url]');
  process.exit(1);
}

// ─── Types ─────────────────────────────────────────────────────────

interface ParsedBlock {
  content: string;
  indent: number;
  children: ParsedBlock[];
}

interface ParsedPage {
  title: string;
  blocks: ParsedBlock[];
}

// ─── Bridge client ────────────────────────────────────────────────

async function invoke<T = unknown>(cmd: string, args: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${BRIDGE_URL}/invoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cmd, args }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Bridge ${cmd} failed: ${err}`);
  }
  return res.json() as Promise<T>;
}

// ─── Markdown parsing ─────────────────────────────────────────────

function parseMarkdownToBlocks(content: string): ParsedBlock[] {
  const lines = content.split('\n');
  const flat: { content: string; indent: number }[] = [];

  for (const line of lines) {
    if (line.trim() === '') continue;

    const tabNormalized = line.replace(/\t/g, '    ');
    const normalizedSpaces = tabNormalized.match(/^(\s*)/)?.[1].length ?? 0;
    const indent = Math.floor(normalizedSpaces / 2);

    let text = line.trim();
    text = text.replace(/^[-*+]\s+/, '');
    text = text.replace(/^\d+\.\s+/, '');

    if (text === '') continue;

    flat.push({ content: text, indent });
  }

  // Build tree
  const roots: ParsedBlock[] = [];
  const stack: ParsedBlock[] = [];

  for (const item of flat) {
    const block: ParsedBlock = { content: item.content, indent: item.indent, children: [] };

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

// ─── Import logic ─────────────────────────────────────────────────

/**
 * Create blocks recursively via the service API.
 * BlockService.createBlock auto-resolves [[wiki links]] and #tags.
 */
async function createBlocksRecursive(
  pageId: string,
  parentId: string | null,
  blocks: ParsedBlock[]
): Promise<number> {
  let count = 0;
  let lastBlockId: string | undefined;

  for (const block of blocks) {
    const result = await invoke<{ blockId: string }>('service:createBlock', {
      pageId,
      parentId,
      content: block.content,
      afterBlockId: lastBlockId,
    });

    lastBlockId = result.blockId;
    count++;

    // Recurse into children
    if (block.children.length > 0) {
      count += await createBlocksRecursive(pageId, result.blockId, block.children);
    }
  }

  return count;
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

  // Parse all files first
  const pages: ParsedPage[] = [];
  for (const filePath of files) {
    const content = await readFile(filePath, 'utf-8');
    const title = basename(filePath, '.md');
    const blocks = parseMarkdownToBlocks(content);
    pages.push({ title, blocks });
  }

  // Import pages and their blocks via the service layer.
  // service:createPage creates the page (with an initial empty block).
  // service:createBlock creates each block and auto-resolves [[wiki links]].
  let totalBlocks = 0;
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const { pageId } = await invoke<{ pageId: string }>('service:createPage', {
      title: page.title,
    });

    const blockCount = await createBlocksRecursive(pageId, null, page.blocks);
    totalBlocks += blockCount;
    process.stdout.write(`\r  [${i + 1}/${pages.length}] ${page.title} (${blockCount} blocks)`);
  }

  console.log(`\n\nImported ${pages.length} pages with ${totalBlocks} blocks`);
  console.log('Wiki links resolved automatically via BlockService.');
  console.log('\nDone!');
}

main().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
