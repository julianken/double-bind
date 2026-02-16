/**
 * Standalone HTTP bridge server for browser development.
 *
 * Wraps better-sqlite3 with Express on localhost:3008, providing the same
 * interface that HttpGraphDBProvider expects. Run alongside `pnpm dev`
 * to use the app in a browser without Tauri.
 *
 * Usage: npx tsx packages/desktop/scripts/bridge-server.ts
 */

import express from 'express';
import Database from 'better-sqlite3';
import { ALL_SQLITE_MIGRATIONS } from '@double-bind/migrations';

const PORT = Number(process.env.BRIDGE_PORT) || 3008;

// Create a persistent in-memory SQLite instance
const db = new Database(':memory:');
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

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

async function main() {
  // Apply migration SQL directly using better-sqlite3's Database.exec() method.
  // This is NOT child_process.exec — it's the SQLite driver's native multi-statement
  // SQL execution, which correctly handles triggers, FTS5 tables, etc.
  for (const migration of ALL_SQLITE_MIGRATIONS) {
    try {
      db.exec(migration.up);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`SQLite migration '${migration.name}' failed: ${msg}`);
    }
  }

  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // CORS
  app.use((_req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
  });
  app.options('/invoke', (_req, res) => res.sendStatus(200));

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  app.post('/invoke', async (req, res) => {
    const { cmd, args } = req.body as { cmd: string; args: Record<string, unknown> };

    try {
      switch (cmd) {
        case 'query': {
          const result = executeQuery(
            args.script as string,
            (args.params as Record<string, unknown>) ?? {}
          );
          res.json(result);
          break;
        }
        case 'mutate': {
          const result = executeMutate(
            args.script as string,
            (args.params as Record<string, unknown>) ?? {}
          );
          res.json(result);
          break;
        }
        case 'import_relations': {
          // Basic import support
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
        case 'backup':
        case 'restore':
        case 'import_relations_from_backup':
          res.json({});
          break;
        default:
          res.status(400).json({ error: `Unknown command: ${cmd}` });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[bridge] ${cmd} error:`, msg);
      res.status(500).json({ error: msg });
    }
  });

  app.listen(PORT, () => {
    console.log(`Bridge server listening on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error('Failed to start bridge server:', err);
  process.exit(1);
});
