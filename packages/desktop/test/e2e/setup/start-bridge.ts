/**
 * Standalone bridge server for manual E2E testing.
 * Run with: node --import tsx test/e2e/setup/start-bridge.ts
 */

import Database from 'better-sqlite3';
import { runSqliteMigrations, ALL_SQLITE_MIGRATIONS } from '@double-bind/migrations';
import express from 'express';

const PORT = 3001;

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

async function main() {
  console.log('Creating in-memory SQLite database...');
  let currentDb = createDatabase();

  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // CORS middleware
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
    } else {
      next();
    }
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.post('/reset', async (_req, res) => {
    try {
      console.log('Resetting database...');
      currentDb = createDatabase();
      res.json({ success: true });
    } catch (e) {
      console.error('Reset error:', e);
      res.status(500).json({ error: String(e) });
    }
  });

  app.post('/invoke', async (req, res) => {
    const { cmd, args } = req.body;
    try {
      const script = args.script as string;
      const params = prepareParams(args.params || {});
      const stmt = currentDb.prepare(script);

      const isSelect = /^\s*SELECT/i.test(script);
      const hasReturning = /\bRETURNING\b/i.test(script);

      if (isSelect || hasReturning || cmd === 'query') {
        const rows = stmt.all(params);
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
        const result = stmt.run(params);
        res.json({ headers: ['affected_rows'], rows: [[result.changes]] });
      }
    } catch (e) {
      console.error(`Invoke error for ${cmd}:`, e);
      res.status(500).json({ error: String(e) });
    }
  });

  app.listen(PORT, () => {
    console.log(`E2E bridge server running on http://localhost:${PORT}`);
  });
}

main().catch(console.error);
