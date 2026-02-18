/**
 * Graph Store - State for the interactive graph visualization
 *
 * Manages:
 * - Display configuration (persisted): encoding mode, color/size toggles,
 *   minimum degree filter, hull visibility
 * - Ephemeral filters/search: community filters, search query
 * - Ephemeral interaction: selected nodes, path source/result, hovered node
 * - Persisted layout: pinned node positions
 *
 * Set/Map serialization: custom replacer/reviver handles JSON round-trip for
 * Set<number>, Set<PageId>, and Map<PageId, position> types.
 *
 * Persistence key: `double-bind-graph`
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// ============================================================================
// Types
// ============================================================================

export type EncodingMode = 'primary' | 'orphan' | 'recency';
export type PageId = string;

export interface GraphStore {
  // === Persisted: Display Config ===
  /** default: 'primary' */
  encodingMode: EncodingMode;
  /** default: true */
  colorByCommunity: boolean;
  /** default: true */
  sizeByPageRank: boolean;
  /** default: 1 */
  minDegree: number;
  /** default: true */
  showHulls: boolean;

  // === Ephemeral: Filters / Search ===
  activeCommunityFilters: Set<number>;
  searchQuery: string;

  // === Ephemeral: Interaction ===
  selectedNodeIds: Set<PageId>;
  pathSourceId: PageId | null;
  activePath: PageId[] | null;
  hoveredNode: { pageId: PageId; screenX: number; screenY: number } | null;

  // === Persisted: Layout ===
  pinnedNodes: Map<PageId, { x: number; y: number }>;

  // === Actions ===
  setEncodingMode: (mode: EncodingMode) => void;
  toggleColorByCommunity: () => void;
  toggleSizeByPageRank: () => void;
  setMinDegree: (degree: number) => void;
  toggleShowHulls: () => void;
  setCommunityFilters: (filters: Set<number>) => void;
  toggleCommunityFilter: (communityId: number) => void;
  setSearchQuery: (query: string) => void;
  selectNode: (pageId: PageId) => void;
  deselectNode: (pageId: PageId) => void;
  clearNodeSelection: () => void;
  setPathSource: (pageId: PageId | null) => void;
  setActivePath: (path: PageId[] | null) => void;
  setHoveredNode: (node: GraphStore['hoveredNode']) => void;
  pinNode: (pageId: PageId, position: { x: number; y: number }) => void;
  unpinNode: (pageId: PageId) => void;
  clearPinnedNodes: () => void;
}

// ============================================================================
// Custom JSON serializer for Set and Map
// ============================================================================

const graphStorage = createJSONStorage(() => localStorage, {
  replacer: (_key, value) => {
    if (value instanceof Set) return { __type: 'Set', data: [...value] };
    if (value instanceof Map) return { __type: 'Map', data: [...value.entries()] };
    return value;
  },
  reviver: (_key, value) => {
    if (value && typeof value === 'object' && (value as { __type?: string }).__type === 'Set')
      return new Set((value as { data: unknown[] }).data);
    if (value && typeof value === 'object' && (value as { __type?: string }).__type === 'Map')
      return new Map((value as { data: [unknown, unknown][] }).data);
    return value;
  },
});

// ============================================================================
// Store
// ============================================================================

export const useGraphStore = create<GraphStore>()(
  persist(
    (set) => ({
      // === Persisted: Display Config ===
      encodingMode: 'primary',
      colorByCommunity: true,
      sizeByPageRank: true,
      minDegree: 1,
      showHulls: true,

      // === Ephemeral: Filters / Search ===
      activeCommunityFilters: new Set(),
      searchQuery: '',

      // === Ephemeral: Interaction ===
      selectedNodeIds: new Set(),
      pathSourceId: null,
      activePath: null,
      hoveredNode: null,

      // === Persisted: Layout ===
      pinnedNodes: new Map(),

      // === Actions ===
      setEncodingMode: (mode) => set({ encodingMode: mode }),

      toggleColorByCommunity: () =>
        set((s) => ({ colorByCommunity: !s.colorByCommunity })),

      toggleSizeByPageRank: () =>
        set((s) => ({ sizeByPageRank: !s.sizeByPageRank })),

      setMinDegree: (degree) => set({ minDegree: degree }),

      toggleShowHulls: () => set((s) => ({ showHulls: !s.showHulls })),

      setCommunityFilters: (filters) => set({ activeCommunityFilters: filters }),

      toggleCommunityFilter: (id) =>
        set((s) => {
          const next = new Set(s.activeCommunityFilters);
          next.has(id) ? next.delete(id) : next.add(id);
          return { activeCommunityFilters: next };
        }),

      setSearchQuery: (query) => set({ searchQuery: query }),

      selectNode: (pageId) =>
        set((s) => ({ selectedNodeIds: new Set([...s.selectedNodeIds, pageId]) })),

      deselectNode: (pageId) =>
        set((s) => {
          const next = new Set(s.selectedNodeIds);
          next.delete(pageId);
          return { selectedNodeIds: next };
        }),

      clearNodeSelection: () => set({ selectedNodeIds: new Set() }),

      setPathSource: (pageId) => set({ pathSourceId: pageId }),

      setActivePath: (path) => set({ activePath: path }),

      setHoveredNode: (node) => set({ hoveredNode: node }),

      pinNode: (pageId, position) =>
        set((s) => ({ pinnedNodes: new Map([...s.pinnedNodes, [pageId, position]]) })),

      unpinNode: (pageId) =>
        set((s) => {
          const next = new Map(s.pinnedNodes);
          next.delete(pageId);
          return { pinnedNodes: next };
        }),

      clearPinnedNodes: () => set({ pinnedNodes: new Map() }),
    }),
    {
      name: 'double-bind-graph',
      storage: graphStorage,
      partialize: (state) => ({
        encodingMode: state.encodingMode,
        colorByCommunity: state.colorByCommunity,
        sizeByPageRank: state.sizeByPageRank,
        minDegree: state.minDegree,
        showHulls: state.showHulls,
        pinnedNodes: state.pinnedNodes,
      }),
    }
  )
);
