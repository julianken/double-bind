// 002-starred-pages: Adds starred_pages table for bookmarking pages
//
// This migration adds user-facing "star" functionality:
//
// 1. starred_pages table - tracks which pages the user has starred
// 2. Index on starred_at DESC - enables efficient recency-ordered retrieval
//
// Creates:
// - starred_pages: FK to pages(page_id) with CASCADE delete
// - idx_starred_pages_starred_at: sorted by star time for ordered listing

import type { SqliteMigration } from '../sqlite-types.js';

/**
 * Starred pages migration for Double-Bind SQLite.
 *
 * Adds a table to track user-starred pages with timestamp ordering.
 */
export const migration: SqliteMigration = {
  version: 2,
  name: '002-starred-pages',

  up: `
CREATE TABLE IF NOT EXISTS starred_pages (
  page_id TEXT NOT NULL REFERENCES pages(page_id) ON DELETE CASCADE,
  starred_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (page_id)
);

CREATE INDEX IF NOT EXISTS idx_starred_pages_starred_at ON starred_pages(starred_at DESC);
`,

  down: `
DROP INDEX IF EXISTS idx_starred_pages_starred_at;

DROP TABLE IF EXISTS starred_pages;
`,
};
