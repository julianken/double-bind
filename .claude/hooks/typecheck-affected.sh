#!/usr/bin/env bash
# Hook: Run typecheck on packages with staged changes
# Runs tsc --noEmit for each affected package.

set -euo pipefail

# Get unique packages with staged TypeScript changes
affected_packages=$(git diff --cached --name-only --diff-filter=ACM | grep -E '^packages/[^/]+/.*\.(ts|tsx)$' | cut -d/ -f2 | sort -u || true)

if [ -z "$affected_packages" ]; then
  exit 0
fi

echo "Running typecheck on affected packages..."

for pkg in $affected_packages; do
  if [ -d "packages/$pkg" ] && [ -f "packages/$pkg/tsconfig.json" ]; then
    echo "  Typechecking packages/$pkg..."
    pnpm --filter "@double-bind/$pkg" typecheck || exit 1
  fi
done

echo "Typecheck passed."
