/**
 * Standalone bridge server for manual E2E testing.
 * Run with: node --import tsx test/e2e/setup/start-bridge.ts
 */

import { CozoDb } from 'cozo-node';
import express from 'express';

const PORT = 3001;

// Initialize schema - matches global-setup.ts schema for consistency
async function initializeSchema(db: CozoDb): Promise<void> {
  const statements = [
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
    `:create blocks_by_page { page_id: String, block_id: String }`,
    `:create blocks_by_parent { parent_id: String, block_id: String }`,
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
    `:create daily_notes { date: String => page_id: String }`,
    `:create metadata { key: String => value: String }`,
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

  for (const stmt of statements) {
    await db.run(stmt);
  }
}

async function main() {
  console.log('Creating in-memory CozoDB...');
  let currentDb = new CozoDb('mem');
  await initializeSchema(currentDb);

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
      currentDb = new CozoDb('mem');
      await initializeSchema(currentDb);
      res.json({ success: true });
    } catch (e) {
      console.error('Reset error:', e);
      res.status(500).json({ error: String(e) });
    }
  });

  app.post('/invoke', async (req, res) => {
    const { cmd, args } = req.body;
    try {
      const result = await currentDb.run(args.script, args.params || {});
      res.json(result);
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
