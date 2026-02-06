# WASM Acceleration (Future Option)

## Status

**Not implemented.** This document describes a future optimization path if profiling reveals JavaScript performance bottlenecks.

## Overview

The hybrid approach preserves TypeScript for business logic while adding Rust-compiled-to-WASM for specific hot paths. This provides:
- Surgical performance improvements where needed
- No architecture changes (TypeScript orchestration remains)
- Minimal documentation impact (~3-5 files)
- Easy rollback (keep TypeScript implementation as fallback)

## Candidates for WASM Acceleration

| Module | Current | WASM Candidate | Trigger Condition |
|--------|---------|----------------|-------------------|
| `graph-algorithms` | TypeScript | Rust → WASM | Algorithms slow on >10K nodes |
| Content parser | TypeScript regex | Rust nom → WASM | Parsing slow on >100KB blocks |
| Fractional rebalance | TypeScript | Rust → WASM | Rebalancing >10K blocks slow |

## Implementation Pattern

### 1. Profile First

Never optimize without measurement:

```bash
# Browser DevTools
Performance tab → Record → Execute operation → Analyze

# Node.js (for CLI/TUI)
node --prof app.js
node --prof-process isolate-*.log
```

### 2. Write Rust Module

```rust
// crates/graph-algorithms-wasm/src/lib.rs
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn link_prediction(nodes: &[u8], edges: &[u8]) -> Vec<u8> {
    // Deserialize, compute, serialize
}
```

### 3. Build WASM

```bash
wasm-pack build --target web crates/graph-algorithms-wasm
```

### 4. Call from TypeScript

```typescript
// packages/graph-algorithms/src/link-prediction.ts
import init, { link_prediction } from 'graph-algorithms-wasm';

let wasmReady = false;

export async function predictLinks(graph: Graph): Promise<LinkPrediction[]> {
  // Fallback to JS implementation if WASM unavailable
  if (!wasmReady) {
    try {
      await init();
      wasmReady = true;
    } catch {
      return predictLinksJS(graph); // TypeScript fallback
    }
  }

  const nodes = encodeNodes(graph.nodes);
  const edges = encodeEdges(graph.edges);
  const result = link_prediction(nodes, edges);
  return decodeResult(result);
}
```

## When NOT to Use WASM

- **IPC-bound operations**: If waiting on CozoDB, WASM won't help
- **Rendering-bound operations**: React/DOM is the bottleneck, not JS computation
- **Small data**: Serialization overhead exceeds computation time
- **Simple logic**: CRUD, validation, orchestration — TypeScript is fast enough

## Build Integration

If WASM is adopted, add to monorepo:

```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'
  - 'crates/*'  # Rust/WASM packages
```

```json
// package.json scripts
{
  "build:wasm": "wasm-pack build --target web crates/graph-algorithms-wasm",
  "build": "pnpm build:wasm && pnpm -r build"
}
```

## Documentation Impact

Adding WASM acceleration requires updating:
1. This file (implementation details)
2. `packages/graph-algorithms.md` (WASM variant)
3. `infrastructure/build-tooling.md` (wasm-pack setup)
4. `monorepo.md` (Cargo workspace)
5. Relevant ADR addendum

**No core architecture changes required.**

## Decision History

- **February 2026**: Full Rust migration evaluated and rejected. Hybrid WASM path documented as future option.
- **Trigger**: Implement when profiling proves JavaScript is a bottleneck for specific operations.
