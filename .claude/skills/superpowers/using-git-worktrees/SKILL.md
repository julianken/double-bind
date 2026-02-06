---
name: using-git-worktrees
description: Create isolated git worktrees with E2E port isolation for parallel development
disable-model-invocation: true
---

# Using Git Worktrees with E2E Port Isolation

## Overview

Git worktrees allow you to have multiple working directories for the same repository, enabling true parallel development without branch switching. This skill covers creating worktrees with proper E2E test port isolation.

## Creating a Worktree

```bash
# 1. Create the worktree
git worktree add ../wt-<ISSUE>-<description> -b <branch-name>

# 2. Navigate to worktree
cd ../wt-<ISSUE>-<description>

# 3. Set up E2E port isolation (MANDATORY)
./scripts/setup-worktree-e2e.sh

# 4. Verify setup
cat .env.e2e  # Shows your isolated ports
```

### Example

```bash
# Create worktree for BEA-330
git worktree add ../wt-BEA-330-login-form -b feat/BEA-330-login-form
cd ../wt-BEA-330-login-form

# Set up port isolation
./scripts/setup-worktree-e2e.sh

# Verify
cat .env.e2e
# Output:
# E2E_PORT_BASE=3573
# BINGO_PORT=3573
# TRIVIA_PORT=3574
# HUB_PORT=3575
```

## Starting Dev Servers

### Option A: Use Helper Script (Recommended)

```bash
./start-e2e-servers.sh
```

This script:
- Sources `.env.e2e` automatically
- Starts all three dev servers on isolated ports
- Runs servers in background with proper process management

### Option B: Manual (with Port Awareness)

```bash
# Load port configuration
source .env.e2e

# Start each server on its isolated port
PORT=$BINGO_PORT pnpm --filter @beak-gaming/bingo dev &
PORT=$TRIVIA_PORT pnpm --filter @beak-gaming/trivia dev &
PORT=$HUB_PORT pnpm --filter @beak-gaming/platform-hub dev &
```

## Running E2E Tests

After servers are running, E2E tests automatically use the correct ports:

```bash
# Playwright auto-detects worktree and uses ports from .env.e2e
pnpm test:e2e

# Run specific test file
pnpm test:e2e e2e/bingo/home.spec.ts
```

## Port Allocation

The port allocation system uses a deterministic hash of the worktree path:

```
Main repo:     ports 3000, 3001, 3002
Worktree 1:    ports 3XXX, 3XXX, 3XXX (based on path hash)
Worktree 2:    ports 3YYY, 3YYY, 3YYY (different hash)
Worktree 3:    ports 3ZZZ, 3ZZZ, 3ZZZ (different hash)
```

**Range:** 3000-3999 (supports up to 333 concurrent worktrees)

## Why Port Isolation Matters

### Without Port Isolation ❌

```bash
# Main repo running on 3000-3002
pnpm dev

# Worktree tries to use same ports
cd ../wt-BEA-330-login-form
pnpm dev  # ❌ EADDRINUSE: address already in use :::3000
```

**Result:** Port conflicts, servers fail to start, E2E tests cannot run.

### With Port Isolation ✅

```bash
# Main repo on 3000-3002
pnpm dev

# Worktree uses isolated ports (e.g., 3573-3575)
cd ../wt-BEA-330-login-form
./scripts/setup-worktree-e2e.sh
./start-e2e-servers.sh  # ✅ Servers start on 3573-3575
```

**Result:** True parallel development - main repo and multiple worktrees run simultaneously.

## Cleanup

When done with a worktree:

```bash
# Stop servers (if running in background)
pkill -f "next-server.*3573"  # Replace 3573 with your base port

# Remove worktree
cd /path/to/main/repo
git worktree remove ../wt-BEA-330-login-form
```

## Troubleshooting

### "Missing .env.e2e file"

**Problem:** Forgot to run setup script after creating worktree.

**Fix:**
```bash
./scripts/setup-worktree-e2e.sh
```

### "Port already in use"

**Problem:** Another worktree or process is using the calculated port.

**Fix:**
```bash
# Override with specific port
E2E_PORT_BASE=3999 ./scripts/setup-worktree-e2e.sh

# Verify new ports
cat .env.e2e
```

### "Playwright uses wrong ports"

**Problem:** `.env.e2e` exists but Playwright config not loading it.

**Fix:**
```bash
# Verify portConfig is exported in playwright.config.ts
grep -A 10 "export const portConfig" playwright.config.ts

# Verify worktree detection
pnpm test:e2e --list  # Should show detected worktree in URL
```

## Reference

- **Setup Script:** `scripts/setup-worktree-e2e.sh`
- **Port Isolation Module:** `e2e/utils/port-isolation.ts`
- **Playwright Config:** `playwright.config.ts` (exports `portConfig`)
- **Full Documentation:** `docs/E2E_TESTING_GUIDE.md` section "Parallel Task Execution with Port Isolation"

## Best Practices

1. **Always run setup script immediately after creating worktree**
2. **Use `./start-e2e-servers.sh` for consistent server startup**
3. **Verify `.env.e2e` exists before running E2E tests**
4. **Clean up worktrees when done to free resources**
5. **Don't commit `.env.e2e` to version control** (already in .gitignore)

## Integration with Subagent Workflow

When using the subagent workflow:

- **Step 2:** Create worktree + run setup script (both required)
- **Step 3:** Implementer agents use `./start-e2e-servers.sh` to start servers
- **Step 4-5:** Reviewers verify `.env.e2e` exists and servers run on isolated ports
- **Step 6:** Cleanup worktree after PR merged

This ensures true parallel execution across multiple Linear issues without port conflicts.
