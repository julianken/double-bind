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
export { EditableBlockView, type EditableBlockViewProps } from './EditableBlockView';
export { BlockList, type BlockListProps, type BlockListItem } from './BlockList';
export { DraggableBlockList, type DraggableBlockListProps } from './DraggableBlockList';
export { BlockReference, type BlockReferenceProps } from './BlockReference';

// Rich Text Components
export { WikiLink, type WikiLinkProps } from './WikiLink';
export { RichText, type RichTextProps } from './RichText';

// Hooks
export {
  useBlockOperations,
  type BlockService,
  type BlockOperationsResult,
  type CreateBlockOptions,
  type UndoableOperation,
  type OperationType,
} from './hooks/useBlockOperations';

// UI Components
export { FloatingActionButton, type FloatingActionButtonProps } from './FloatingActionButton';
export { NewPageModal, type NewPageModalProps } from './NewPageModal';

// Layout components and utilities
export * from './layout';

// Sync and conflict resolution utilities
export * from './sync';

// Pagination utilities
export * from './pagination';

// Streaming utilities
export * from './streaming';

// Battery optimization utilities
export * from './battery';

// Memory management utilities
export * from './memory';

// iOS sharing utilities
export * from './ios';
