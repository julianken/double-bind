#!/usr/bin/env bash
# Hook: Block commits containing debug artifacts
# Blocks staging of debug-*.spec.ts and *.bak files.

set -euo pipefail

# Check for debug artifacts in staged files (files being committed)
staged_debug_files=$(git diff --cached --name-only --diff-filter=ACM | grep -E '(debug-.*\.spec\.ts|\.bak$)' || true)

if [ -n "$staged_debug_files" ]; then
  echo "BLOCKED: Debug artifacts staged for commit. Unstage or remove before committing:"
  echo "$staged_debug_files"
  exit 1
fi
