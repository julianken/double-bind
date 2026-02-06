#!/usr/bin/env node
/**
 * Parse Playwright JSON results and print test summary
 *
 * Usage: node scripts/test-summary.js
 *
 * WHY THIS EXISTS:
 * Terminal output from Playwright may not show failure counts reliably
 * (background runs, TTY issues, etc.). The JSON reporter always writes
 * complete results to test-results/results.json. This script parses
 * that JSON and displays counts clearly.
 *
 * CRITICAL: AI agents MUST run `pnpm test:e2e:summary` after E2E tests
 * to verify results. NEVER claim "no failures" without checking the summary.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const resultsPath = path.join(__dirname, '..', 'test-results', 'results.json');

if (!fs.existsSync(resultsPath)) {
  console.error('ERROR: No test results found at test-results/results.json');
  console.error('Run: pnpm test:e2e');
  process.exit(1);
}

const results = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));

const stats = {
  total: 0,
  passed: 0,
  failed: 0,
  skipped: 0,
  flaky: 0,
};

// Count test outcomes
for (const suite of results.suites) {
  function countTests(suite) {
    for (const spec of suite.specs || []) {
      stats.total++;
      const status = spec.tests[0]?.results[0]?.status;

      if (status === 'passed') stats.passed++;
      else if (status === 'failed') stats.failed++;
      else if (status === 'skipped') stats.skipped++;
      else if (status === 'flaky') stats.flaky++;
    }

    for (const subsuite of suite.suites || []) {
      countTests(subsuite);
    }
  }

  countTests(suite);
}

// Print summary (matches Playwright format)
console.log('');
console.log('Test Results Summary:');
console.log('━'.repeat(50));

if (stats.failed > 0) {
  console.log(`  \x1b[31m${stats.failed} failed\x1b[0m`);
}
if (stats.flaky > 0) {
  console.log(`  \x1b[33m${stats.flaky} flaky\x1b[0m`);
}
if (stats.skipped > 0) {
  console.log(`  ${stats.skipped} skipped`);
}
console.log(`  \x1b[32m${stats.passed} passed\x1b[0m`);
console.log(`  ${stats.total} total`);
console.log('━'.repeat(50));
console.log('');

// Exit with error code if tests failed
process.exit(stats.failed > 0 ? 1 : 0);
