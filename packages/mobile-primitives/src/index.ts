/**
 * @double-bind/mobile-primitives
 *
 * Mobile UI primitives for Double-Bind React Native app.
 * Provides touch-optimized block components, responsive layout components,
 * safe area handling, and device-adaptive utilities.
 * All components are designed to meet iOS Human Interface Guidelines
 * with minimum 44pt touch targets and proper accessibility support.
 */

// Block Components
export { BlockView, type BlockViewProps } from './BlockView';
export { BlockList, type BlockListProps, type BlockListItem } from './BlockList';
export { BlockReference, type BlockReferenceProps } from './BlockReference';

// Layout components and utilities
export * from './layout';
