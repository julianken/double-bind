# ADR-011: Zustand + Custom Reactive Hooks (Revised)

## Status
Accepted (revised from React Query + Zustand)

## Context

The React frontend needs state management for two kinds of state: data from CozoDB (DB state) and UI state (sidebar open, current page, editor focus).

The original decision was React Query + Zustand. Architectural review identified three problems:

1. **React Query solves server-state sync — a problem that doesn't exist here.** CozoDB is local. There is no network latency, no request deduplication, no background refetching to manage. React Query's core value proposition is unnecessary overhead.
2. **Three state stores create synchronization gaps.** ProseMirror manages its own state via transactions. React Query manages a cache. Zustand manages UI state. When a user edits a block, ProseMirror has the latest content, but React Query may have stale data, and neither knows about the other. This is the root cause of the "stale read after optimistic write" class of bugs.
3. **ProseMirror's transaction model conflicts with external state managers.** The NYTimes `react-prosemirror` library documents this: during React's render phase, components may see a different EditorState than the EditorView, leading to dispatch-on-stale-state bugs.

## Decision

- **Zustand** for all application state: UI state, page/block data cache, navigation
- **Custom `useCozoQuery` hook** for reactive DB reads: thin wrapper that queries CozoDB and subscribes to invalidation signals
- **ProseMirror owns editor state** for the actively-edited block — no external store mirrors it

## Architecture

```
ProseMirror EditorState (active block only)
        │ save on debounce/blur
        ▼
CozoDB (source of truth)
        │ useCozoQuery reads
        ▼
Zustand (application cache + UI state)
        │ React re-renders
        ▼
React Components
```

### useCozoQuery Hook

```typescript
function useCozoQuery<T>(
  key: string[],
  queryFn: () => Promise<T>,
  options?: { enabled?: boolean }
): { data: T | undefined; isLoading: boolean; error: Error | null } {
  // Thin wrapper: calls queryFn, stores result, re-runs on invalidation signal
}

// Invalidation via an event emitter
function invalidateQueries(keyPrefix: string[]): void {
  // Notifies all useCozoQuery hooks whose key starts with keyPrefix
}
```

### Zustand Store

Zustand holds both UI state and cached DB data. DB data is populated by `useCozoQuery` and invalidated after mutations.

## Consequences

**Positive**:
- Two sources of truth instead of three (ProseMirror for active editing, CozoDB for everything else)
- No React Query dependency (~13KB gzipped removed)
- Invalidation is explicit and predictable (no staleTime, gcTime, refetchOnWindowFocus to configure)
- ProseMirror is unambiguously authoritative for the block being edited

**Negative**:
- Must build `useCozoQuery` (thin, ~50 lines)
- No React Query DevTools (build a simple Zustand devtools panel instead)
- No built-in optimistic updates (implement via Zustand's `setState` + rollback)
- React Query's error boundaries and suspense integration must be replicated manually if desired

## Why Not React Query with Local-First Config?

React Query *can* work with `staleTime: Infinity`, `networkMode: 'always'`, `refetchOnWindowFocus: false`. But at that point, it's a key-value cache with hooks — which is exactly what Zustand already provides, without the conceptual overhead of "server state" abstractions.
