/**
 * Playwright Global Teardown - Close HTTP Bridge Server
 *
 * @see docs/testing/e2e-fast.md
 */

import type { FullConfig } from '@playwright/test';
import type { Server } from 'http';

async function globalTeardown(_config: FullConfig): Promise<void> {
  const server = (globalThis as { __e2eServer?: Server }).__e2eServer;

  if (server) {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    console.log('E2E HTTP bridge server stopped');
  }
}

export default globalTeardown;
