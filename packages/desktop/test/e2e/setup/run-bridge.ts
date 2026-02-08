#!/usr/bin/env npx tsx
/**
 * Standalone HTTP Bridge Server
 *
 * Run this to use the browser version of the app without Playwright tests.
 * Usage: npx tsx packages/desktop/test/e2e/setup/run-bridge.ts
 */

import express, { type Request, type Response, type Express } from 'express';
import { CozoDb } from 'cozo-node';

const BRIDGE_PORT = 3001;

// Store the DB in an object so it can be swapped out
const dbContainer: { db: CozoDb | null } = { db: null };

/**
 * Extract a readable error message from a CozoDB error result.
 */
function extractCozoError(result: unknown): string {
  if (!result || typeof result !== 'object') {
    return String(result);
  }
  const r = result as Record<string, unknown>;
  if ('message' in r && typeof r.message === 'string') {
    return r.message;
  }
  if ('display' in r && typeof r.display === 'string') {
    return r.display;
  }
  return JSON.stringify(result);
}

/**
 * Schema statements for the database.
 */
const SCHEMA_STATEMENTS = [
  `:create blocks {
    block_id: String
    =>
    page_id: String,
    parent_id: String?,
    content: String,
    content_type: String default 'text',
    order: String,
    is_collapsed: Bool default false,
    is_deleted: Bool default false,
    created_at: Float,
    updated_at: Float
}`,
  `:create pages {
    page_id: String
    =>
    title: String,
    created_at: Float,
    updated_at: Float,
    is_deleted: Bool default false,
    daily_note_date: String?
}`,
  `:create blocks_by_page {
    page_id: String,
    block_id: String
}`,
  `:create blocks_by_parent {
    parent_id: String,
    block_id: String
}`,
  `:create block_refs {
    source_block_id: String,
    target_block_id: String
    =>
    created_at: Float
}`,
  `:create links {
    source_id: String,
    target_id: String,
    link_type: String default 'reference'
    =>
    created_at: Float,
    context_block_id: String?
}`,
  `:create properties {
    entity_id: String,
    key: String
    =>
    value: String,
    value_type: String default 'string',
    updated_at: Float
}`,
  `:create tags {
    entity_id: String,
    tag: String
    =>
    created_at: Float
}`,
  `:create block_history {
    block_id: String,
    version: Int
    =>
    content: String,
    parent_id: String?,
    order: String,
    is_collapsed: Bool,
    is_deleted: Bool,
    operation: String,
    timestamp: Float
}`,
  `:create daily_notes {
    date: String
    =>
    page_id: String
}`,
  `:create metadata {
    key: String
    =>
    value: String
}`,
  `:create saved_queries {
    id: String
    =>
    name: String,
    type: String,
    definition: String,
    description: String?,
    created_at: Float,
    updated_at: Float
}`,
  `::index create links:by_target { target_id, source_id, link_type }`,
  `::index create block_refs:by_target { target_block_id, source_block_id }`,
  `?[key, value] <- [["schema_version", "2"]] :put metadata { key, value }`,
  `?[key, value] <- [["applied_migrations", '["001-initial-schema","002-saved-queries"]']] :put metadata { key, value }`,
];

/**
 * Initialize schema by running all statements.
 */
async function initializeSchema(db: CozoDb): Promise<void> {
  for (const stmt of SCHEMA_STATEMENTS) {
    const result = await db.run(stmt);
    if (result && typeof result === 'object' && 'ok' in result && result.ok === false) {
      throw new Error(`Schema setup failed: ${extractCozoError(result)}`);
    }
  }
}

/**
 * Reset the database to a clean state.
 */
async function resetDatabase(): Promise<void> {
  const newDb = new CozoDb('mem');
  await initializeSchema(newDb);
  dbContainer.db = newDb;
  console.log('Database reset complete');
}

async function main(): Promise<void> {
  // Create in-memory CozoDB instance and set up schema
  dbContainer.db = new CozoDb('mem');
  await initializeSchema(dbContainer.db);
  console.log('Schema setup complete');

  // Create Express app
  const app: Express = express();
  app.use(express.json({ limit: '10mb' }));

  // CORS headers for browser access
  app.use((_req: Request, res: Response, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
  });

  // Handle OPTIONS preflight
  app.options('/invoke', (_req: Request, res: Response) => {
    res.sendStatus(200);
  });

  // Health check endpoint
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  // Handle reset endpoint
  app.post('/reset', async (_req: Request, res: Response) => {
    try {
      await resetDatabase();
      res.json({ success: true });
    } catch (error) {
      console.error('Reset failed:', error);
      res.status(500).json({ error: String(error) });
    }
  });

  // Main IPC handler
  app.post('/invoke', async (req: Request, res: Response) => {
    const { cmd, args } = req.body as { cmd: string; args: Record<string, unknown> };
    const db = dbContainer.db;

    if (!db) {
      res.status(500).json({ error: 'Database not initialized' });
      return;
    }

    try {
      switch (cmd) {
        case 'query': {
          const script = args.script as string;
          const params = (args.params as Record<string, unknown>) ?? {};
          const result = await db.run(script, params);
          res.json(result);
          break;
        }
        case 'mutate': {
          const script = args.script as string;
          const params = (args.params as Record<string, unknown>) ?? {};
          const result = await db.run(script, params);
          res.json(result);
          break;
        }
        case 'import_relations': {
          const data = args.data as Record<string, unknown>;
          await db.importRelations(data);
          res.json({});
          break;
        }
        case 'export_relations': {
          const relations = args.relations as string[];
          const result = await db.exportRelations(relations);
          res.json(result);
          break;
        }
        case 'backup': {
          res.json({});
          break;
        }
        default:
          res.status(400).json({ error: `Unknown command: ${cmd}` });
      }
    } catch (error) {
      console.error(`IPC error for ${cmd}:`, error);
      res.status(500).json({ error: String(error) });
    }
  });

  // Start server
  app.listen(BRIDGE_PORT, () => {
    console.log(`\n🌉 HTTP Bridge Server running on http://localhost:${BRIDGE_PORT}`);
    console.log(`   Health check: http://localhost:${BRIDGE_PORT}/health`);
    console.log(`   Reset DB: POST http://localhost:${BRIDGE_PORT}/reset`);
    console.log(`\n   Now start Vite dev server: pnpm dev`);
    console.log(`   Then open: http://localhost:5173\n`);
  });
}

main().catch(console.error);
