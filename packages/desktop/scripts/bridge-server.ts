/**
 * Standalone HTTP bridge server for browser development.
 *
 * Wraps cozo-node with Express on localhost:3001, providing the same
 * interface that HttpGraphDBProvider expects. Run alongside `pnpm dev`
 * to use the app in a browser without Tauri.
 *
 * Usage: npx tsx packages/desktop/scripts/bridge-server.ts
 */

import express from 'express';
import { CozoDb } from 'cozo-node';
import { runMigrations } from '@double-bind/migrations';
import type { GraphDB } from '@double-bind/types';

const PORT = Number(process.env.BRIDGE_PORT) || 3008;

// Create a persistent in-memory CozoDB instance
const db = new CozoDb('mem');

/**
 * Wrap cozo-node as a GraphDB so migrations can run against it.
 */
const graphDB: GraphDB = {
  async query(script, params = {}) {
    return db.run(script, params);
  },
  async mutate(script, params = {}) {
    return db.run(script, params);
  },
  async importRelations(data) {
    await db.importRelations(data);
  },
  async exportRelations(relations) {
    return db.exportRelations(relations);
  },
  async backup() {},
  async restore() {},
  async importRelationsFromBackup() {},
  async close() {},
};

function extractCozoError(result: unknown): string {
  if (!result || typeof result !== 'object') return String(result);
  const r = result as Record<string, unknown>;
  if ('message' in r && typeof r.message === 'string') return r.message;
  if ('display' in r && typeof r.display === 'string') return r.display;
  return JSON.stringify(result);
}

async function main() {
  // Run migrations to set up schema
  console.log('Running migrations...');
  await runMigrations(graphDB);
  console.log('Migrations complete.');

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
        case 'query':
        case 'mutate': {
          const result = await db.run(
            args.script as string,
            (args.params as Record<string, unknown>) ?? {}
          );
          res.json(result);
          break;
        }
        case 'import_relations': {
          await db.importRelations(args.data as Record<string, unknown>);
          res.json({});
          break;
        }
        case 'export_relations': {
          const result = await db.exportRelations(args.relations as string[]);
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
      const msg = error instanceof Error ? error.message : extractCozoError(error);
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
