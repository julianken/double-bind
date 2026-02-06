# Research Contributions

## Overview

Double-bind targets four computer science contributions, each representing a novel application of established techniques to personal knowledge management.

## Contributions

| # | Contribution | Document | Status |
|---|-------------|----------|--------|
| 1 | [Datalog as User-Facing Query Language](datalog-for-pkm.md) | Datalog as accessible query language for personal knowledge | Design phase |
| 2 | [Graph Algorithms for PKM](graph-algorithms.md) | Network science applied to knowledge graphs | Design phase |
| 3 | [Local-First Graph-Native Architecture](local-first-architecture.md) | Fast graph database on local hardware | Design phase |
| 4 | [Terminal Client for Graph Knowledge](terminal-client.md) | TUI that shares core logic with GUI | Design phase |

## What "Contribution" Means Here

These are not necessarily academic paper contributions (though they could become that). They represent areas where double-bind does something that existing tools do not, backed by concrete technical work rather than marketing claims.

Each contribution has:
- A clear **thesis** (what we claim)
- **Prior art** (what exists, what's missing)
- **Technical approach** (how we implement it)
- **Evaluation criteria** (how we know it works)
- **Open questions** (what we don't know yet)

## Relationship Between Contributions

```
Contribution 3 (Local-First Architecture)
    └── Foundation: provides the fast graph DB that makes 1 and 2 possible

Contribution 1 (Datalog for PKM)
    └── User interface to the database
    └── Enables: saved queries as dynamic views

Contribution 2 (Graph Algorithms)
    └── Depends on: the link graph stored in CozoDB
    └── Complements: Datalog queries with algorithmic analysis

Contribution 4 (Terminal Client)
    └── Depends on: shared core logic (validates architecture)
    └── Independent: doesn't affect 1-3
```

<!-- TODO: Define evaluation methodology for each contribution -->
<!-- TODO: Define benchmarking protocol for performance claims -->
<!-- TODO: Identify target venues for potential publication -->
