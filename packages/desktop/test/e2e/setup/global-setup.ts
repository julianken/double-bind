/**
 * Playwright Global Setup - HTTP Bridge Server
 *
 * Starts a lightweight Node.js server that wraps better-sqlite3 and listens on localhost:3001.
 * The mockIPC() callback in the browser sends fetch() requests to this server.
 *
 * @see docs/testing/e2e-fast.md
 */

import type { FullConfig } from '@playwright/test';
import express, { type Request, type Response, type Express } from 'express';
import type { Server } from 'http';
import Database from 'better-sqlite3';
import { ALL_SQLITE_MIGRATIONS } from '@double-bind/migrations';

const BRIDGE_PORT = 3001;
const BRIDGE_URL = `http://localhost:${BRIDGE_PORT}`;
const HEALTH_CHECK_TIMEOUT = 10000; // 10 seconds
const HEALTH_CHECK_INTERVAL = 100; // 100ms between retries

// Store the server instance for teardown
let server: Server | null = null;

// Store the DB in an object so it can be swapped out and routes will get the new instance
const dbContainer: { db: Database.Database | null } = { db: null };

/**
 * Prepare parameter values for better-sqlite3 named parameters.
 * better-sqlite3 expects bare names (e.g., { title: "abc" }) even when SQL uses $title.
 * Strips $ prefix if present and converts boolean values to 0/1 for SQLite.
 */
function prepareParams(params: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    const bareKey = key.startsWith('$') ? key.slice(1) : key;
    if (typeof value === 'boolean') {
      result[bareKey] = value ? 1 : 0;
    } else {
      result[bareKey] = value;
    }
  }
  return result;
}

/**
 * Execute a SQL query and return results in { headers, rows } format.
 */
function executeQuery(
  db: Database.Database,
  script: string,
  params: Record<string, unknown>
): { headers: string[]; rows: unknown[][] } {
  const sqliteParams = prepareParams(params);
  const stmt = db.prepare(script);
  const rows = stmt.all(sqliteParams);

  if (rows.length === 0) {
    const columns = stmt.columns();
    const headers = columns.map((col) => col.name);
    return { headers, rows: [] };
  }

  const firstRow = rows[0] as Record<string, unknown>;
  const headers = Object.keys(firstRow);
  const arrayRows = rows.map((row) => {
    const obj = row as Record<string, unknown>;
    return headers.map((h) => obj[h]);
  });

  return { headers, rows: arrayRows };
}

/**
 * Execute a SQL mutation and return { headers, rows } format.
 */
function executeMutate(
  db: Database.Database,
  script: string,
  params: Record<string, unknown>
): { headers: string[]; rows: unknown[][] } {
  const sqliteParams = prepareParams(params);
  const hasReturning = /\bRETURNING\b/i.test(script);

  if (hasReturning) {
    const stmt = db.prepare(script);
    const rows = stmt.all(sqliteParams);

    if (rows.length === 0) {
      return { headers: [], rows: [] };
    }

    const firstRow = rows[0] as Record<string, unknown>;
    const headers = Object.keys(firstRow);
    const arrayRows = rows.map((row) => {
      const obj = row as Record<string, unknown>;
      return headers.map((h) => obj[h]);
    });

    return { headers, rows: arrayRows };
  }

  const stmt = db.prepare(script);
  const result = stmt.run(sqliteParams);
  return { headers: ['affected_rows'], rows: [[result.changes]] };
}

/**
 * Create a new in-memory SQLite database with schema applied.
 *
 * Uses better-sqlite3's exec() directly instead of runSqliteMigrations() because
 * the runner's ensureSchemaMetadataTable() conflicts with the migration's own
 * CREATE TABLE schema_metadata, and the runner's statement splitter incorrectly
 * parses trigger bodies. better-sqlite3's exec() handles multi-statement SQL natively.
 */
function createDatabase(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Apply migration SQL directly — better-sqlite3's exec() handles
  // multi-statement SQL including triggers, FTS5 tables, and inserts.
  for (const migration of ALL_SQLITE_MIGRATIONS) {
    try {
      db.exec(migration.up);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`SQLite migration '${migration.name}' failed: ${msg}`);
    }
  }

  return db;
}

/**
 * Reset the database to a clean state.
 * Creates a new in-memory database and sets up the schema.
 */
async function resetDatabase(): Promise<void> {
  const newDb = createDatabase();

  // Verify schema is ready
  const row = newDb
    .prepare("SELECT value FROM schema_metadata WHERE key = 'schema_version'")
    .get() as { value: string } | undefined;

  if (!row) {
    throw new Error('Schema initialization failed: schema_version metadata not set');
  }

  // Only assign to dbContainer AFTER schema is fully initialized
  dbContainer.db = newDb;
}

async function globalSetup(_config: FullConfig): Promise<void> {
  // Create in-memory SQLite instance and set up schema
  dbContainer.db = createDatabase();
  console.log('Initial E2E schema setup complete (SQLite)');

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

  // Health check endpoint for server readiness verification
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
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
          const result = executeQuery(db, script, params);
          res.json(result);
          break;
        }
        case 'mutate': {
          const script = args.script as string;
          const params = (args.params as Record<string, unknown>) ?? {};
          const result = executeMutate(db, script, params);
          res.json(result);
          break;
        }
        case 'import_relations': {
          // Bulk import not commonly used in E2E tests; basic implementation
          res.json({});
          break;
        }
        case 'export_relations': {
          const relations = args.relations as string[];
          const result: Record<string, unknown[][]> = {};
          for (const table of relations) {
            const rows = db.prepare(`SELECT * FROM ${table}`).all();
            result[table] = rows.map((row) =>
              Object.values(row as Record<string, unknown>)
            );
          }
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
      const errorMessage = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: errorMessage });
    }
  });

  // Start server and wait for it to be listening
  await new Promise<void>((resolve, reject) => {
    server = app.listen(BRIDGE_PORT, () => {
      console.log(`E2E HTTP bridge server listening on port ${BRIDGE_PORT}`);
      resolve();
    });
    server.on('error', reject);
  });

  // Store server reference for global teardown
  (globalThis as { __e2eServer?: Server }).__e2eServer = server;

  // Wait for server to be ready by checking health endpoint
  const startTime = Date.now();
  let lastError: Error | null = null;

  while (Date.now() - startTime < HEALTH_CHECK_TIMEOUT) {
    try {
      const response = await fetch(`${BRIDGE_URL}/health`);
      if (response.ok) {
        console.log('E2E HTTP bridge server health check passed');
        return;
      }
      lastError = new Error(`Health check returned status ${response.status}`);
    } catch (error) {
      lastError = error as Error;
    }
    await new Promise((resolve) => setTimeout(resolve, HEALTH_CHECK_INTERVAL));
  }

  throw new Error(
    `E2E HTTP bridge server failed health check after ${HEALTH_CHECK_TIMEOUT}ms: ${lastError?.message}`
  );
}

export default globalSetup;
