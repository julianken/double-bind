/**
 * Playwright Global Setup - HTTP Bridge Server
 *
 * Starts a lightweight Node.js server that wraps cozo-node and listens on localhost:3001.
 * The mockIPC() callback in the browser sends fetch() requests to this server.
 *
 * @see docs/testing/e2e-fast.md
 */

import type { FullConfig } from '@playwright/test';
import express, { type Request, type Response, type Express } from 'express';
import type { Server } from 'http';
import { CozoDb } from 'cozo-node';

// Store the server instance for teardown
let server: Server | null = null;

// Store the DB in an object so it can be swapped out and routes will get the new instance
const dbContainer: { db: CozoDb | null } = { db: null };

/**
 * Extract a readable error message from a CozoDB error result.
 */
function extractCozoError(result: unknown): string {
  if (!result || typeof result !== 'object') {
    return String(result);
  }
  const r = result as Record<string, unknown>;
  // CozoDB error format has 'message', 'display', 'code' fields
  if ('message' in r && typeof r.message === 'string') {
    return r.message;
  }
  if ('display' in r && typeof r.display === 'string') {
    return r.display;
  }
  return JSON.stringify(result);
}

/**
 * Minimal schema statements for E2E tests.
 * Each statement is run separately as CozoDB doesn't support multiple DDL commands in one script.
 */
const E2E_SCHEMA_STATEMENTS = [
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
  `::index create links:by_target { target_id, source_id, link_type }`,
  `::index create block_refs:by_target { target_block_id, source_block_id }`,
  `?[key, value] <- [["schema_version", "1"]] :put metadata { key, value }`,
];

/**
 * Initialize schema by running all statements.
 */
async function initializeSchema(db: CozoDb): Promise<void> {
  for (const stmt of E2E_SCHEMA_STATEMENTS) {
    const result = await db.run(stmt);
    if (result && typeof result === 'object' && 'ok' in result && result.ok === false) {
      throw new Error(`Schema setup failed: ${extractCozoError(result)}`);
    }
  }
}

/**
 * Reset the database to a clean state.
 * Creates a new in-memory database and sets up the minimal E2E schema.
 */
async function resetDatabase(): Promise<void> {
  dbContainer.db = new CozoDb('mem');
  await initializeSchema(dbContainer.db);
}

async function globalSetup(_config: FullConfig): Promise<void> {
  // Create in-memory CozoDB instance and set up schema
  dbContainer.db = new CozoDb('mem');
  await initializeSchema(dbContainer.db);
  console.log('Initial E2E schema setup complete');

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

  // Handle reset endpoint for test isolation
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
          // No-op in tests
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
  server = app.listen(3001, () => {
    console.log('E2E HTTP bridge server listening on port 3001');
  });

  // Store server reference for global teardown
  (globalThis as { __e2eServer?: Server }).__e2eServer = server;
}

export default globalSetup;
