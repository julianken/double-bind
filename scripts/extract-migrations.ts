#!/usr/bin/env tsx
/**
 * extract-migrations.ts
 *
 * Extracts CozoScript migration strings from TypeScript sources into plain
 * .sql files for Rust include_str!() embedding in the Tauri desktop app.
 *
 * Usage: pnpm extract-migrations
 *
 * This bridges TypeScript migration definitions to the Rust binary at compile
 * time, enabling migrations to run in the Tauri .setup() hook before the
 * webview loads.
 */

import { writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Get the project root (scripts/ is one level down from root)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Output directory for extracted SQL files
const outDir = join(projectRoot, 'packages/desktop/src-tauri/migrations');

// Logging utilities for CLI output (not debugging - intentional progress output)
const log = (msg: string) => process.stdout.write(msg + '\n');
const warn = (msg: string) => process.stderr.write('Warning: ' + msg + '\n');
const error = (msg: string) => process.stderr.write('Error: ' + msg + '\n');

async function main() {
  log('Extracting migrations...');

  // Import the migrations package using relative path from project root
  // tsx handles the TypeScript import directly
  const { ALL_MIGRATIONS } = await import('../packages/migrations/src/index.js');

  if (!ALL_MIGRATIONS || ALL_MIGRATIONS.length === 0) {
    warn('No migrations found in ALL_MIGRATIONS');
    process.exit(0);
  }

  // Create output directory if it doesn't exist
  mkdirSync(outDir, { recursive: true });
  log(`Output directory: ${outDir}`);

  // Clean up existing .sql files to avoid stale migrations
  if (existsSync(outDir)) {
    const existingFiles = readdirSync(outDir).filter((f) => f.endsWith('.sql'));
    for (const file of existingFiles) {
      unlinkSync(join(outDir, file));
    }
    if (existingFiles.length > 0) {
      log(`Cleaned ${existingFiles.length} existing .sql file(s)`);
    }
  }

  // Extract each migration's up script to a .sql file
  let extractedCount = 0;
  for (const migration of ALL_MIGRATIONS) {
    const filename = `${migration.name}.sql`;
    const filepath = join(outDir, filename);

    // Write the up script exactly as defined
    writeFileSync(filepath, migration.up, 'utf-8');
    log(`  Extracted: ${filename}`);
    extractedCount++;
  }

  log(`\nSuccessfully extracted ${extractedCount} migration(s) to ${outDir}`);
}

main().catch((err) => {
  error(`Failed to extract migrations: ${err}`);
  process.exit(1);
});
