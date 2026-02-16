#!/usr/bin/env npx tsx
/**
 * Standalone HTTP Bridge Server
 *
 * Run this to use the browser version of the app without Playwright tests.
 * Usage: npx tsx packages/desktop/test/e2e/setup/run-bridge.ts
 */

import express, { type Request, type Response, type Express } from 'express';
import Database from 'better-sqlite3';
import { runSqliteMigrations, ALL_SQLITE_MIGRATIONS } from '@double-bind/migrations';

const BRIDGE_PORT = 3001;

// Store the DB in an object so it can be swapped out
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
 * Create a new in-memory SQLite database with schema applied.
 */
function createDatabase(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const migrationResult = runSqliteMigrations(db, ALL_SQLITE_MIGRATIONS);
  if (migrationResult.errors.length > 0) {
    throw new Error(`SQLite migration failed: ${migrationResult.errors[0]?.error}`);
  }

  return db;
}

/**
 * Reset the database to a clean state.
 */
async function resetDatabase(): Promise<void> {
  dbContainer.db = createDatabase();
  console.log('Database reset complete');
}

async function main(): Promise<void> {
  // Create in-memory SQLite instance and set up schema
  dbContainer.db = createDatabase();
  console.log('Schema setup complete (SQLite)');

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
        case 'query':
        case 'mutate': {
          const script = args.script as string;
          const params = (args.params as Record<string, unknown>) ?? {};
          const sqliteParams = prepareParams(params);
          const stmt = db.prepare(script);

          const hasReturning = /\bRETURNING\b/i.test(script);
          const isSelect = /^\s*SELECT/i.test(script);

          if (isSelect || hasReturning || cmd === 'query') {
            const rows = stmt.all(sqliteParams);
            if (rows.length === 0) {
              const columns = stmt.columns();
              res.json({ headers: columns.map((c) => c.name), rows: [] });
            } else {
              const firstRow = rows[0] as Record<string, unknown>;
              const headers = Object.keys(firstRow);
              const arrayRows = rows.map((row) => {
                const obj = row as Record<string, unknown>;
                return headers.map((h) => obj[h]);
              });
              res.json({ headers, rows: arrayRows });
            }
          } else {
            const result = stmt.run(sqliteParams);
            res.json({ headers: ['affected_rows'], rows: [[result.changes]] });
          }
          break;
        }
        case 'import_relations': {
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
    console.log(`\nHTTP Bridge Server running on http://localhost:${BRIDGE_PORT}`);
    console.log(`   Health check: http://localhost:${BRIDGE_PORT}/health`);
    console.log(`   Reset DB: POST http://localhost:${BRIDGE_PORT}/reset`);
    console.log(`\n   Now start Vite dev server: pnpm dev`);
    console.log(`   Then open: http://localhost:5173\n`);
  });
}

main().catch(console.error);
