# State Management

## Two-Source Architecture

| Source of Truth | What It Owns | Persistence |
|----------------|-------------|-------------|
| ProseMirror EditorState | Content of the actively-edited block | Memory (saved to CozoDB on debounce/blur) |
| CozoDB + Zustand | Everything else: page/block data, UI state, navigation | CozoDB (data), memory/localStorage (UI prefs) |

See [ADR 011](../decisions/011-state-management.md) for the rationale (revised from React Query + Zustand).

## Why Not React Query?

React Query is an async state manager for server state synchronization. In a local-first app where CozoDB is embedded:
- There is no network to cache, deduplicate, or retry against
- `staleTime: Infinity` + `networkMode: 'always'` reduces React Query to a key-value cache with hooks — which is what Zustand already provides
- Adding React Query creates a third state store (alongside ProseMirror and Zustand) with synchronization gaps between them

## Zustand: Application State

Zustand manages both UI state and cached DB data.

### Store Shape

```typescript
interface AppStore {
  // === UI State ===
  sidebarOpen: boolean;
  sidebarWidth: number;
  toggleSidebar: () => void;
  setSidebarWidth: (width: number) => void;

  rightPanelOpen: boolean;
  rightPanelContent: 'backlinks' | 'properties' | 'graph' | null;
  openRightPanel: (content: RightPanelContent) => void;
  closeRightPanel: () => void;

  focusedBlockId: string | null;
  setFocusedBlock: (blockId: string | null) => void;

  selectedBlockIds: Set<string>;
  selectBlock: (blockId: string) => void;
  deselectBlock: (blockId: string) => void;
  clearSelection: () => void;

  commandPaletteOpen: boolean;
  toggleCommandPalette: () => void;

  // === Navigation ===
  currentPageId: string | null;
  pageHistory: string[];
  navigateToPage: (pageId: string) => void;
  goBack: () => void;
  goForward: () => void;
}
```

### Persistence

Some UI preferences survive app restarts:

```typescript
const useAppStore = create(
  persist(
    (set, get) => ({ /* ... */ }),
    {
      name: 'double-bind-ui',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
        sidebarWidth: state.sidebarWidth,
      }),
    }
  )
);
```

## useCozoQuery: Reactive DB Reads

A thin hook (~50 lines) that queries CozoDB and re-runs on invalidation. Implemented as a Zustand-backed query cache with a React hook.

### Query Store (Zustand)

```typescript
interface QueryEntry<T = unknown> {
  data: T | undefined;
  error: Error | null;
  isLoading: boolean;
  /** Monotonically increasing version; bump to trigger re-fetch */
  invalidationCount: number;
}

interface QueryStore {
  entries: Map<string, QueryEntry>;
  /** Invalidate all queries whose serialized key starts with the given prefix */
  invalidateQueries: (keyPrefix: string[]) => void;
}

const useQueryStore = create<QueryStore>((set, get) => ({
  entries: new Map(),
  invalidateQueries: (keyPrefix) => {
    const prefix = JSON.stringify(keyPrefix).slice(0, -1); // match prefix
    const entries = new Map(get().entries);
    for (const [key, entry] of entries) {
      if (key.startsWith(prefix)) {
        entries.set(key, { ...entry, invalidationCount: entry.invalidationCount + 1 });
      }
    }
    set({ entries });
  },
}));

// Exported for use in mutation functions
export const invalidateQueries = (keyPrefix: string[]) =>
  useQueryStore.getState().invalidateQueries(keyPrefix);
```

### Hook Implementation

```typescript
function useCozoQuery<T>(
  key: string[],
  queryFn: () => Promise<T>,
  options?: { enabled?: boolean }
): { data: T | undefined; isLoading: boolean; error: Error | null } {
  const serializedKey = JSON.stringify(key);
  const enabled = options?.enabled ?? true;

  // Stable reference: queryFn identity must not change on every render.
  // Callers must wrap queryFn with useCallback if it captures changing deps.
  const stableQueryFn = useCallback(queryFn, [serializedKey]);

  const entry = useQueryStore(
    useCallback((s) => s.entries.get(serializedKey), [serializedKey])
  );
  const invalidationCount = entry?.invalidationCount ?? 0;

  useEffect(() => {
    if (!enabled) return;

    // Set loading state
    useQueryStore.setState((s) => {
      const entries = new Map(s.entries);
      const existing = entries.get(serializedKey);
      entries.set(serializedKey, {
        data: existing?.data,
        error: null,
        isLoading: true,
        invalidationCount,
      });
      return { entries };
    });

    let cancelled = false;
    stableQueryFn().then(
      (data) => {
        if (!cancelled) {
          useQueryStore.setState((s) => {
            const entries = new Map(s.entries);
            entries.set(serializedKey, { data, error: null, isLoading: false, invalidationCount });
            return { entries };
          });
        }
      },
      (error) => {
        if (!cancelled) {
          useQueryStore.setState((s) => {
            const entries = new Map(s.entries);
            entries.set(serializedKey, { data: undefined, error, isLoading: false, invalidationCount });
            return { entries };
          });
        }
      }
    );

    return () => { cancelled = true; };
  }, [serializedKey, enabled, invalidationCount, stableQueryFn]);

  return {
    data: entry?.data as T | undefined,
    isLoading: entry?.isLoading ?? (enabled ? true : false),
    error: entry?.error ?? null,
  };
}
```

### Usage

```typescript
function usePageBlocks(pageId: string) {
  const queryFn = useCallback(
    () => blockService.getByPage(pageId),
    [pageId]
  );
  return useCozoQuery(
    ['blocks', 'byPage', pageId],
    queryFn,
    { enabled: !!pageId }
  );
}

function useBacklinks(blockId: string) {
  const queryFn = useCallback(
    () => blockService.getBacklinks(blockId),
    [blockId]
  );
  return useCozoQuery(['backlinks', blockId], queryFn);
}
```

### Invalidation

After mutations, call the exported `invalidateQueries` function:

```typescript
import { invalidateQueries } from './query-store';

async function updateBlockContent(blockId: string, content: string) {
  await blockService.updateContent(blockId, content);

  invalidateQueries(['blocks']);       // All block queries
  invalidateQueries(['backlinks']);    // Backlinks may have changed
  invalidateQueries(['search']);       // FTS results may have changed
}
```

Invalidation uses key-prefix matching: `invalidateQueries(['blocks'])` triggers re-fetch for all hooks whose serialized key starts with `["blocks"`.

## ProseMirror: Editor State

ProseMirror is the authoritative owner of the actively-edited block's content. While a block is being edited:

1. ProseMirror's EditorState is the source of truth
2. Debounced save (300ms) writes to CozoDB
3. `useCozoQuery` hooks for that block are **not** invalidated during active editing (to avoid conflicts)
4. On blur (editor deactivation), a final save fires, and queries are invalidated

This prevents the "stale read after optimistic write" bug where React Query's cache and ProseMirror's state diverge.

## Boundaries Between Stores

| Data | Owner | Reason |
|------|-------|--------|
| Block content (editing) | ProseMirror | Must be authoritative during active editing |
| Block content (reading) | CozoDB via useCozoQuery | Source of truth when not editing |
| Block list for a page | CozoDB via useCozoQuery | Derived from DB |
| Currently focused block | Zustand | Ephemeral UI state |
| Sidebar open/closed | Zustand (persisted) | UI preference |
| Search results | CozoDB via useCozoQuery | Derived from DB query |
| Search input text | React state (local) | Component-level |
| Command palette open | Zustand | Global UI state |
| Navigation history | Zustand | Session state |

## Rules

1. **ProseMirror owns the actively-edited block** — no external store mirrors or overwrites it during editing
2. **CozoDB is the persistent source of truth** — all data reads go through `useCozoQuery`
3. **Zustand is for UI state and preferences** — sidebar, panels, focus, selections, navigation
4. **Invalidation is explicit** — after every mutation, enumerate affected query keys
5. **Prefer local component state** for truly local concerns (input values, hover states)
6. **Zustand selectors** should be fine-grained to prevent unnecessary re-renders
