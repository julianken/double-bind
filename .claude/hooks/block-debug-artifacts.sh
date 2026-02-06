#!/usr/bin/env bash
# Hook: Block commits when debug artifacts exist in the working tree
# Checks for debug-*.spec.ts and .bak files that should not be committed.

set -euo pipefail

debug_files=$(git status --short | grep -E '(debug-.*\.spec\.ts|\.bak$)' || true)

if [ -n "$debug_files" ]; then
  echo "BLOCKED: Debug artifacts detected in working tree. Remove before committing:"
  echo "$debug_files"
  exit 1
fi
