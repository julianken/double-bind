// @double-bind/ui-primitives - Shared React components for the desktop app
// This package contains domain-aware UI components.

// Block components
export { BulletHandle, type BulletHandleProps } from './blocks';
export { InlineBlockRef, type InlineBlockRefProps } from './blocks';
export { InlinePageLink, type InlinePageLinkProps } from './blocks';

// Graph components
export { MiniGraph, type MiniGraphProps, type MiniGraphNode, type MiniGraphEdge } from './graph';
export {
  GraphView,
  type GraphViewProps,
  type GraphNode,
  type GraphEdge,
  type ForceGraphMethods,
  type GraphViewRef,
} from './graph';

// Data display components
export { BacklinksPanel, type BacklinksPanelProps, type LinkedRef, type UnlinkedRef } from './data';
