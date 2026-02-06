#!/usr/bin/env bash
# Hook: Block commits with console.log debugging statements in staged files
# Allows console.log in test files, config files, and legitimate logging utilities.

set -euo pipefail

# Get staged .ts/.tsx/.js/.jsx files (excluding tests, configs, and logging utilities)
staged_files=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|tsx|js|jsx)$' | grep -vE '(\.test\.|\.spec\.|__tests__|e2e/|\.config\.|eslint|jest|vitest|playwright|error-tracking)' || true)

if [ -z "$staged_files" ]; then
  exit 0
fi

# Check for console.log in staged content (not the whole file, just the staged diff)
matches=$(git diff --cached -U0 -- $staged_files | grep '^+' | grep -v '^+++' | grep 'console\.log(' || true)

if [ -n "$matches" ]; then
  echo "BLOCKED: console.log() found in staged changes. Remove debugging statements before committing:"
  echo "$matches"
  exit 1
fi
