/**
 * Tests for extract-migrations.ts
 *
 * These tests verify that the migration extraction script correctly:
 * - Creates the output directory if it doesn't exist
 * - Extracts all migrations from ALL_MIGRATIONS
 * - Writes the exact .up content to .sql files
 * - Cleans up stale .sql files
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Output directory for extracted SQL files (same as in the script)
const outDir = join(projectRoot, 'packages/desktop/src-tauri/migrations');

describe('extract-migrations script', () => {
  beforeEach(() => {
    // Clean up output directory before each test
    if (existsSync(outDir)) {
      const files = readdirSync(outDir).filter((f) => f.endsWith('.sql'));
      for (const file of files) {
        rmSync(join(outDir, file));
      }
    }
  });

  afterEach(() => {
    // Clean up after tests
    if (existsSync(outDir)) {
      const files = readdirSync(outDir).filter((f) => f.endsWith('.sql'));
      for (const file of files) {
        rmSync(join(outDir, file));
      }
    }
  });

  it('creates the output directory if it does not exist', () => {
    // Remove the directory if it exists
    if (existsSync(outDir)) {
      rmSync(outDir, { recursive: true });
    }

    // Run the extraction script
    // Note: execSync is safe here as we're running a fixed command with no user input
    execSync('pnpm extract-migrations', { cwd: projectRoot, stdio: 'pipe' });

    // Verify the directory was created
    expect(existsSync(outDir)).toBe(true);
  });

  it('extracts migration .sql files to the output directory', () => {
    // Run the extraction script
    execSync('pnpm extract-migrations', { cwd: projectRoot, stdio: 'pipe' });

    // Verify at least one .sql file was created
    const files = readdirSync(outDir).filter((f) => f.endsWith('.sql'));
    expect(files.length).toBeGreaterThan(0);
  });

  it('extracts 001-initial-schema.sql with correct content', async () => {
    // Run the extraction script
    execSync('pnpm extract-migrations', { cwd: projectRoot, stdio: 'pipe' });

    // Import ALL_MIGRATIONS to compare
    const { ALL_MIGRATIONS } = await import('../packages/migrations/src/index.js');
    const initialMigration = ALL_MIGRATIONS.find((m) => m.name === '001-initial-schema');
    expect(initialMigration).toBeDefined();

    // Read the extracted file
    const extractedPath = join(outDir, '001-initial-schema.sql');
    expect(existsSync(extractedPath)).toBe(true);

    const extractedContent = readFileSync(extractedPath, 'utf-8');

    // Verify content matches exactly
    expect(extractedContent).toBe(initialMigration!.up);
  });

  it('cleans up stale .sql files from previous runs', () => {
    // Create the output directory and a stale file
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, 'stale-migration.sql'), 'old content');

    // Run the extraction script
    execSync('pnpm extract-migrations', { cwd: projectRoot, stdio: 'pipe' });

    // Verify the stale file was removed
    expect(existsSync(join(outDir, 'stale-migration.sql'))).toBe(false);
  });

  it('names output files after migration names', async () => {
    // Run the extraction script
    execSync('pnpm extract-migrations', { cwd: projectRoot, stdio: 'pipe' });

    // Import ALL_MIGRATIONS
    const { ALL_MIGRATIONS } = await import('../packages/migrations/src/index.js');

    // Verify each migration has a corresponding .sql file
    for (const migration of ALL_MIGRATIONS) {
      const expectedPath = join(outDir, `${migration.name}.sql`);
      expect(existsSync(expectedPath)).toBe(true);
    }
  });

  it('is idempotent - running twice produces same result', async () => {
    // Run the extraction script twice
    execSync('pnpm extract-migrations', { cwd: projectRoot, stdio: 'pipe' });
    const files1 = readdirSync(outDir).filter((f) => f.endsWith('.sql')).sort();
    const content1 = files1.map((f) => readFileSync(join(outDir, f), 'utf-8'));

    execSync('pnpm extract-migrations', { cwd: projectRoot, stdio: 'pipe' });
    const files2 = readdirSync(outDir).filter((f) => f.endsWith('.sql')).sort();
    const content2 = files2.map((f) => readFileSync(join(outDir, f), 'utf-8'));

    // Verify same files and content
    expect(files1).toEqual(files2);
    expect(content1).toEqual(content2);
  });
});
