# ADR-010: Hybrid Undo/Redo

## Status
Accepted

## Context

Undo/redo in a block editor with a persistent database is complex. Changes happen at two levels: editor state (keystrokes, formatting) and database state (block creation, deletion, moves).

## Decision

Hybrid approach:
- **ProseMirror handles editor-level undo** (within a single editing session, within a single block)
- **Database-level undo** via `block_history` relation for structural operations (block creation, deletion, moves, reordering)

## Consequences

- Typing undo is instant (ProseMirror's built-in history)
- Structural undo (e.g., "undo block deletion") queries `block_history` and reverses the operation
- `block_history` stores versioned snapshots: `{ block_id, version => content, parent_id, order, is_collapsed, is_deleted, operation, timestamp }`

<!-- TODO: Define which operations are editor-level vs database-level -->
<!-- TODO: Define the undo stack data structure -->
<!-- TODO: Define how undo interacts with the 300ms debounced persistence -->
<!-- TODO: Define undo behavior across page navigation -->
