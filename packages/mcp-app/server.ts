/**
 * Double-Bind MCP App Server
 *
 * Starts a CozoDB instance, runs migrations, seeds demo data,
 * and exposes the knowledge base as MCP tools over HTTP.
 */

console.log('Starting Double-Bind MCP App server...');

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import cors from 'cors';
import express from 'express';
import { createCozoNodeDatabase } from './src/db/cozo-adapter.js';
import { createServices } from '@double-bind/core';
import type { Services } from '@double-bind/core';
import type { Database } from '@double-bind/types';
import { runMigrations } from '@double-bind/migrations';
import { registerTools } from './src/tools/index.js';
import { seedDemoData } from './src/db/seed.js';

const PORT = Number(process.env.PORT) || 3002;
const DB_ENGINE = (process.env.DB_ENGINE as 'mem' | 'rocksdb' | 'sqlite') || 'mem';
const DB_PATH = process.env.DB_PATH;

/** Create a new McpServer instance with all tools registered. */
function createMcpServerInstance(services: Services, db: Database): McpServer {
  const server = new McpServer({
    name: 'Double-Bind Knowledge Graph',
    version: '0.1.0',
  });
  registerTools(server, services, db);
  return server;
}

async function main() {
  // 1. Initialize database
  console.log(`Initializing CozoDB (engine=${DB_ENGINE}${DB_PATH ? `, path=${DB_PATH}` : ''})...`);
  const db = createCozoNodeDatabase(DB_ENGINE, DB_PATH);

  // 2. Run migrations
  console.log('Running migrations...');
  await runMigrations(db);
  console.log('Migrations complete.');

  // 3. Create services (shared across all sessions)
  const services = createServices(db);

  // 4. Seed demo data if using in-memory engine
  if (DB_ENGINE === 'mem') {
    console.log('Seeding demo data...');
    await seedDemoData(services);
    console.log('Demo data seeded.');
  }

  // 5. HTTP server with per-session MCP instances
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Each session gets its own McpServer + Transport pair
  const sessions = new Map<string, { transport: StreamableHTTPServerTransport; server: McpServer }>();

  app.post('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    // Route to existing session
    if (sessionId && sessions.has(sessionId)) {
      const session = sessions.get(sessionId)!;
      await session.transport.handleRequest(req, res, req.body);
      return;
    }

    // Unknown session ID — return 404 so client re-initializes
    // (MCP spec: client should start a new session on 404)
    if (sessionId && !sessions.has(sessionId)) {
      res.status(404).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Session expired. Please reconnect.' },
        id: null,
      });
      return;
    }

    // New session: create McpServer + Transport pair
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
      enableJsonResponse: true,
    });

    const mcpServer = createMcpServerInstance(services, db);

    transport.onclose = () => {
      const sid = res.getHeader('mcp-session-id') as string;
      if (sid) sessions.delete(sid);
    };

    await mcpServer.connect(transport);
    await transport.handleRequest(req, res, req.body);

    // Store session for subsequent requests
    const newSessionId = res.getHeader('mcp-session-id') as string;
    if (newSessionId) {
      sessions.set(newSessionId, { transport, server: mcpServer });
    }
  });

  // GET for SSE streams
  app.get('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (!sessionId || !sessions.has(sessionId)) {
      res.status(400).json({ error: 'Session ID required for SSE' });
      return;
    }
    await sessions.get(sessionId)!.transport.handleRequest(req, res);
  });

  // DELETE for session cleanup
  app.delete('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (sessionId && sessions.has(sessionId)) {
      const session = sessions.get(sessionId)!;
      await session.transport.close();
      await session.server.close();
      sessions.delete(sessionId);
    }
    res.status(200).end();
  });

  app.listen(PORT, () => {
    console.log(`\nDouble-Bind MCP server listening on http://localhost:${PORT}/mcp`);
    console.log('Add this URL as a custom MCP connector in Claude Desktop or ChatGPT.\n');
  });
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
