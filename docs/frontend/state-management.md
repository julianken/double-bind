# State Management

<!-- last-verified: 2026-02-16 -->

## Two-Source Architecture

| Source of Truth         | What It Owns                                           | Persistence                               |
| ----------------------- | ------------------------------------------------------ | ----------------------------------------- |
| ProseMirror EditorState | Content of the actively-edited block                   | Memory (saved to SQLite on debounce/blur) |
| SQLite + Zustand        | Everything else: page/block data, UI state, navigation | SQLite (data), localStorage (UI prefs)    |

See [ADR-011](../decisions/011-state-management.md) for the rationale.

## Zustand: Application State

Zustand manages both UI state and cached DB data.

### Store Structure

- **UI state:** sidebar, panels, focus, selections, command palette
- **Navigation:** current page, history stack, back/forward
- **Persistence:** sidebar preferences saved to localStorage

See `packages/desktop/src/stores/ui-store.ts` for the store definition.

## Query Hooks: Reactive DB Reads

Query hooks wrap service calls with Zustand-backed caching and key-based invalidation. The pattern:

1. **Hook declares a key** (e.g., `['blocks', 'byPage', pageId]`) and a query function
2. **Query function** calls a service method (e.g., `blockService.getByPage(pageId)`)
3. **After mutations**, call `invalidateQueries(['blocks'])` to trigger re-fetch for matching hooks
4. **Key-prefix matching**: invalidating `['blocks']` re-fetches all hooks whose key starts with `["blocks"`

See `packages/desktop/src/hooks/` for hook implementations.

## ProseMirror: Editor State

ProseMirror is the authoritative owner of the actively-edited block's content. While a block is being edited:

1. ProseMirror's EditorState is the source of truth
2. Debounced save writes to SQLite
3. Query hooks for that block are NOT invalidated during editing (avoids conflicts)
4. On blur, a final save fires and queries are invalidated

This prevents stale-read bugs where the cache and ProseMirror diverge.

## Boundaries Between Stores

| Data                    | Owner                 | Reason                              |
| ----------------------- | --------------------- | ----------------------------------- |
| Block content (editing) | ProseMirror           | Authoritative during active editing |
| Block content (reading) | SQLite via query hook | Source of truth when not editing    |
| Block list for a page   | SQLite via query hook | Derived from DB                     |
| Currently focused block | Zustand               | Ephemeral UI state                  |
| Sidebar open/closed     | Zustand (persisted)   | UI preference                       |
| Search results          | SQLite via query hook | Derived from DB query               |
| Search input text       | React local state     | Component-level                     |
| Command palette open    | Zustand               | Global UI state                     |
| Navigation history      | Zustand               | Session state                       |

## Rules

1. **ProseMirror owns the actively-edited block** — no external store mirrors or overwrites it during editing
2. **SQLite is the persistent source of truth** — all data reads go through query hooks
3. **Zustand is for UI state and preferences** — sidebar, panels, focus, selections, navigation
4. **Invalidation is explicit** — after every mutation, enumerate affected query keys
5. **Prefer local component state** for truly local concerns (input values, hover states)
6. **Zustand selectors** should be fine-grained to prevent unnecessary re-renders
